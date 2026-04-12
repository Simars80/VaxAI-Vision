"""Vision API — VVM vaccine vial classification and equipment inspection."""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.vision_scan import VVMStageDB, VisionScanResult
from app.vision.inference import MODEL_VERSION, get_classifier
from app.vision.preprocessing import image_hash
from app.vision.schemas import (
    EquipmentInspectionResponse,
    EquipmentInspectionResult,
    ModelStatusEntry,
    ModelStatusResponse,
    VVMBatchItem,
    VVMBatchResponse,
    VVMScanResponse,
    VVMScanResult,
    VVMStage,
)

router = APIRouter(prefix="/vision", tags=["vision"])


@router.post("/vvm/scan", summary="Classify a single VVM image")
async def vvm_scan(
    image: UploadFile = File(...),
    facility_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
) -> VVMScanResponse:
    raw = await image.read()
    classifier = get_classifier()
    stage, confidence = classifier.predict(raw)
    img_hash = image_hash(raw)

    record = VisionScanResult(
        id=uuid.uuid4(),
        facility_id=facility_id,
        image_hash=img_hash,
        classification=VVMStageDB(stage.value),
        confidence=confidence,
        scan_type="vvm",
    )
    db.add(record)
    await db.flush()

    return VVMScanResponse(
        result=VVMScanResult(
            classification=stage,
            confidence=round(confidence, 4),
            image_hash=img_hash,
            usable=stage in (VVMStage.stage_1, VVMStage.stage_2),
        ),
        model_version=MODEL_VERSION,
    )


@router.post("/vvm/batch", summary="Classify multiple VVM images")
async def vvm_batch_scan(
    images: list[UploadFile] = File(...),
    facility_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
) -> VVMBatchResponse:
    classifier = get_classifier()
    items: list[VVMBatchItem] = []

    for upload in images:
        raw = await upload.read()
        stage, confidence = classifier.predict(raw)
        img_hash = image_hash(raw)

        record = VisionScanResult(
            id=uuid.uuid4(),
            facility_id=facility_id,
            image_hash=img_hash,
            classification=VVMStageDB(stage.value),
            confidence=confidence,
            scan_type="vvm",
        )
        db.add(record)

        items.append(
            VVMBatchItem(
                filename=upload.filename or "unknown",
                result=VVMScanResult(
                    classification=stage,
                    confidence=round(confidence, 4),
                    image_hash=img_hash,
                    usable=stage in (VVMStage.stage_1, VVMStage.stage_2),
                ),
            )
        )

    await db.flush()

    return VVMBatchResponse(
        results=items,
        model_version=MODEL_VERSION,
        total=len(items),
    )


@router.post("/equipment/inspect", summary="Inspect cold chain equipment condition")
async def equipment_inspect(
    image: UploadFile = File(...),
    facility_id: str = Form(...),
) -> EquipmentInspectionResponse:
    raw = await image.read()
    img_hash = image_hash(raw)

    return EquipmentInspectionResponse(
        result=EquipmentInspectionResult(
            status="operational",
            details="Placeholder inspection — real model not yet deployed.",
            image_hash=img_hash,
        ),
        model_version=MODEL_VERSION,
    )


@router.get("/scans/history", summary="List recent scan results")
async def scan_history(
    facility_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(VisionScanResult).order_by(VisionScanResult.scanned_at.desc()).limit(limit)
    if facility_id:
        stmt = stmt.where(VisionScanResult.facility_id == facility_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return {
        "scans": [
            {
                "id": str(r.id),
                "facility_id": r.facility_id,
                "facility_name": f"Facility {r.facility_id}",
                "classification": r.classification.value,
                "confidence": r.confidence,
                "usable": r.classification in (VVMStageDB.stage_1, VVMStageDB.stage_2),
                "scan_type": r.scan_type,
                "scanned_at": r.scanned_at.isoformat() if r.scanned_at else None,
            }
            for r in rows
        ],
        "total": len(rows),
    }


@router.get("/models/status", summary="Get loaded model status")
async def model_status() -> ModelStatusResponse:
    classifier = get_classifier()
    return ModelStatusResponse(
        models=[
            ModelStatusEntry(
                name="vvm-classifier",
                version=MODEL_VERSION,
                loaded=classifier.is_loaded,
                backend=classifier.backend,
            ),
            ModelStatusEntry(
                name="equipment-inspector",
                version=MODEL_VERSION,
                loaded=False,
                backend="placeholder",
            ),
        ]
    )
