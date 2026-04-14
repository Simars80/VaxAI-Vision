"""Pydantic request/response schemas for the AR stock counter."""

from __future__ import annotations

import enum
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SessionStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    reconciling = "reconciling"
    complete = "complete"
    cancelled = "cancelled"


# ── Requests ─────────────────────────────────────────────────────────────────


class CreateSessionRequest(BaseModel):
    facility_id: str = Field(..., max_length=255)
    facility_name: str | None = Field(None, max_length=512)
    notes: str | None = None


class FrameDetection(BaseModel):
    product_code: str = Field(..., max_length=128)
    product_name: str | None = Field(None, max_length=512)
    quantity: int = Field(1, ge=1)
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    bounding_box: dict | None = None


class SubmitFrameRequest(BaseModel):
    frame_index: int = Field(..., ge=0)
    detections: list[FrameDetection] = Field(..., min_length=1)


# ── Responses ────────────────────────────────────────────────────────────────


class DetectionOut(BaseModel):
    id: UUID
    frame_index: int
    product_code: str
    product_name: str | None
    quantity: int
    confidence: float
    bounding_box: dict | None
    detected_at: datetime

    model_config = {"from_attributes": True}


class ProductCount(BaseModel):
    product_code: str
    product_name: str | None
    scanned_count: int


class SessionOut(BaseModel):
    id: UUID
    facility_id: str
    facility_name: str | None
    status: SessionStatus
    frame_count: int
    product_count: int
    notes: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SessionDetailOut(SessionOut):
    running_counts: list[ProductCount] = []


class SessionCreateResponse(BaseModel):
    session: SessionOut


class FrameSubmitResponse(BaseModel):
    session_id: UUID
    frame_index: int
    detections_added: int
    running_counts: list[ProductCount]


class DiscrepancyItem(BaseModel):
    product_code: str
    product_name: str | None
    scanned_count: int
    system_count: float
    difference: float
    status: str  # "match" | "over" | "under"


class ReconciliationResponse(BaseModel):
    session_id: UUID
    facility_id: str
    total_products_scanned: int
    total_discrepancies: int
    items: list[DiscrepancyItem]
    reconciled_at: datetime


class ModelWeightsResponse(BaseModel):
    name: str
    version: str
    format: str
    size_bytes: int
    download_url: str | None = None
