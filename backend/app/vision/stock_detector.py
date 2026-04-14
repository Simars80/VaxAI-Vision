"""Stock detection inference engine using YOLOv8/ONNX Runtime.

Singleton pattern matching VVMClassifier. Supports ONNX Runtime Web-compatible
models for on-device inference parity with the backend.

Backends (tried in order):
  1. ultralytics — full YOLOv8 with PyTorch
  2. onnx — ONNX Runtime inference
  3. placeholder — deterministic demo output
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Literal

import numpy as np
from PIL import Image

from app.vision.ar.bytetrack import Detection
from app.vision.preprocessing import load_image

logger = logging.getLogger(__name__)

MODEL_VERSION = "0.1.0-demo"

CLASSES = ["vaccine_vial", "syringe", "cold_box", "diluent", "ancillary_product"]
IMGSZ = 640

_DEFAULT_MODEL_DIR = Path(__file__).resolve().parent / "models"

Backend = Literal["ultralytics", "onnx", "placeholder"]


class StockDetector:
    """YOLOv8-based vaccine product detector for the AR stock counter."""

    def __init__(
        self,
        backend: Backend = "ultralytics",
        model_dir: str | Path = _DEFAULT_MODEL_DIR,
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45,
    ) -> None:
        self.backend = backend
        self.model_dir = Path(model_dir)
        self.conf_thresh = confidence_threshold
        self.iou_thresh = iou_threshold
        self._loaded = False
        self._model = None
        self._onnx_session = None
        self._load_model()

    def _load_model(self) -> None:
        if self.backend == "ultralytics":
            self._try_load_ultralytics()
        elif self.backend == "onnx":
            self._try_load_onnx()
        else:
            self._loaded = True
            logger.info("Stock detector placeholder ready")

    def _try_load_ultralytics(self) -> None:
        pt_path = self.model_dir / "stock_counter_yolov8n.pt"
        if not pt_path.exists():
            logger.warning("YOLOv8 weights not found at %s, trying ONNX", pt_path)
            self.backend = "onnx"
            self._try_load_onnx()
            return

        try:
            from ultralytics import YOLO
            self._model = YOLO(str(pt_path))
            self._loaded = True
            logger.info("YOLOv8 model loaded from %s", pt_path)
        except ImportError:
            logger.warning("ultralytics not installed, trying ONNX fallback")
            self.backend = "onnx"
            self._try_load_onnx()

    def _try_load_onnx(self) -> None:
        onnx_path = self.model_dir / "stock_counter.onnx"
        if not onnx_path.exists():
            logger.warning(
                "ONNX model not found at %s, using placeholder", onnx_path
            )
            self.backend = "placeholder"
            self._loaded = True
            return

        try:
            import onnxruntime as ort
            self._onnx_session = ort.InferenceSession(
                str(onnx_path),
                providers=["CPUExecutionProvider"],
            )
            self._loaded = True
            logger.info("ONNX stock detector loaded from %s", onnx_path)
        except ImportError:
            logger.warning("onnxruntime not installed, using placeholder")
            self.backend = "placeholder"
            self._loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def detect(
        self,
        image: Image.Image | bytes | np.ndarray,
    ) -> list[Detection]:
        """Run detection on a single image. Returns list of Detection objects."""
        if isinstance(image, bytes):
            image = load_image(image)
        if isinstance(image, np.ndarray):
            image = Image.fromarray(image)

        if self.backend == "ultralytics" and self._model is not None:
            return self._detect_ultralytics(image)
        if self.backend == "onnx" and self._onnx_session is not None:
            return self._detect_onnx(image)
        return self._detect_placeholder(image)

    def detect_with_timing(
        self,
        image: Image.Image | bytes | np.ndarray,
    ) -> tuple[list[Detection], float]:
        """Detect objects and return (detections, inference_ms)."""
        start = time.perf_counter()
        dets = self.detect(image)
        elapsed_ms = (time.perf_counter() - start) * 1000
        return dets, elapsed_ms

    def _detect_ultralytics(self, image: Image.Image) -> list[Detection]:
        results = self._model(
            image,
            conf=self.conf_thresh,
            iou=self.iou_thresh,
            imgsz=IMGSZ,
            verbose=False,
        )
        detections = []
        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            for i in range(len(boxes)):
                bbox = boxes.xyxy[i].cpu().numpy().astype(np.float32)
                conf = float(boxes.conf[i].cpu())
                cls_id = int(boxes.cls[i].cpu())
                cls_name = CLASSES[cls_id] if cls_id < len(CLASSES) else f"class_{cls_id}"
                detections.append(Detection(
                    bbox=bbox,
                    score=conf,
                    class_id=cls_id,
                    class_name=cls_name,
                ))
        return detections

    def _detect_onnx(self, image: Image.Image) -> list[Detection]:
        img_resized = image.resize((IMGSZ, IMGSZ), Image.BILINEAR)
        arr = np.asarray(img_resized, dtype=np.float32) / 255.0
        tensor = np.expand_dims(arr.transpose(2, 0, 1), 0)

        input_name = self._onnx_session.get_inputs()[0].name
        outputs = self._onnx_session.run(None, {input_name: tensor})
        predictions = outputs[0]

        return self._parse_yolo_output(
            predictions, image.width, image.height
        )

    def _parse_yolo_output(
        self,
        predictions: np.ndarray,
        orig_w: int,
        orig_h: int,
    ) -> list[Detection]:
        """Parse YOLOv8 ONNX output [1, 84, N] -> detections."""
        if predictions.ndim == 3:
            predictions = predictions[0]

        if predictions.shape[0] == 4 + len(CLASSES):
            predictions = predictions.T

        detections = []
        scale_x = orig_w / IMGSZ
        scale_y = orig_h / IMGSZ

        for pred in predictions:
            cx, cy, w, h = pred[:4]
            class_scores = pred[4: 4 + len(CLASSES)]
            cls_id = int(np.argmax(class_scores))
            conf = float(class_scores[cls_id])

            if conf < self.conf_thresh:
                continue

            x1 = (cx - w / 2) * scale_x
            y1 = (cy - h / 2) * scale_y
            x2 = (cx + w / 2) * scale_x
            y2 = (cy + h / 2) * scale_y

            detections.append(Detection(
                bbox=np.array([x1, y1, x2, y2], dtype=np.float32),
                score=conf,
                class_id=cls_id,
                class_name=CLASSES[cls_id],
            ))

        return self._nms(detections)

    def _nms(self, detections: list[Detection]) -> list[Detection]:
        """Non-maximum suppression."""
        if not detections:
            return []

        detections.sort(key=lambda d: d.score, reverse=True)
        keep = []

        while detections:
            best = detections.pop(0)
            keep.append(best)
            remaining = []
            for det in detections:
                iou = self._compute_iou(best.bbox, det.bbox)
                if iou < self.iou_thresh:
                    remaining.append(det)
            detections = remaining

        return keep

    @staticmethod
    def _compute_iou(a: np.ndarray, b: np.ndarray) -> float:
        x1 = max(a[0], b[0])
        y1 = max(a[1], b[1])
        x2 = min(a[2], b[2])
        y2 = min(a[3], b[3])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        area_a = (a[2] - a[0]) * (a[3] - a[1])
        area_b = (b[2] - b[0]) * (b[3] - b[1])
        return inter / (area_a + area_b - inter + 1e-6)

    def _detect_placeholder(self, image: Image.Image) -> list[Detection]:
        """Deterministic placeholder for demo/testing without real weights."""
        rng = np.random.RandomState(hash(image.tobytes()[:64]) % (2**31))
        n = rng.randint(2, 8)
        w, h = image.size
        detections = []

        for _ in range(n):
            cls_id = rng.randint(0, len(CLASSES))
            bw = rng.uniform(30, min(150, w * 0.3))
            bh = rng.uniform(30, min(200, h * 0.4))
            x1 = rng.uniform(10, w - bw - 10)
            y1 = rng.uniform(10, h - bh - 10)

            detections.append(Detection(
                bbox=np.array([x1, y1, x1 + bw, y1 + bh], dtype=np.float32),
                score=float(rng.uniform(0.4, 0.95)),
                class_id=cls_id,
                class_name=CLASSES[cls_id],
            ))

        return detections


_detector: StockDetector | None = None


def get_stock_detector(
    backend: Backend = "ultralytics",
    model_dir: str | Path | None = None,
) -> StockDetector:
    """Return the singleton StockDetector, creating it on first call."""
    global _detector
    if _detector is None:
        _detector = StockDetector(
            backend=backend,
            model_dir=model_dir or _DEFAULT_MODEL_DIR,
        )
    return _detector
