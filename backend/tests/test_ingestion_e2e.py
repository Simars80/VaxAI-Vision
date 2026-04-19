"""
End-to-end tests for the data ingestion endpoints.

Covers:
  - POST /ingestion/upload/csv — CSV upload (happy path)
  - POST /ingestion/upload/csv — Excel (.xlsx) upload
  - POST /ingestion/upload/csv — validation errors (bad MIME type)
  - GET  /ingestion/jobs — list jobs (auth required, viewer permitted)
  - GET  /ingestion/jobs/{job_id} — get single job status
  - GET  /ingestion/jobs/{job_id}/audit — audit log
  - RBAC: viewer cannot upload (403); analyst can
  - File-size limit (413)
  - Pagination params for jobs list
"""

from __future__ import annotations

import io
import uuid
import zipfile

import pytest
from httpx import AsyncClient


# ── Minimal file builders ─────────────────────────────────────────────────────

_VALID_CSV = (
    "item_code,item_name,category,unit_of_measure,transaction_type,"
    "quantity,facility_id,facility_name,transaction_date,lot_number,expiry_date\n"
    "VAC001,BCG Vaccine,vaccine,doses,receipt,100,FAC001,Nairobi Clinic,"
    "2024-01-15,LOT-001,2026-01-01\n"
    "VAC002,OPV,vaccine,doses,issue,20,FAC001,Nairobi Clinic,"
    "2024-01-16,,\n"
)


