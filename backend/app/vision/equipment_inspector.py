"""Equipment inspection inference engine for cold chain equipment.

Supports three backends (tried in order):
  - **onnx** — loads a trained ``.onnx`` model for inference.
  - **sklearn** — loads a pickled RandomForest as a lightweight fallback.
  - **heuristic** — deterministic image-analysis fallback so the API works
    before any trained weights exist.
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Literal

import numpy as np
from PIL import Image

from app.vision.preprocessing import load_image
from app.vision.schemas import (
    EQUIPMENT_TYPE_LABELS,
    EQUIPMENT_CONDITION_LABELS,
    EquipmentCondition,
    EquipmentType,
    InspectionIssue,
)

logger = logging.getLogger(__name__)

_DEFAULT_MODEL_DIR = (
    Path(__file__).resolve().parent.parent.parent / "data" / "equipment_models"
)

Backend = Literal["onnx", "sklearn", "heuristic"]

# Indices for type and condition in the combined feature vector output
_N_TYPES = len(EquipmentType)
_N_CONDITIONS = len(EquipmentCondition)


class EquipmentInspector:
    """Cold chain equipment inspector.

    Classifies equipment type, condition, and visible issues from a single image.
    Falls back gracefully from ONNX → sklearn → heuristic when weights are missing.
    """

    def __init__(
        self,
        backend: Backend = "onnx",
        model_dir: str | Path = _DEFAULT_MODEL_DIR,
    ) -> None:
        self.backend = backend
        self.model_dir = Path(model_dir)
        self._loaded = False
        self._onnx_session = None
        self._sklearn_type_model = None
        self._sklearn_condition_model = None
        self._load_model()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _load_model(self) -> None:
        if self.backend == "onnx":
            self._try_load_onnx()
        elif self.backend == "sklearn":
            self._try_load_sklearn()
        else:
            self._loaded = True
            logger.info("Equipment inspector heuristic mode ready")

    def _try_load_onnx(self) -> None:
        onnx_path = self.model_dir / "equipment_inspector.onnx"
        if not onnx_path.exists():
            logger.warning(
                "ONNX model not found at %s, trying sklearn fallback", onnx_path
            )
            self.backend = "sklearn"
            self._try_load_sklearn()
            return

        try:
            import onnxruntime as ort

            self._onnx_session = ort.InferenceSession(
                str(onnx_path),
                providers=["CPUExecutionProvider"],
            )
            self._loaded = True
            logger.info("ONNX equipment inspector loaded from %s", onnx_path)
        except ImportError:
            logger.warning("onnxruntime not installed, trying sklearn fallback")
            self.backend = "sklearn"
            self._try_load_sklearn()
        except Exception as exc:
            logger.warning("Failed to load ONNX model (%s), trying sklearn fallback", exc)
            self.backend = "sklearn"
            self._try_load_sklearn()

    def _try_load_sklearn(self) -> None:
        type_path = self.model_dir / "equipment_type_rf.pkl"
        cond_path = self.model_dir / "equipment_condition_rf.pkl"

        if not type_path.exists() or not cond_path.exists():
            logger.warning(
                "sklearn models not found in %s, falling back to heuristic", self.model_dir
            )
            self.backend = "heuristic"
            self._loaded = True
            return

        try:
            with open(type_path, "rb") as f:
                self._sklearn_type_model = pickle.load(f)
            with open(cond_path, "rb") as f:
                self._sklearn_condition_model = pickle.load(f)
            self._loaded = True
            logger.info("sklearn equipment models loaded from %s", self.model_dir)
        except Exception as exc:
            logger.warning(
                "Failed to load sklearn models (%s), falling back to heuristic", exc
            )
            self.backend = "heuristic"
            self._loaded = True

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def predict(
        self, raw_bytes: bytes
    ) -> tuple[EquipmentType, EquipmentCondition, list[InspectionIssue], float]:
        """Classify equipment from raw image bytes.

        Returns (equipment_type, condition, issues, confidence).
        """
        img = load_image(raw_bytes)

        if self.backend == "onnx" and self._onnx_session is not None:
            return self._predict_onnx(img)
        if self.backend == "sklearn" and self._sklearn_type_model is not None:
            return self._predict_sklearn(img)
        return self._predict_heuristic(img)

    # ------------------------------------------------------------------
    # Backend implementations
    # ------------------------------------------------------------------

    def _predict_onnx(
        self, img: Image.Image
    ) -> tuple[EquipmentType, EquipmentCondition, list[InspectionIssue], float]:
        from app.ml.equipment_train import _extract_features

        features = _extract_features(img).reshape(1, -1).astype(np.float32)
        input_name = self._onnx_session.get_inputs()[0].name
        outputs = self._onnx_session.run(None, {input_name: features})

        # Expect two output heads: [type_probs, condition_probs]
        type_probs = _softmax(outputs[0][0].astype(np.float32))
        cond_probs = _softmax(outputs[1][0].astype(np.float32))

        type_idx = int(np.argmax(type_probs))
        cond_idx = int(np.argmax(cond_probs))
        confidence = float((type_probs[type_idx] + cond_probs[cond_idx]) / 2)

        equipment_type = EQUIPMENT_TYPE_LABELS[type_idx]
        condition = EQUIPMENT_CONDITION_LABELS[cond_idx]
        issues = _derive_issues(img, condition, confidence)

        return equipment_type, condition, issues, confidence

    def _predict_sklearn(
        self, img: Image.Image
    ) -> tuple[EquipmentType, EquipmentCondition, list[InspectionIssue], float]:
        from app.ml.equipment_train import _extract_features

        features = _extract_features(img).reshape(1, -1)

        type_probs = self._sklearn_type_model.predict_proba(features)[0]
        cond_probs = self._sklearn_condition_model.predict_proba(features)[0]

        type_idx = int(np.argmax(type_probs))
        cond_idx = int(np.argmax(cond_probs))
        confidence = float((type_probs[type_idx] + cond_probs[cond_idx]) / 2)

        equipment_type = EQUIPMENT_TYPE_LABELS[type_idx]
        condition = EQUIPMENT_CONDITION_LABELS[cond_idx]
        issues = _derive_issues(img, condition, confidence)

        return equipment_type, condition, issues, confidence

    def _predict_heuristic(
        self, img: Image.Image
    ) -> tuple[EquipmentType, EquipmentCondition, list[InspectionIssue], float]:
        """Rule-based fallback using image analysis when no trained model exists."""
        arr = np.asarray(img.resize((224, 224)), dtype=np.float32) / 255.0

        # --- Equipment type detection via color and shape heuristics ---
        mean_r = float(arr[:, :, 0].mean())
        mean_g = float(arr[:, :, 1].mean())
        mean_b = float(arr[:, :, 2].mean())
        brightness = (mean_r + mean_g + mean_b) / 3.0

        # Edge density as a proxy for structural complexity
        gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        grad_x = np.abs(np.diff(gray, axis=1)).mean()
        grad_y = np.abs(np.diff(gray, axis=0)).mean()
        edge_density = float((grad_x + grad_y) / 2)

        # Color variance as proxy for display/indicator presence
        color_variance = float(arr.std())

        # Determine equipment type from color profile
        # Refrigerators: typically white/light grey, high edge density
        # Cold boxes: typically blue/white, moderate complexity
        # Vaccine carriers: typically blue/orange, compact
        # Ice packs: typically blue/white, low complexity
        # Temperature monitors: small, high color variance from display
        seed_bytes = arr.tobytes()[:8]
        rng = np.random.RandomState(int.from_bytes(seed_bytes, "big") % (2**31))

        if brightness > 0.75 and edge_density > 0.04:
            type_probs = np.array([0.55, 0.15, 0.10, 0.10, 0.10])  # refrigerator
        elif mean_b > mean_r and mean_b > mean_g and brightness < 0.65:
            type_probs = np.array([0.10, 0.50, 0.20, 0.15, 0.05])  # cold_box
        elif edge_density < 0.02 and brightness > 0.60:
            type_probs = np.array([0.05, 0.10, 0.05, 0.70, 0.10])  # ice_pack
        elif color_variance > 0.15 and brightness < 0.55:
            type_probs = np.array([0.05, 0.10, 0.05, 0.05, 0.75])  # temp monitor
        else:
            type_probs = np.array([0.15, 0.20, 0.45, 0.15, 0.05])  # vaccine_carrier

        # Add small random noise so repeated identical images vary slightly
        noise = rng.dirichlet([10.0] * _N_TYPES) * 0.05
        type_probs = type_probs + noise
        type_probs /= type_probs.sum()

        # --- Condition detection via degradation signals ---
        # Rust signal: elevated red in mid-range, low blue
        rust_signal = float(np.clip(mean_r - mean_b - 0.1, 0, 1))
        # Darkness/discoloration signal
        dark_signal = float(1.0 - brightness)
        # High edge noise can indicate surface damage
        edge_noise = float(np.clip(edge_density - 0.05, 0, 1))

        degradation = rust_signal * 0.4 + dark_signal * 0.3 + edge_noise * 0.3

        if degradation < 0.15:
            cond_probs = np.array([0.75, 0.15, 0.07, 0.03])  # operational
        elif degradation < 0.30:
            cond_probs = np.array([0.20, 0.60, 0.15, 0.05])  # needs_maintenance
        elif degradation < 0.50:
            cond_probs = np.array([0.05, 0.20, 0.65, 0.10])  # damaged
        else:
            cond_probs = np.array([0.02, 0.08, 0.20, 0.70])  # non_functional

        noise_c = rng.dirichlet([10.0] * _N_CONDITIONS) * 0.05
        cond_probs = cond_probs + noise_c
        cond_probs /= cond_probs.sum()

        type_idx = int(np.argmax(type_probs))
        cond_idx = int(np.argmax(cond_probs))
        confidence = float((type_probs[type_idx] + cond_probs[cond_idx]) / 2)

        equipment_type = EQUIPMENT_TYPE_LABELS[type_idx]
        condition = EQUIPMENT_CONDITION_LABELS[cond_idx]
        issues = _derive_issues(img, condition, confidence)

        return equipment_type, condition, issues, round(confidence, 4)


# ------------------------------------------------------------------
# Shared helpers
# ------------------------------------------------------------------


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - np.max(x))
    return e / e.sum()


def _derive_issues(
    img: Image.Image,
    condition: EquipmentCondition,
    confidence: float,
) -> list[InspectionIssue]:
    """Infer likely visible issues from condition and pixel statistics."""
    arr = np.asarray(img.resize((224, 224)), dtype=np.float32) / 255.0
    issues: list[InspectionIssue] = []

    mean_r = float(arr[:, :, 0].mean())
    mean_g = float(arr[:, :, 1].mean())
    mean_b = float(arr[:, :, 2].mean())
    brightness = (mean_r + mean_g + mean_b) / 3.0

    # Rust: high red relative to blue in lower half of image
    lower = arr[112:, :, :]
    rust_score = float(lower[:, :, 0].mean() - lower[:, :, 2].mean())
    if rust_score > 0.12 or condition in (
        EquipmentCondition.damaged,
        EquipmentCondition.non_functional,
    ):
        issues.append(InspectionIssue.rust)

    # Seal degradation: mid-region variance implies irregular edges
    mid = arr[56:168, 56:168, :]
    if float(mid.std()) > 0.18 and condition != EquipmentCondition.operational:
        issues.append(InspectionIssue.seal_degradation)

    # Damage: general surface brightness irregularity
    gray = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
    local_std = float(gray.std())
    if local_std > 0.20 and condition in (
        EquipmentCondition.damaged,
        EquipmentCondition.non_functional,
    ):
        issues.append(InspectionIssue.damage)

    # Temperature display error: very dark image patches (no display glow)
    if brightness < 0.35 and condition != EquipmentCondition.operational:
        issues.append(InspectionIssue.temperature_display_error)

    # Power indicator off: uniformly dark with no bright accent
    bright_pixels = float((arr > 0.85).mean())
    if bright_pixels < 0.01 and condition == EquipmentCondition.non_functional:
        issues.append(InspectionIssue.power_indicator_off)

    return issues


# ------------------------------------------------------------------
# Singleton
# ------------------------------------------------------------------

_inspector: EquipmentInspector | None = None


def get_inspector(
    backend: Backend = "onnx",
    model_dir: str | Path | None = None,
) -> EquipmentInspector:
    """Return the singleton EquipmentInspector, creating it on first call."""
    global _inspector
    if _inspector is None:
        _inspector = EquipmentInspector(
            backend=backend,
            model_dir=model_dir or _DEFAULT_MODEL_DIR,
        )
    return _inspector
