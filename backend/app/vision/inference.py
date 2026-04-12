"""Unified inference engine for VVM classification.

Supports three backends:
  - **tflite** — loads a trained ``.tflite`` model for on-device-grade inference.
  - **sklearn** — loads a pickled RandomForest as a lightweight fallback.
  - **cpu** — deterministic placeholder so the API works before real weights exist.
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Literal

import numpy as np

from app.vision.preprocessing import TARGET_SIZE, load_image, preprocess
from app.vision.schemas import VVM_LABELS, VVMStage

logger = logging.getLogger(__name__)

MODEL_VERSION = "0.1.0-demo"

_DEFAULT_MODEL_DIR = (
    Path(__file__).resolve().parent.parent.parent / "data" / "vvm_models"
)

Backend = Literal["tflite", "onnx", "sklearn", "cpu"]


class VVMClassifier:
    def __init__(
        self,
        backend: Backend = "tflite",
        model_dir: str | Path = _DEFAULT_MODEL_DIR,
    ) -> None:
        self.backend = backend
        self.model_dir = Path(model_dir)
        self._loaded = False
        self._interpreter = None
        self._onnx_session = None
        self._sklearn_model = None
        self._load_model()

    def _load_model(self) -> None:
        if self.backend == "tflite":
            self._try_load_tflite()
        elif self.backend == "onnx":
            self._try_load_onnx()
        elif self.backend == "sklearn":
            self._try_load_sklearn()
        else:
            self._loaded = True
            logger.info("VVM placeholder model ready (CPU)")

    def _try_load_tflite(self) -> None:
        tflite_path = self.model_dir / "vvm_classifier.tflite"
        if not tflite_path.exists():
            logger.warning(
                "TFLite model not found at %s, trying ONNX fallback", tflite_path
            )
            self.backend = "onnx"
            self._try_load_onnx()
            return

        try:
            try:
                import tflite_runtime.interpreter as tflite

                self._interpreter = tflite.Interpreter(model_path=str(tflite_path))
            except ImportError:
                import tensorflow as tf

                self._interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
            self._interpreter.allocate_tensors()
            self._loaded = True
            logger.info("TFLite VVM model loaded from %s", tflite_path)
        except Exception:
            logger.warning("Failed to load TFLite model, trying ONNX fallback")
            self.backend = "onnx"
            self._try_load_onnx()

    def _try_load_onnx(self) -> None:
        onnx_path = self.model_dir / "vvm_classifier.onnx"
        if not onnx_path.exists():
            logger.warning(
                "ONNX model not found at %s, trying sklearn fallback", onnx_path
            )
            self.backend = "sklearn"
            self._try_load_sklearn()
            return

        try:
            import onnxruntime as ort

            self._onnx_session = ort.InferenceSession(str(onnx_path))
            self._loaded = True
            logger.info("ONNX VVM model loaded from %s", onnx_path)
        except ImportError:
            logger.warning("onnxruntime not installed, trying sklearn fallback")
            self.backend = "sklearn"
            self._try_load_sklearn()

    def _try_load_sklearn(self) -> None:
        pkl_path = self.model_dir / "vvm_rf_model.pkl"
        if not pkl_path.exists():
            logger.warning(
                "sklearn model not found at %s, falling back to placeholder", pkl_path
            )
            self.backend = "cpu"
            self._loaded = True
            return

        try:
            with open(pkl_path, "rb") as f:
                self._sklearn_model = pickle.load(f)
            self._loaded = True
            logger.info("sklearn VVM model loaded from %s", pkl_path)
        except Exception:
            logger.warning("Failed to load sklearn model, falling back to placeholder")
            self.backend = "cpu"
            self._loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def predict(self, raw_bytes: bytes) -> tuple[VVMStage, float]:
        """Classify a VVM image from raw bytes. Returns (stage, confidence)."""
        img = load_image(raw_bytes)

        if self.backend == "tflite" and self._interpreter is not None:
            return self._predict_tflite(preprocess(img))
        if self.backend == "onnx" and self._onnx_session is not None:
            return self._predict_onnx(img)
        if self.backend == "sklearn" and self._sklearn_model is not None:
            return self._predict_sklearn(img)
        return self._predict_placeholder(preprocess(img))

    def _predict_tflite(self, tensor: np.ndarray) -> tuple[VVMStage, float]:
        inp = self._interpreter.get_input_details()
        out = self._interpreter.get_output_details()
        input_tensor = tensor.astype(inp[0]["dtype"])
        self._interpreter.set_tensor(inp[0]["index"], input_tensor)
        self._interpreter.invoke()
        output = self._interpreter.get_tensor(out[0]["index"])[0]
        probs = _softmax(output.astype(np.float32))
        idx = int(np.argmax(probs))
        return VVM_LABELS[idx], float(probs[idx])

    def _predict_onnx(self, img) -> tuple[VVMStage, float]:
        arr = np.asarray(img.resize(TARGET_SIZE), dtype=np.float32) / 255.0
        nchw = np.expand_dims(arr, 0).transpose(0, 3, 1, 2)
        input_name = self._onnx_session.get_inputs()[0].name
        logits = self._onnx_session.run(None, {input_name: nchw})[0][0]
        probs = _softmax(logits.astype(np.float32))
        idx = int(np.argmax(probs))
        return VVM_LABELS[idx], float(probs[idx])

    def _predict_sklearn(self, img) -> tuple[VVMStage, float]:
        from app.ml.vvm_train import _extract_features

        features = _extract_features(img).reshape(1, -1)
        probs = self._sklearn_model.predict_proba(features)[0]
        idx = int(np.argmax(probs))
        return VVM_LABELS[idx], float(probs[idx])

    def _predict_placeholder(self, tensor: np.ndarray) -> tuple[VVMStage, float]:
        np.random.seed(int.from_bytes(tensor.tobytes()[:4], "big") % (2**31))
        logits = np.random.dirichlet([2.0, 1.0, 0.5, 0.3])
        idx = int(np.argmax(logits))
        return VVM_LABELS[idx], float(logits[idx])


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


_classifier: VVMClassifier | None = None


def get_classifier(
    backend: Backend = "tflite",
    model_dir: str | Path | None = None,
) -> VVMClassifier:
    """Return the singleton VVMClassifier, creating it on first call."""
    global _classifier
    if _classifier is None:
        _classifier = VVMClassifier(
            backend=backend,
            model_dir=model_dir or _DEFAULT_MODEL_DIR,
        )
    return _classifier
