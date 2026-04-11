"""Request/response schemas for the DHIS2 integration endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DHIS2SyncRequest(BaseModel):
    config_id: uuid.UUID
    sync_type: str = Field(default="full", pattern="^(full|incremental)$")


class DHIS2SyncStatusResponse(BaseModel):
    id: uuid.UUID
    config_id: uuid.UUID
    status: str
    sync_type: str
    records_fetched: int
    records_created: int
    records_updated: int
    records_failed: int
    error_message: str | None = None
    started_at: datetime
    completed_at: datetime | None = None


class DHIS2ConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    base_url: str = Field(min_length=1, max_length=1024)
    auth_username: str | None = None
    auth_password: str | None = None
    auth_pat: str | None = None
    country_code: str = Field(default="XX", min_length=2, max_length=2)
    mapping_config: dict | None = None


class DHIS2ConfigResponse(BaseModel):
    id: uuid.UUID
    name: str
    base_url: str
    auth_username: str | None = None
    country_code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DHIS2TestConnectionResponse(BaseModel):
    success: bool
    server_info: dict | None = None
    error: str | None = None
