"""VVM classifier training pipeline.

Two-track approach:
  1. sklearn RandomForest on color-histogram features â fast, interpretable
  2. PyTorch small CNN â ONNX export (convertible to TFLite via CI)

Both produce artefacts under the specified output directory.
"""

from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

logger = logging.getLogger(__name__)

LABELS = ["stage_1", "stage_2", "stage_3", "stage_4"]
LABEL_TO_IDX = {label: i for i, label in enumerate(LABELS)}
IMG_SIZE = 224


# ââ Feature extraction (sklearn path) ââââââââââââââââââââââââââââââââââââââââ


def _extract_features(img: Image.Image) -> np.ndarray:
    """Extract color histogram + spatial features from a VVM image."""
    img = img.resize((IMG_SIZE, IMG_SIZE)).convert("RGB")
    arr = np.asarray(img, dtype=np.float32) / 255.0

    features = []

    for ch in range(3):
        hist, _ = np.histogram(arr[:, :, ch], bins=32, range=(0, 1))
        features.extend(hist / hist.sum())

    h, w = arr.shape[:2]
    center = arr[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
    border_top = arr[: h // 4, :, :]
    border_bot = arr[3 * h // 4 :, :, :]
    border = np.concatenate([border_top, border_bot], axis=0)

    for ch in range(3):
        features.append(float(center[:, :, ch].mean()))
        features.append(float(border[:, :, ch].mean()))
        features.append(float(center[:, :, ch].mean() - border[:, :, ch].mean()))

    return np.array(features, dtype=np.float32)


def _load_split(data_dir: Path, split: str) -> tuple[np.ndarray, np.ndarray]:
    split_dir = data_dir / split
    X, y = [], []
    for label in LABELS:
        label_dir = split_dir / label
        if not label_dir.exists():
            continue
        for img_path in sorted(label_dir.glob("*.png")):
            img = Image.open(img_path).convert("RGB")
            X.append(_extract_features(img))
            y.append(LABEL_TO_IDX[label])
    return np.array(X), np.array(y)


# ââ sklearn training âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ


def train_sklearn(data_dir: str | Path, output_dir: str | Path) -> dict:
    data_dir = Path(data_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Loading training data from %s", data_dir)
    X_train, y_train = _load_split(data_dir, "train")
    X_val, y_val = _load_split(data_dir, "val")

    logger.info("Train: %d samples, Val: %d samples", len(X_train), len(X_val))

    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_val)
    acc = accuracy_score(y_val, y_pred)
    report = classification_report(y_val, y_pred, target_names=LABELS, output_dict=True)

    logger.info("Validation accuracy: %.4f", acc)

    model_path = output_dir / "vvm_rf_model.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(clf, f)

    metrics = {
        "model": "RandomForest",
        "accuracy": float(acc),
        "per_class": {
            label: {
                "precision": report[label]["precision"],
                "recall": report[label]["recall"],
                "f1": report[label]["f1-score"],
            }
            for label in LABELS
        },
        "train_samples": len(X_train),
        "val_samples": len(X_val),
    }
    (output_dir / "sklearn_metrics.json").write_text(json.dumps(metrics, indent=2))

    return metrics


# ââ PyTorch CNN training + ONNX export ââââââââââââââââââââââââââââââââââââââââ


def _load_images(data_dir: Path, split: str) -> tuple[np.ndarray, np.ndarray]:
    split_dir = data_dir / split
    images, labels = [], []
    for label in LABELS:
        label_dir = split_dir / label
        if not label_dir.exists():
            continue
        for img_path in sorted(label_dir.glob("*.png")):
            img = Image.open(img_path).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
            arr = np.asarray(img, dtype=np.float32) / 255.0
            images.append(arr)
            labels.append(LABEL_TO_IDX[label])
    return np.array(images), np.array(labels)


def train_cnn(
    data_dir: str | Path,
    output_dir: str | Path,
    epochs: int = 30,
    batch_size: int = 16,
    lr: float = 1e-3,
) -> dict:
    """Train a small PyTorch CNN and export to ONNX."""
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset

    data_dir = Path(data_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    X_train, y_train = _load_images(data_dir, "train")
    X_val, y_val = _load_images(data_dir, "val")

    # PyTorch expects NCHW format
    X_train_t = torch.from_numpy(X_train.transpose(0, 3, 1, 2))
    y_train_t = torch.from_numpy(y_train).long()
    X_val_t = torch.from_numpy(X_val.transpose(0, 3, 1, 2))
    y_val_t = torch.from_numpy(y_val).long()

    train_ds = TensorDataset(X_train_t, y_train_t)
    val_ds = TensorDataset(X_val_t, y_val_t)
    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=batch_size)

    model = nn.Sequential(
        nn.Conv2d(3, 16, 3, padding=1),
        nn.ReLU(),
        nn.MaxPool2d(2),
        nn.Conv2d(16, 32, 3, padding=1),
        nn.ReLU(),
        nn.MaxPool2d(2),
        nn.Conv2d(32, 64, 3, padding=1),
        nn.ReLU(),
        nn.AdaptiveAvgPool2d(1),
        nn.Flatten(),
        nn.Dropout(0.3),
        nn.Linear(64, 64),
        nn.ReLU(),
        nn.Linear(64, len(LABELS)),
    )

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.CrossEntropyLoss()

    best_acc = 0.0
    best_state = None
    patience_counter = 0

    for epoch in range(epochs):
        model.train()
        for xb, yb in train_dl:
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimizer.step()

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for xb, yb in val_dl:
                preds = model(xb).argmax(dim=1)
                correct += (preds == yb).sum().item()
                total += len(yb)
        val_acc = correct / total

        if val_acc > best_acc:
            best_acc = val_acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            patience_counter = 0
        else:
            patience_counter += 1

        if epoch % 5 == 0 or patience_counter == 0:
            logger.info(
                "Epoch %d â val_acc: %.4f (best: %.4f)", epoch, val_acc, best_acc
            )

        if patience_counter >= 5:
            logger.info("Early stopping at epoch %d", epoch)
            break

    model.load_state_dict(best_state)
    model.eval()

    # Save PyTorch checkpoint
    torch.save(best_state, output_dir / "vvm_cnn.pt")

    # Export to ONNX
    dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE)
    onnx_path = output_dir / "vvm_classifier.onnx"
    torch.onnx.export(
        model,
        dummy,
        str(onnx_path),
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=13,
    )
    onnx_size_mb = onnx_path.stat().st_size / (1024 * 1024)
    logger.info("ONNX model size: %.2f MB", onnx_size_mb)

    # Final validation
    correct = 0
    with torch.no_grad():
        for xb, yb in val_dl:
            preds = model(xb).argmax(dim=1)
            correct += (preds == yb).sum().item()
    final_acc = correct / len(X_val)

    metrics = {
        "model": "SmallCNN-PyTorch",
        "val_accuracy": float(final_acc),
        "best_val_accuracy": float(best_acc),
        "onnx_size_mb": round(onnx_size_mb, 2),
        "epochs_trained": epoch + 1,
        "train_samples": len(X_train),
        "val_samples": len(X_val),
    }
    (output_dir / "cnn_metrics.json").write_text(json.dumps(metrics, indent=2))

    return metrics


def convert_onnx_to_tflite(
    onnx_path: str | Path,
    output_path: str | Path,
) -> Path:
    """Convert ONNX model to TFLite. Requires TensorFlow (run in CI)."""
    import tensorflow as tf
    import onnx
    from onnx_tf.backend import prepare

    onnx_model = onnx.load(str(onnx_path))
    tf_rep = prepare(onnx_model)

    tf_path = str(onnx_path).replace(".onnx", "_tf")
    tf_rep.export_graph(tf_path)

    converter = tf.lite.TFLiteConverter.from_saved_model(tf_path)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()

    output_path = Path(output_path)
    output_path.write_bytes(tflite_model)
    logger.info(
        "TFLite model written to %s (%.2f MB)",
        output_path,
        output_path.stat().st_size / (1024 * 1024),
    )
    return output_path


# ââ CLI âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data/vvm_synthetic"
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "data/vvm_models"

    print("=== Training sklearn model ===")
    sk_metrics = train_sklearn(data_dir, out_dir)
    print(json.dumps(sk_metrics, indent=2))

    try:
        print("\n=== Training PyTorch CNN ===")
        cnn_metrics = train_cnn(data_dir, out_dir)
        print(json.dumps(cnn_metrics, indent=2))
    except ImportError as e:
        print(f"PyTorch not available ({e}) â skipping CNN training.")

    onnx_file = Path(out_dir) / "vvm_classifier.onnx"
    tflite_file = Path(out_dir) / "vvm_classifier.tflite"
    if onnx_file.exists() and not tflite_file.exists():
        try:
            print("\n=== Converting ONNX â TFLite ===")
            convert_onnx_to_tflite(onnx_file, tflite_file)
        except ImportError:
            print("TensorFlow/onnx-tf not available â run TFLite conversion in CI.")
