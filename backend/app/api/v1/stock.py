"""AR Stock Counter API — session management, frame submission, ML detection, reconciliation."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.vision.ar.reconciliation import reconcile_session
from app.vision.ar.schemas import (
    CreateSessionRequest,
    DiscrepancyItem,
    FrameDetection,
    FrameSubmitResponse,
    ModelWeightsResponse,
    ReconciliationResponse,
    SessionCreateResponse,
    SessionDetailOut,
    SessionOut,
    SubmitFrameRequest,
)
from app.vision.ar.session import (
    add_frame_detections,
    begin_reconciliation,
    complete_session,
    create_session,
    get_session,
)
from app.vision.ar.tracking import get_running_counts
from app.vision.stock_detector import MODEL_VERSION as DETECTOR_VERSION
from app.vision.stock_detector import get_stock_detector

router = APIRouter(prefix="/vision/stock", tags=["ar-stock-counter"])

_VISION_MODEL_DIR = Path(__file__).resolve().parents[2] / "vision" / "models"


@router.post(
    "/session",
    response_model=SessionCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new scan session",
)
async def create_scan_session(
    req: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> SessionCreateResponse:
    session = await create_session(db, req, operator_id=user.id)
    return SessionCreateResponse(session=SessionOut.model_validate(session))


@router.post(
    "/session/{session_id}/frame",
    response_model=FrameSubmitResponse,
    summary="Submit frame detections for a session",
)
async def submit_frame(
    session_id: uuid.UUID,
    req: SubmitFrameRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> FrameSubmitResponse:
    session = await get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    detections = await add_frame_detections(db, session, req)
    counts = await get_running_counts(db, session_id)

    return FrameSubmitResponse(
        session_id=session_id,
        frame_index=req.frame_index,
        detections_added=len(detections),
        running_counts=counts,
    )


@router.post(
    "/detect",
    summary="Run ML detection on a single image (no session required)",
)
async def detect_image(
    image: UploadFile = File(...),
    confidence: float = Form(0.25),
    _: User = Depends(get_current_active_user),
):
    """Run the YOLOv8 stock counter model on an uploaded image.

    Returns detected products with bounding boxes and confidence scores.
    No session is required — use this for one-off detection or testing.
    """
    raw = await image.read()
    detector = get_stock_detector()
    detections, inference_ms = detector.detect_with_timing(raw)

    filtered = [d for d in detections if d.score >= confidence]

    counts: dict[str, int] = {}
    for d in filtered:
        counts[d.class_name] = counts.get(d.class_name, 0) + 1

    return {
        "detections": [
            {
                "class_id": d.class_id,
                "class_name": d.class_name,
                "confidence": round(d.score, 4),
                "bbox": {
                    "x1": round(float(d.bbox[0]), 1),
                    "y1": round(float(d.bbox[1]), 1),
                    "x2": round(float(d.bbox[2]), 1),
                    "y2": round(float(d.bbox[3]), 1),
                },
            }
            for d in filtered
        ],
        "product_counts": counts,
        "total_items": len(filtered),
        "inference_ms": round(inference_ms, 1),
        "model_version": DETECTOR_VERSION,
        "model_backend": detector.backend,
    }


@router.post(
    "/session/{session_id}/detect-frame",
    summary="Upload a frame image, run ML detection, and save results to session",
)
async def detect_and_submit_frame(
    session_id: uuid.UUID,
    image: UploadFile = File(...),
    frame_index: int = Form(...),
    confidence: float = Form(0.25),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
):
    """Run YOLOv8 detection on an uploaded frame and persist results to the session.

    Combines ML inference with session tracking in a single call — the client
    uploads an image and gets back detections + running product counts.
    """
    session = await get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    raw = await image.read()
    detector = get_stock_detector()
    detections, inference_ms = detector.detect_with_timing(raw)
    filtered = [d for d in detections if d.score >= confidence]

    frame_detections = [
        FrameDetection(
            product_code=d.class_name,
            product_name=d.class_name.replace("_", " ").title(),
            quantity=1,
            confidence=d.score,
            bounding_box={
                "x1": round(float(d.bbox[0]), 1),
                "y1": round(float(d.bbox[1]), 1),
                "x2": round(float(d.bbox[2]), 1),
                "y2": round(float(d.bbox[3]), 1),
            },
        )
        for d in filtered
    ]

    if frame_detections:
        submit_req = SubmitFrameRequest(
            frame_index=frame_index,
            detections=frame_detections,
        )
        await add_frame_detections(db, session, submit_req)

    counts = await get_running_counts(db, session_id)

    return {
        "session_id": str(session_id),
        "frame_index": frame_index,
        "detections": [
            {
                "class_id": d.class_id,
                "class_name": d.class_name,
                "confidence": round(d.score, 4),
                "bbox": {
                    "x1": round(float(d.bbox[0]), 1),
                    "y1": round(float(d.bbox[1]), 1),
                    "x2": round(float(d.bbox[2]), 1),
                    "y2": round(float(d.bbox[3]), 1),
                },
            }
            for d in filtered
        ],
        "detections_saved": len(frame_detections),
        "running_counts": [c.model_dump() for c in counts],
        "inference_ms": round(inference_ms, 1),
        "model_version": DETECTOR_VERSION,
    }


@router.post(
    "/session/{session_id}/reconcile",
    response_model=ReconciliationResponse,
    summary="Finalize session and reconcile with inventory",
)
async def reconcile_scan_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> ReconciliationResponse:
    session = await get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        await begin_reconciliation(db, session)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    items, summary = await reconcile_session(db, session)
    await complete_session(db, session, summary)

    return ReconciliationResponse(
        session_id=session_id,
        facility_id=session.facility_id,
        total_products_scanned=session.product_count,
        total_discrepancies=summary["discrepancies"],
        items=items,
        reconciled_at=datetime.now(timezone.utc),
    )


@router.get(
    "/session/{session_id}",
    response_model=SessionDetailOut,
    summary="Get session status and running counts",
)
async def get_scan_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> SessionDetailOut:
    session = await get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    counts = await get_running_counts(db, session_id)
    out = SessionDetailOut.model_validate(session)
    out.running_counts = counts
    return out


@router.get(
    "/models/{name}",
    response_model=ModelWeightsResponse,
    summary="Get model weights metadata for client download",
)
async def get_model_weights(name: str) -> ModelWeightsResponse:
    known_models = {
        "vvm-classifier": {
            "files": ["vvm_classifier.tflite", "vvm_classifier.onnx", "vvm_rf_model.pkl"],
            "version": "1.0.0",
            "dir": Path(__file__).resolve().parents[3] / "data" / "vvm_models",
        },
        "stock-counter": {
            "files": [
                "stock_counter.onnx",
                "stock_counter_yolov8n.pt",
            ],
            "version": DETECTOR_VERSION,
            "dir": _VISION_MODEL_DIR,
        },
    }

    if name not in known_models:
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")

    model_info = known_models[name]
    model_file = None
    size_bytes = 0
    model_dir = model_info["dir"]

    for fname in model_info["files"]:
        fpath = model_dir / fname
        if fpath.exists():
            model_file = fname
            size_bytes = fpath.stat().st_size
            break

    fmt = "onnx"
    if model_file:
        fmt = model_file.rsplit(".", 1)[-1]

    return ModelWeightsResponse(
        name=name,
        version=model_info["version"],
        format=fmt,
        size_bytes=size_bytes,
        download_url=f"/api/v1/vision/stock/models/{name}/download" if model_file else None,
    )


@router.get(
    "/models/status",
    summary="Get stock counter model status",
)
async def stock_model_status():
    detector = get_stock_detector()
    return {
        "name": "stock-counter",
        "version": DETECTOR_VERSION,
        "loaded": detector.is_loaded,
        "backend": detector.backend,
        "classes": ["vaccine_vial", "syringe", "cold_box", "diluent", "ancillary_product"],
        "num_classes": 5,
    }
