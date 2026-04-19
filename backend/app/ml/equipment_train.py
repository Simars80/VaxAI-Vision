"""Equipment inspection classifier training pipeline.

Trains two sklearn RandomForest classifiers — one for equipment type,
one for condition — on color-histogram + spatial features extracted from
synthetic images.  Artefacts are saved under the specified output directory
so the EquipmentInspector can pick them up automatically.

Usage (from repo root):
    python -m app.ml.equipment_train \\
        --data  data/equipment_synthetic \\
        --out   data/equipment_models \\
        --gen                           # regenerate synthetic data first
"""

from __future__ import annotations

import argparse
import json
import logging
import pickle
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

logger = logging.getLogger(__name__)

EQUIPMENT_TYPES = [
    "refrigerator",
    "cold_box",
    "vaccine_carrier",
    "ice_pack",
    "temperature_monitor",
]
CONDITIONS = [
    "operational",
    "needs_maintenance",
    "damaged",
    "non_functional",
]
TYPE_TO_IDX = {t: i for i, t in enumerate(EQUIPMENT_TYPES)}
COND_TO_IDX = {c: i for i, c in enumerate(CONDITIONS)}

IMG_SIZE = 224


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------


def _extract_features(img: Image.Image) -> np.ndarray:
    """Extract a fixed-length feature vector from an equipment image.

    Features:
      - Per-channel (R, G, B) 32-bin color histograms  → 96 dims
      - Per-channel center vs border mean + diff        → 9 dims
      - Grayscale edge density (mean |gradient|)        → 2 dims
      - Global brightness and color std                 → 4 dims
      - Rust proxy: red-blue channel difference         → 1 dim
      Total: 112 dimensions
    """
    img = img.resize((IMG_SIZE, IMG_SIZE)).convert("RGB")
    arr = np.asarray(img, dtype=np.float32) / 255.0

    features: list[float] = []

    # --- Per-channel histograms ---
    for ch in range(3):
        hist, _ = np.histogram(arr[:, :, ch], bins=32, range=(0.0, 1.0))
        features.extend((hist / (hist.sum() + 1e-8)).tolist())

    # --- Spatial center vs border statistics ---
    h, w = arr.shape[:2]
    center = arr[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
    border_top = arr[: h // 4, :, :]
    border_bot = arr[3 * h // 4 :, :, :]
    border = np.concatenate([border_top, border_bot], axis=0)

    for ch in range(3):
        c_mean = float(center[:, :, ch].mean())
        b_mean = float(border[:, :, ch].mean())
        features.append(c_mean)
        features.append(b_mean)
        features.append(c_mean - b_mean)

    # --- Edge density (horizontal + vertical gradient magnitude) ---
    gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    grad_x = float(np.abs(np.diff(gray, axis=1)).mean())
    grad_y = float(np.abs(np.diff(gray, axis=0)).mean())
    features.append(grad_x)
    features.append(grad_y)

    # --- Global statistics ---
    features.append(float(arr.mean()))              # overall brightness
    features.append(float(arr.std()))               # overall variance
    features.append(float(arr[:, :, 0].mean()))    # mean R
    features.append(float(arr[:, :, 2].mean()))    # mean B

    # --- Rust proxy: R - B difference in lower half ---
    lower = arr[IMG_SIZE // 2 :, :, :]
    features.append(float(lower[:, :, 0].mean() - lower[:, :, 2].mean()))

    return np.array(features, dtype=np.float32)


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def _load_split(
    data_dir: Path, split: str
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Load all images from a split, returning X, y_type, y_condition."""
    split_dir = data_dir / split
    X, y_type, y_cond = [], [], []

    for eq_type in EQUIPMENT_TYPES:
        for condition in CONDITIONS:
            class_name = f"{eq_type}__{condition}"
            class_dir = split_dir / class_name
            if not class_dir.exists():
                continue
            for img_path in sorted(class_dir.glob("*.png")):
                img = Image.open(img_path).convert("RGB")
                X.append(_extract_features(img))
                y_type.append(TYPE_TO_IDX[eq_type])
                y_cond.append(COND_TO_IDX[condition])

    return np.array(X, dtype=np.float32), np.array(y_type), np.array(y_cond)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def train(data_dir: str | Path, output_dir: str | Path) -> dict:
    """Train type + condition classifiers and save artefacts.

    Returns a dict with accuracy metrics for both classifiers.
    """
    data_dir = Path(data_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Loading training data from %s", data_dir)
    X_train, y_type_train, y_cond_train = _load_split(data_dir, "train")
    X_val, y_type_val, y_cond_val = _load_split(data_dir, "val")

    logger.info(
        "Train: %d samples  |  Val: %d samples  |  Features: %d",
        len(X_train),
        len(X_val),
        X_train.shape[1] if len(X_train) > 0 else 0,
    )

    if len(X_train) == 0:
        raise RuntimeError(
            f"No training images found in {data_dir}/train — "
            "run equipment_synthetic.py first."
        )

    # --- Equipment type classifier ---
    logger.info("Training equipment type classifier ...")
    type_clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    type_clf.fit(X_train, y_type_train)

    type_preds = type_clf.predict(X_val)
    type_acc = float(accuracy_score(y_type_val, type_preds))
    type_report = classification_report(
        y_type_val, type_preds, target_names=EQUIPMENT_TYPES, output_dict=True
    )
    logger.info("Type classifier validation accuracy: %.4f", type_acc)

    # --- Condition classifier ---
    logger.info("Training equipment condition classifier ...")
    cond_clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    cond_clf.fit(X_train, y_cond_train)

    cond_preds = cond_clf.predict(X_val)
    cond_acc = float(accuracy_score(y_cond_val, cond_preds))
    cond_report = classification_report(
        y_cond_val, cond_preds, target_names=CONDITIONS, output_dict=True
    )
    logger.info("Condition classifier validation accuracy: %.4f", cond_acc)

    # --- Save artefacts ---
    type_model_path = output_dir / "equipment_type_rf.pkl"
    with open(type_model_path, "wb") as f:
        pickle.dump(type_clf, f)
    logger.info("Type model saved to %s", type_model_path)

    cond_model_path = output_dir / "equipment_condition_rf.pkl"
    with open(cond_model_path, "wb") as f:
        pickle.dump(cond_clf, f)
    logger.info("Condition model saved to %s", cond_model_path)

    metrics = {
        "type_classifier": {
            "model": "RandomForest",
            "accuracy": type_acc,
            "train_samples": len(X_train),
            "val_samples": len(X_val),
            "per_class": {
                label: {
                    "precision": type_report[label]["precision"],
                    "recall": type_report[label]["recall"],
                    "f1": type_report[label]["f1-score"],
                }
                for label in EQUIPMENT_TYPES
                if label in type_report
            },
        },
        "condition_classifier": {
            "model": "RandomForest",
            "accuracy": cond_acc,
            "train_samples": len(X_train),
            "val_samples": len(X_val),
            "per_class": {
                label: {
                    "precision": cond_report[label]["precision"],
                    "recall": cond_report[label]["recall"],
                    "f1": cond_report[label]["f1-score"],
                }
                for label in CONDITIONS
                if label in cond_report
            },
        },
    }

    metrics_path = output_dir / "equipment_metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2))
    logger.info("Metrics saved to %s", metrics_path)

    return metrics


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )

    parser = argparse.ArgumentParser(description="Train equipment inspection classifiers")
    parser.add_argument(
        "--data",
        default="data/equipment_synthetic",
        help="Root directory of the synthetic dataset (default: data/equipment_synthetic)",
    )
    parser.add_argument(
        "--out",
        default="data/equipment_models",
        help="Output directory for trained model artefacts (default: data/equipment_models)",
    )
    parser.add_argument(
        "--gen",
        action="store_true",
        help="Generate synthetic data before training",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=80,
        help="Samples per class when generating data (default: 80)",
    )
    args = parser.parse_args()

    if args.gen:
        from app.ml.equipment_synthetic import generate_dataset

        logger.info("Generating synthetic dataset in %s ...", args.data)
        manifest = generate_dataset(args.data, samples_per_class=args.samples)
        logger.info(
            "Dataset ready: %d train / %d val images",
            len(manifest["train"]),
            len(manifest["val"]),
        )

    metrics = train(args.data, args.out)
    print(json.dumps(metrics, indent=2))
