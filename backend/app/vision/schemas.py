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


class EquipmentInspectionResult(BaseModel):
    status: str
    details: str
    image_hash: str


class EquipmentInspectionResponse(BaseModel):
    result: EquipmentInspectionResult
    model_version: str


class ModelStatusEntry(BaseModel):
    name: str
    version: str
    loaded: bool
    backend: str


class ModelStatusResponse(BaseModel):
    models: list[ModelStatusEntry]
