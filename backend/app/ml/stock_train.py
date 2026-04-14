"""YOLOv8-nano training pipeline for vaccine product detection.

Trains a YOLOv8n model on synthetic warehouse shelf images for the
AR stock counter. Optimized for on-device inference (<15MB, <100ms).

Usage:
    python -m app.ml.stock_train --data data/stock_synthetic/dataset.yaml
"""

from __future__ import annotations

import argparse
import json
import logging
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

_DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "stock_synthetic"
_DEFAULT_MODEL_DIR = Path(__file__).resolve().parent.parent / "vision" / "models"

CLASSES = ["vaccine_vial", "syringe", "cold_box", "diluent", "ancillary_product"]


def train(
    data_yaml: str | Path,
    output_dir: str | Path = _DEFAULT_MODEL_DIR,
    epochs: int = 100,
    imgsz: int = 640,
    batch: int = 16,
    device: str = "cpu",
    pretrained: bool = True,
) -> dict:
    """Train YOLOv8n on the stock counter dataset.

    Returns a dict with training results and model paths.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        raise ImportError(
            "ultralytics is required for training. "
            "Install with: pip install ultralytics>=8.0.0"
        )

    data_yaml = Path(data_yaml)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    model = YOLO("yolov8n.pt" if pretrained else "yolov8n.yaml")

    results = model.train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        project=str(output_dir / "runs"),
        name="stock_counter",
        exist_ok=True,
        patience=20,
        save=True,
        save_period=10,
        val=True,
        plots=True,
        lr0=0.01,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3.0,
        warmup_momentum=0.8,
        box=7.5,
        cls=0.5,
        dfl=1.5,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=10.0,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.1,
    )

    best_weights = output_dir / "runs" / "stock_counter" / "weights" / "best.pt"
    if best_weights.exists():
        final_path = output_dir / "stock_counter_yolov8n.pt"
        shutil.copy2(best_weights, final_path)
        logger.info("Best weights saved to %s", final_path)
    else:
        final_path = None
        logger.warning("No best weights found after training")

    metrics = _extract_metrics(results, output_dir)
    return metrics


def _extract_metrics(results, output_dir: Path) -> dict:
    metrics = {
        "model": "yolov8n",
        "classes": CLASSES,
        "num_classes": len(CLASSES),
    }

    try:
        if hasattr(results, "results_dict"):
            rd = results.results_dict
            metrics.update({
                "map50": float(rd.get("metrics/mAP50(B)", 0)),
                "map50_95": float(rd.get("metrics/mAP50-95(B)", 0)),
                "precision": float(rd.get("metrics/precision(B)", 0)),
                "recall": float(rd.get("metrics/recall(B)", 0)),
            })
    except Exception as e:
        logger.warning("Could not extract training metrics: %s", e)

    metrics_path = output_dir / "stock_counter_metrics.json"
    metrics_path.write_text(json.dumps(metrics, indent=2))
    return metrics


def validate(
    model_path: str | Path,
    data_yaml: str | Path,
    imgsz: int = 640,
    device: str = "cpu",
) -> dict:
    """Run validation on the trained model and return metrics."""
    from ultralytics import YOLO

    model = YOLO(str(model_path))
    results = model.val(data=str(data_yaml), imgsz=imgsz, device=device)

    return {
        "map50": float(results.box.map50),
        "map50_95": float(results.box.map),
        "precision": float(results.box.mp),
        "recall": float(results.box.mr),
        "per_class_ap50": {
            CLASSES[i]: float(results.box.ap50[i])
            for i in range(min(len(CLASSES), len(results.box.ap50)))
        },
    }


def export_model(
    model_path: str | Path,
    output_dir: str | Path = _DEFAULT_MODEL_DIR,
    imgsz: int = 640,
    formats: list[str] | None = None,
) -> dict:
    """Export trained model to ONNX and TF.js formats."""
    from ultralytics import YOLO

    if formats is None:
        formats = ["onnx", "tfjs"]

    model_path = Path(model_path)
    output_dir = Path(output_dir)
    exports = {}

    model = YOLO(str(model_path))

    if "onnx" in formats:
        onnx_path = model.export(
            format="onnx",
            imgsz=imgsz,
            simplify=True,
            opset=12,
            dynamic=False,
            half=False,
        )
        if onnx_path:
            dest = output_dir / "stock_counter.onnx"
            shutil.copy2(onnx_path, dest)
            size_mb = dest.stat().st_size / (1024 * 1024)
            exports["onnx"] = {"path": str(dest), "size_mb": round(size_mb, 2)}
            logger.info("ONNX model exported: %s (%.2f MB)", dest, size_mb)

    if "tfjs" in formats:
        try:
            tfjs_path = model.export(format="tfjs", imgsz=imgsz)
            if tfjs_path:
                dest = output_dir / "stock_counter_tfjs"
                if Path(tfjs_path).is_dir():
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(tfjs_path, dest)
                else:
                    shutil.copy2(tfjs_path, dest)
                exports["tfjs"] = {"path": str(dest)}
                logger.info("TF.js model exported to %s", dest)
        except Exception as e:
            logger.warning("TF.js export failed (non-critical): %s", e)
            exports["tfjs"] = {"error": str(e)}

    exports_path = output_dir / "stock_counter_exports.json"
    exports_path.write_text(json.dumps(exports, indent=2))
    return exports


def main():
    parser = argparse.ArgumentParser(description="Train YOLOv8n stock counter")
    parser.add_argument(
        "--data",
        type=str,
        default=str(_DEFAULT_DATA_DIR / "dataset.yaml"),
    )
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--device", type=str, default="cpu")
    parser.add_argument("--output", type=str, default=str(_DEFAULT_MODEL_DIR))
    parser.add_argument("--export", action="store_true", help="Export after training")
    args = parser.parse_args()

    metrics = train(
        data_yaml=args.data,
        output_dir=args.output,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device,
    )
    print(f"Training complete: {json.dumps(metrics, indent=2)}")

    if args.export:
        model_path = Path(args.output) / "stock_counter_yolov8n.pt"
        if model_path.exists():
            exports = export_model(model_path, args.output, args.imgsz)
            print(f"Exports: {json.dumps(exports, indent=2)}")


if __name__ == "__main__":
    main()
