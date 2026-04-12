"""Unified inference engine for VVM classification.

Supports CPU (NumPy placeholder) and TFLite backends. Ships with a
deterministic placeholder model so the API is fully functional before
real weights are trained.
"""

from __future__ import annotations

import logging
from typing import Literal

import numpy as np

from app.vision.preprocessing import load_image, preprocess
from app.vision.schemas import VVM_LABELS, VVMStage

logger = logging.getLogger(__name__)

MODEL_VERSION = "0.1.0-placeholder"


class VVMClassifier:
    def __init__(self, backend: Literal["cpu", "tflite"] = "cpu") -> None:
        self.backend = backend
        self._loaded = False
        self._load_model()

    def _load_model(self) -> None:
        if self.backend == "tflite":
            try:
                import tflite_runtime.interpreter as tflite

                self._interpreter = tflite.Interpreter(model_path="models/vvm.tflite")
                self._interpreter.allocate_tensors()
                self._loaded = True
                logger.info("TFLite VVM model loaded")
            except Exception:
                logger.warning("TFLite model not found, falling back to placeholder")
                self.backend = "cpu"
                self._loaded = True
        else:
            self._loaded = True
            logger.info("VVM placeholder model ready (CPU)")

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def predict(self, raw_bytes: bytes) -> tuple[VVMStage, float]:
        img = load_image(raw_bytes)
        tensor = preprocess(img)

        if self.backend == "tflite" and hasattr(self, "_interpreter"):
            return self._predict_tflite(tensor)
        return self._predict_placeholder(tensor)

    def _predict_placeholder(self, tensor: np.ndarray) -> tuple[VVMStage, float]:
        np.random.seed(int.from_bytes(tensor.tobytes()[:4], "big") % (2**31))
        logits = np.random.dirichlet([2.0, 1.0, 0.5, 0.3])
        idx = int(np.argmax(logits))
        return VVM_LABELS[idx], float(logits[idx])

    def _predict_tflite(self, tensor: np.ndarray) -> tuple[VVMStage, float]:
        inp = self._interpreter.get_input_details()
        out = self._interpreter.get_output_details()
        self._interpreter.set_tensor(inp[0]["index"], tensor)
        self._interpreter.invoke()
        probs = self._interpreter.get_tensor(out[0]["index"])[0]
        idx = int(np.argmax(probs))
        return VVM_LABELS[idx], float(probs[idx])


_classifier: VVMClassifier | None = None


def get_classifier() -> VVMClassifier:
    global _classifier
    if _classifier is None:
        _classifier = VVMClassifier(backend="cpu")
    return _classifier
