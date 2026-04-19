"""Pydantic request/response models for vision endpoints."""

from __future__ import annotations

import enum

from pydantic import BaseModel, Field


class VVMStage(str, enum.Enum):
    stage_1 = "stage_1"
    stage_2 = "stage_2"
    stage_3 = "stage_3"
    stage_4 = "stage_4"


VVM_LABELS = [VVMStage.stage_1, VVMStage.stage_2, VVMStage.stage_3, VVMStage.stage_4]


class VVMScanResult(BaseModel):
    classification: VVMStage
    confidence: float = Field(ge=0.0, le=1.0)
    image_hash: str
    usable: bool = Field(description="True if vaccine is still usable (stage 1 or 2)")


class VVMScanResponse(BaseModel):
    result: VVMScanResult
    model_version: str


class VVMBatchItem(BaseModel):
    filename: str
    result: VVMScanResult


class VVMBatchResponse(BaseModel):
    results: list[VVMBatchItem]
    model_version: str
    total: int


# ---------------------------------------------------------------------------
# Equipment inspection schemas
# ---------------------------------------------------------------------------


class EquipmentType(str, enum.Enum):
    refrigerator = "refrigerator"
    cold_box = "cold_box"
    vaccine_carrier = "vaccine_carrier"
    ice_pack = "ice_pack"
    temperature_monitor = "temperature_monitor"


EQUIPMENT_TYPE_LABELS = [
    EquipmentType.refrigerator,
    EquipmentType.cold_box,
    EquipmentType.vaccine_carrier,
    EquipmentType.ice_pack,
    EquipmentType.temperature_monitor,
]


class EquipmentCondition(str, enum.Enum):
    operational = "operational"
    needs_maintenance = "needs_maintenance"
    damaged = "damaged"
    non_functional = "non_functional"


EQUIPMENT_CONDITION_LABELS = [
    EquipmentCondition.operational,
    EquipmentCondition.needs_maintenance,
    EquipmentCondition.damaged,
    EquipmentCondition.non_functional,
]


class InspectionIssue(str, enum.Enum):
    rust = "rust"
    damage = "damage"
    seal_degradation = "seal_degradation"
    temperature_display_error = "temperature_display_error"
    power_indicator_off = "power_indicator_off"


class InspectionResult(BaseModel):
    equipment_type: EquipmentType = Field(
        description="Detected type of cold chain equipment"
    )
    condition: EquipmentCondition = Field(
        description="Overall operational condition assessment"
    )
    issues: list[InspectionIssue] = Field(
        default_factory=list,
        description="List of visible issues detected in the image",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Mean confidence across type and condition predictions",
    )
    image_hash: str = Field(description="SHA-256 hex digest of the uploaded image")
    requires_action: bool = Field(
        description="True when condition is not operational"
    )
    inference_backend: str = Field(
        description="Backend used for inference: onnx | sklearn | heuristic"
    )


class EquipmentInspectionResponse(BaseModel):
    result: InspectionResult
    model_version: str


# Legacy flat schema kept for backward-compat with any existing callers
class EquipmentInspectionResult(BaseModel):
    status: str
    details: str
    image_hash: str


class ModelStatusEntry(BaseModel):
    name: str
    version: str
    loaded: bool
    backend: str


class ModelStatusResponse(BaseModel):
    models: list[ModelStatusEntry]
