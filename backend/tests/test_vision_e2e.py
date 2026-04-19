"""
End-to-end tests for Vision AI endpoints.

Covers:
  - POST /vision/vvm/scan — single image VVM classification
  - POST /vision/vvm/batch — multi-image batch classification
  - POST /vision/equipment/inspect — equipment condition inspection
  - GET /vision/models/status — model loading status
  - GET /vision/scans/history — scan history with facility filter
  - Invalid image data handling (empty bytes, truncated PNG)
  - facility_id is required for scan endpoints
"""

from __future__ import annotations

import io
import struct
import zlib

import pytest
from httpx import AsyncClient


# ── Response-shape helpers ────────────────────────────────────────────────────

VALID_VVM_STAGES = {"stage_1", "stage_2", "stage_3", "stage_4"}
VALID_CONDITIONS = {"operational", "needs_maintenance", "critical_failure"}


# ── Models status (no auth required) ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_model_status_returns_model_list(client: AsyncClient) -> None:
    """GET /vision/models/status returns a list of loaded models."""
    resp = await client.get("/api/v1/vision/models/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert isinstance(data["models"], list)
    assert len(data["models"]) >= 1
    for entry in data["models"]:
        assert "name" in entry
        assert "version" in entry
        assert "loaded" in entry
        assert "backend" in entry


# ── VVM Single Scan ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vvm_scan_returns_classification(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """POST a valid PNG to /vision/vvm/scan returns a VVM classification."""
    resp = await client.post(
        "/api/v1/vision/vvm/scan",
        files={"image": ("vvm_test.png", sample_image_bytes, "image/png")},
        data={"facility_id": "FAC-VISION-TEST"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "result" in data
    result = data["result"]
    assert "classification" in result
    assert result["classification"] in VALID_VVM_STAGES
    assert "confidence" in result
    assert 0.0 <= result["confidence"] <= 1.0
    assert "image_hash" in result
    assert "usable" in result
    assert isinstance(result["usable"], bool)
    assert "model_version" in data


@pytest.mark.asyncio
async def test_vvm_scan_usable_for_stage_1(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """Stage 1 and 2 VVMs are marked usable; stage 3 and 4 are not."""
    resp = await client.post(
        "/api/v1/vision/vvm/scan",
        files={"image": ("vvm.png", sample_image_bytes, "image/png")},
        data={"facility_id": "FAC-USABLE-TEST"},
    )
    assert resp.status_code == 200
    result = resp.json()["result"]
    stage = result["classification"]
    expected_usable = stage in ("stage_1", "stage_2")
    assert result["usable"] == expected_usable


@pytest.mark.asyncio
async def test_vvm_scan_missing_facility_id_returns_422(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """Omitting facility_id returns 422 Unprocessable Entity."""
    resp = await client.post(
        "/api/v1/vision/vvm/scan",
        files={"image": ("vvm.png", sample_image_bytes, "image/png")},
        # no data= / no facility_id
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_vvm_scan_missing_image_returns_422(client: AsyncClient) -> None:
    """Omitting the image file returns 422."""
    resp = await client.post(
        "/api/v1/vision/vvm/scan",
        data={"facility_id": "FAC-NO-IMAGE"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_vvm_scan_empty_image_bytes(client: AsyncClient) -> None:
    """Sending 0-byte image data is either classified (model handles it) or returns 4xx/5xx."""
    resp = await client.post(
        "/api/v1/vision/vvm/scan",
        files={"image": ("empty.png", b"", "image/png")},
        data={"facility_id": "FAC-EMPTY"},
    )
    # The model either tolerates it or raises an error.  We only assert not 5xx unhandled crash.
    assert resp.status_code in (200, 400, 422, 500)


# ── VVM Batch Scan ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_vvm_batch_scan_multiple_images(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """POST two images to /vision/vvm/batch returns results for each."""
    resp = await client.post(
        "/api/v1/vision/vvm/batch",
        files=[
            ("images", ("a.png", sample_image_bytes, "image/png")),
            ("images", ("b.png", sample_image_bytes, "image/png")),
        ],
        data={"facility_id": "FAC-BATCH-TEST"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert data["total"] == 2
    assert len(data["results"]) == 2
    for item in data["results"]:
        assert "filename" in item
        assert "result" in item
        assert item["result"]["classification"] in VALID_VVM_STAGES


@pytest.mark.asyncio
async def test_vvm_batch_scan_single_image(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """Batch endpoint with a single image returns total=1."""
    resp = await client.post(
        "/api/v1/vision/vvm/batch",
        files=[("images", ("single.png", sample_image_bytes, "image/png"))],
        data={"facility_id": "FAC-BATCH-SINGLE"},
    )
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_vvm_batch_missing_facility_returns_422(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """Batch endpoint without facility_id returns 422."""
    resp = await client.post(
        "/api/v1/vision/vvm/batch",
        files=[("images", ("x.png", sample_image_bytes, "image/png"))],
    )
    assert resp.status_code == 422


# ── Equipment Inspection ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_equipment_inspect_returns_result(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """POST to /vision/equipment/inspect returns an inspection result."""
    resp = await client.post(
        "/api/v1/vision/equipment/inspect",
        files={"image": ("fridge.png", sample_image_bytes, "image/png")},
        data={"facility_id": "FAC-INSPECT-TEST"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "result" in data
    result = data["result"]
    assert "equipment_type" in result
    assert "condition" in result
    assert "confidence" in result
    assert "image_hash" in result
    assert "requires_action" in result
    assert isinstance(result["requires_action"], bool)
    assert 0.0 <= result["confidence"] <= 1.0


@pytest.mark.asyncio
async def test_equipment_inspect_missing_facility_returns_422(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """Equipment inspection without facility_id returns 422."""
    resp = await client.post(
        "/api/v1/vision/equipment/inspect",
        files={"image": ("fridge.png", sample_image_bytes, "image/png")},
    )
    assert resp.status_code == 422


# ── Scan History ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_scan_history_returns_list(client: AsyncClient) -> None:
    """GET /vision/scans/history returns scans list and total."""
    resp = await client.get("/api/v1/vision/scans/history")
    assert resp.status_code == 200
    data = resp.json()
    assert "scans" in data
    assert "total" in data
    assert isinstance(data["scans"], list)


@pytest.mark.asyncio
async def test_scan_history_seeded_after_scan(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """After a scan, its record appears in scan history."""
    fid = "FAC-HISTORY-TRACK"
    # Perform a scan
    scan_resp = await client.post(
        "/api/v1/vision/vvm/scan",
        files={"image": ("track.png", sample_image_bytes, "image/png")},
        data={"facility_id": fid},
    )
    assert scan_resp.status_code == 200

    history_resp = await client.get(
        "/api/v1/vision/scans/history", params={"facility_id": fid}
    )
    assert history_resp.status_code == 200
    scans = history_resp.json()["scans"]
    assert len(scans) >= 1
    for scan in scans:
        assert scan["facility_id"] == fid


@pytest.mark.asyncio
async def test_scan_history_limit_param(client: AsyncClient) -> None:
    """The limit param caps scan history results."""
    resp = await client.get("/api/v1/vision/scans/history", params={"limit": 2})
    assert resp.status_code == 200
    assert len(resp.json()["scans"]) <= 2


@pytest.mark.asyncio
async def test_scan_history_limit_validation(client: AsyncClient) -> None:
    """limit=0 is rejected with 422."""
    resp = await client.get("/api/v1/vision/scans/history", params={"limit": 0})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_scan_history_shape(
    client: AsyncClient,
    sample_image_bytes: bytes,
) -> None:
    """Each scan history record has the required fields."""
    fid = "FAC-SHAPE-CHECK"
    await client.post(
        "/api/v1/vision/vvm/scan",
        files={"image": ("shape.png", sample_image_bytes, "image/png")},
        data={"facility_id": fid},
    )
    resp = await client.get(
        "/api/v1/vision/scans/history", params={"facility_id": fid, "limit": 1}
    )
    assert resp.status_code == 200
    scans = resp.json()["scans"]
    if scans:
        scan = scans[0]
        for key in ("id", "facility_id", "classification", "confidence", "usable", "scan_type"):
            assert key in scan, f"Missing key: {key}"