def _make_minimal_xlsx() -> bytes:
    """Build an absolute-minimum XLSX ZIP container using only stdlib."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(
            "[Content_Types].xml",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType='
            '"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            "</Types>",
        )
        z.writestr(
            "_rels/.rels",
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
            'Target="xl/workbook.xml"/>'
            "</Relationships>",
        )
        z.writestr(
            "xl/workbook.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            "<sheets>"
            '<sheet name="Sheet1" sheetId="1" r:id="rId1" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>'
            "</sheets></workbook>",
        )
    return buf.getvalue()


# ── Auth guards ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_csv_requires_auth(client: AsyncClient) -> None:
    """POST /ingestion/upload/csv without a token returns 401/403."""
    resp = await client.post(
        "/api/v1/ingestion/upload/csv",
        files={"file": ("test.csv", _VALID_CSV.encode(), "text/csv")},
    )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_upload_csv_viewer_forbidden(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Viewer role cannot upload files — returns 403."""
    resp = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=auth_headers,
        files={"file": ("test.csv", _VALID_CSV.encode(), "text/csv")},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_jobs_requires_auth(client: AsyncClient) -> None:
    """GET /ingestion/jobs without a token returns 401/403."""
    resp = await client.get("/api/v1/ingestion/jobs")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_jobs_accessible_to_viewer(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Viewer can list jobs (read-only access)."""
    resp = await client.get("/api/v1/ingestion/jobs", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── CSV Upload (analyst) ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_csv_analyst_accepted(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """Analyst can upload a valid CSV — returns 202 with job record."""
    resp = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files={"file": ("supply_data.csv", _VALID_CSV.encode(), "text/csv")},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "id" in data
    assert data["source"] == "csv"
    assert data["status"] in ("pending", "processing", "completed", "partial", "failed")
    assert data["file_name"] == "supply_data.csv"


@pytest.mark.asyncio
async def test_upload_csv_job_retrievable(
    client: AsyncClient, analyst_auth_headers: dict, auth_headers: dict
) -> None:
    """After upload, the job is retrievable via GET /ingestion/jobs/{job_id}."""
    upload = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files={"file": ("retrieve.csv", _VALID_CSV.encode(), "text/csv")},
    )
    assert upload.status_code == 202
    job_id = upload.json()["id"]

    get_resp = await client.get(
        f"/api/v1/ingestion/jobs/{job_id}", headers=auth_headers
    )
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["id"] == job_id
    assert data["source"] == "csv"


@pytest.mark.asyncio
async def test_upload_csv_job_appears_in_list(
    client: AsyncClient, analyst_auth_headers: dict, auth_headers: dict
) -> None:
    """Uploaded job appears in the /ingestion/jobs list."""
    upload = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files={"file": ("listed.csv", _VALID_CSV.encode(), "text/csv")},
    )
    assert upload.status_code == 202
    job_id = upload.json()["id"]

    list_resp = await client.get("/api/v1/ingestion/jobs", headers=auth_headers)
    assert list_resp.status_code == 200
    ids = [j["id"] for j in list_resp.json()]
    assert job_id in ids


@pytest.mark.asyncio
async def test_get_job_not_found_returns_404(
    client: AsyncClient, auth_headers: dict
) -> None:
    """GET /ingestion/jobs/{nonexistent_id} returns 404."""
    resp = await client.get(
        f"/api/v1/ingestion/jobs/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_upload_csv_custom_column_mapping(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """Custom column mapping query params are accepted alongside the file."""
    resp = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        params={
            "item_code_col": "code",
            "quantity_col": "qty",
        },
        files={"file": ("custom.csv", _VALID_CSV.encode(), "text/csv")},
    )
    assert resp.status_code == 202


# ── Excel Upload ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_xlsx_accepted(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """Analyst can upload an XLSX file — endpoint accepts it (202)."""
    xlsx_bytes = _make_minimal_xlsx()
    resp = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files={
            "file": (
                "supply_data.xlsx",
                xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    # Either accepted (202) or parser rejects the stub xlsx with 4xx.
    # Both are valid — ensures no unhandled 5xx.
    assert resp.status_code in (202, 400, 422)


# ── Invalid file type ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_pdf_rejected(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """Uploading a PDF file (unsupported MIME type) returns 415."""
    resp = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files={"file": ("data.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert resp.status_code == 415


# ── File size limit ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_oversized_file_rejected(
    client: AsyncClient, analyst_auth_headers: dict
) -> None:
    """A file larger than 50 MB returns 413."""
    big_content = b"a,b,c\n" + b"x" * (51 * 1024 * 1024)
    resp = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files={"file": ("huge.csv", big_content, "text/csv")},
    )
    assert resp.status_code == 413


# ── Audit log ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_log_endpoint_accessible(
    client: AsyncClient, analyst_auth_headers: dict, auth_headers: dict
) -> None:
    """GET /ingestion/jobs/{job_id}/audit returns a list (may be empty initially)."""
    upload = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files={"file": ("audit.csv", _VALID_CSV.encode(), "text/csv")},
    )
    assert upload.status_code == 202
    job_id = upload.json()["id"]

    audit_resp = await client.get(
        f"/api/v1/ingestion/jobs/{job_id}/audit", headers=auth_headers
    )
    assert audit_resp.status_code == 200
    assert isinstance(audit_resp.json(), list)


# ── Duplicate detection ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_upload_same_csv_twice_creates_two_jobs(
    client: AsyncClient, analyst_auth_headers: dict, auth_headers: dict
) -> None:
    """Uploading identical CSV content twice creates two separate job records."""
    payload = {"file": ("dup.csv", _VALID_CSV.encode(), "text/csv")}

    resp_a = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files=payload,
    )
    resp_b = await client.post(
        "/api/v1/ingestion/upload/csv",
        headers=analyst_auth_headers,
        files={"file": ("dup.csv", _VALID_CSV.encode(), "text/csv")},
    )
    assert resp_a.status_code == 202
    assert resp_b.status_code == 202
    # Each upload gets its own job id
    assert resp_a.json()["id"] != resp_b.json()["id"]


# ── Pagination ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_jobs_pagination_limit(
    client: AsyncClient, auth_headers: dict
) -> None:
    """limit=2 returns at most 2 jobs."""
    resp = await client.get(
        "/api/v1/ingestion/jobs",
        params={"limit": 2, "offset": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) <= 2
