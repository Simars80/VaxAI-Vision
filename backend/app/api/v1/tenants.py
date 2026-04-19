"""Tenant management endpoints.

Hierarchy:
  GET/POST/PATCH/DELETE /tenants/countries      — platform_admin only
  GET/POST/PATCH/DELETE /tenants/organizations  — national_admin+
  GET/POST/PATCH/DELETE /tenants/districts      — national_admin+
  GET/POST/PATCH/DELETE /tenants/facilities     — district_manager+
  GET                   /tenants/hierarchy      — national_admin+ (country tree)
  POST                  /tenants/onboard        — platform_admin (guided setup)
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import (
    require_district_manager_or_above,
    require_min_role,
    require_national_admin_or_above,
    require_platform_admin,
)
from app.database import get_db
from app.models.tenant import Country, District, Facility, FacilityType, Organization, OrgType
from app.models.user import User, UserRole

router = APIRouter(prefix="/tenants", tags=["tenants"])


# ── Pydantic schemas ───────────────────────────────────────────────────────────


class CountryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    iso_code: str = Field(min_length=2, max_length=2)
    timezone: str | None = None
    default_language: str | None = None
    dhis2_instance_url: str | None = None
    is_active: bool = True


class CountryUpdate(BaseModel):
    name: str | None = None
    timezone: str | None = None
    default_language: str | None = None
    dhis2_instance_url: str | None = None
    is_active: bool | None = None


class CountryResponse(BaseModel):
    id: uuid.UUID
    name: str
    iso_code: str
    timezone: str | None
    default_language: str | None
    dhis2_instance_url: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=512)
    country_id: uuid.UUID
    org_type: OrgType = OrgType.government
    is_active: bool = True


class OrganizationUpdate(BaseModel):
    name: str | None = None
    org_type: OrgType | None = None
    is_active: bool | None = None


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    country_id: uuid.UUID
    org_type: OrgType
    is_active: bool

    model_config = {"from_attributes": True}


class DistrictCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    country_id: uuid.UUID
    region: str | None = None
    population: int | None = None


class DistrictUpdate(BaseModel):
    name: str | None = None
    region: str | None = None
    population: int | None = None


class DistrictResponse(BaseModel):
    id: uuid.UUID
    name: str
    country_id: uuid.UUID
    region: str | None
    population: int | None

    model_config = {"from_attributes": True}


class FacilityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=512)
    facility_code: str | None = None
    organization_id: uuid.UUID
    country_id: uuid.UUID
    district_id: uuid.UUID | None = None
    district: str | None = None
    region: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    facility_type: FacilityType = FacilityType.health_center
    is_active: bool = True


class FacilityUpdate(BaseModel):
    name: str | None = None
    facility_code: str | None = None
    district_id: uuid.UUID | None = None
    district: str | None = None
    region: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    facility_type: FacilityType | None = None
    is_active: bool | None = None


class FacilityResponse(BaseModel):
    id: uuid.UUID
    name: str
    facility_code: str | None
    organization_id: uuid.UUID
    country_id: uuid.UUID
    district_id: uuid.UUID | None
    district: str | None
    region: str | None
    latitude: float | None
    longitude: float | None
    facility_type: FacilityType
    is_active: bool

    model_config = {"from_attributes": True}


class OnboardRequest(BaseModel):
    """Guided onboarding: supply the minimum to create a full country+org+facility."""

    # Country — create new or use existing iso_code
    country_name: str
    country_iso_code: str = Field(min_length=2, max_length=2)
    country_timezone: str | None = None
    dhis2_instance_url: str | None = None

    # Organization
    organization_name: str
    org_type: OrgType = OrgType.government

    # Facility
    facility_name: str
    facility_code: str | None = None
    facility_type: FacilityType = FacilityType.health_center
    district: str | None = None
    region: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class OnboardResponse(BaseModel):
    country: CountryResponse
    organization: OrganizationResponse
    facility: FacilityResponse
    created_new_country: bool
    created_new_organization: bool


# ── Country CRUD — platform_admin only ────────────────────────────────────────


@router.get("/countries", response_model=list[CountryResponse])
async def list_countries(
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> list[Country]:
    stmt = select(Country)
    if is_active is not None:
        stmt = stmt.where(Country.is_active == is_active)
    result = await db.execute(stmt.order_by(Country.name))
    return list(result.scalars().all())


@router.post("/countries", response_model=CountryResponse, status_code=status.HTTP_201_CREATED)
async def create_country(
    body: CountryCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_platform_admin),
) -> Country:
    existing = await db.execute(select(Country).where(Country.iso_code == body.iso_code.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Country with ISO code '{body.iso_code}' already exists.",
        )
    country = Country(
        name=body.name,
        iso_code=body.iso_code.upper(),
        timezone=body.timezone,
        default_language=body.default_language,
        dhis2_instance_url=body.dhis2_instance_url,
        is_active=body.is_active,
    )
    db.add(country)
    await db.flush()
    return country


@router.get("/countries/{country_id}", response_model=CountryResponse)
async def get_country(
    country_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> Country:
    result = await db.execute(select(Country).where(Country.id == country_id))
    country = result.scalar_one_or_none()
    if country is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Country not found.")
    return country


@router.patch("/countries/{country_id}", response_model=CountryResponse)
async def update_country(
    country_id: uuid.UUID,
    body: CountryUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_platform_admin),
) -> Country:
    result = await db.execute(select(Country).where(Country.id == country_id))
    country = result.scalar_one_or_none()
    if country is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Country not found.")
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(country, field_name, value)
    await db.flush()
    return country


@router.delete("/countries/{country_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_country(
    country_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_platform_admin),
) -> None:
    result = await db.execute(select(Country).where(Country.id == country_id))
    country = result.scalar_one_or_none()
    if country is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Country not found.")
    country.is_active = False  # soft-delete
    await db.flush()


# ── Organization CRUD — national_admin+ ───────────────────────────────────────


@router.get("/organizations", response_model=list[OrganizationResponse])
async def list_organizations(
    country_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> list[Organization]:
    stmt = select(Organization)
    if country_id:
        stmt = stmt.where(Organization.country_id == country_id)
    result = await db.execute(stmt.order_by(Organization.name))
    return list(result.scalars().all())


@router.post("/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> Organization:
    org = Organization(
        name=body.name,
        country_id=body.country_id,
        org_type=body.org_type,
        is_active=body.is_active,
    )
    db.add(org)
    await db.flush()
    return org


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    return org


@router.patch("/organizations/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    body: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(org, field_name, value)
    await db.flush()
    return org


@router.delete("/organizations/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> None:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
    org.is_active = False
    await db.flush()


# ── District CRUD — national_admin+ ──────────────────────────────────────────


@router.get("/districts", response_model=list[DistrictResponse])
async def list_districts(
    country_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> list[District]:
    stmt = select(District)
    if country_id:
        stmt = stmt.where(District.country_id == country_id)
    result = await db.execute(stmt.order_by(District.name))
    return list(result.scalars().all())


@router.post("/districts", response_model=DistrictResponse, status_code=status.HTTP_201_CREATED)
async def create_district(
    body: DistrictCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> District:
    district = District(
        name=body.name,
        country_id=body.country_id,
        region=body.region,
        population=body.population,
    )
    db.add(district)
    await db.flush()
    return district


@router.patch("/districts/{district_id}", response_model=DistrictResponse)
async def update_district(
    district_id: uuid.UUID,
    body: DistrictUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> District:
    result = await db.execute(select(District).where(District.id == district_id))
    district = result.scalar_one_or_none()
    if district is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="District not found.")
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(district, field_name, value)
    await db.flush()
    return district


@router.delete("/districts/{district_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_district(
    district_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_national_admin_or_above),
) -> None:
    result = await db.execute(select(District).where(District.id == district_id))
    district = result.scalar_one_or_none()
    if district is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="District not found.")
    await db.delete(district)
    await db.flush()


# ── Facility CRUD — district_manager+ ────────────────────────────────────────


@router.get("/facilities", response_model=list[FacilityResponse])
async def list_facilities(
    country_id: uuid.UUID | None = Query(default=None),
    organization_id: uuid.UUID | None = Query(default=None),
    district_id: uuid.UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_district_manager_or_above),
) -> list[Facility]:
    stmt = select(Facility)
    # Scope national_admin and district_manager to their country
    if current_user.country_id and current_user.role not in (
        UserRole.platform_admin, UserRole.admin
    ):
        stmt = stmt.where(Facility.country_id == current_user.country_id)
    if country_id:
        stmt = stmt.where(Facility.country_id == country_id)
    if organization_id:
        stmt = stmt.where(Facility.organization_id == organization_id)
    if district_id:
        stmt = stmt.where(Facility.district_id == district_id)
    if is_active is not None:
        stmt = stmt.where(Facility.is_active == is_active)
    result = await db.execute(stmt.order_by(Facility.name))
    return list(result.scalars().all())


@router.post("/facilities", response_model=FacilityResponse, status_code=status.HTTP_201_CREATED)
async def create_facility(
    body: FacilityCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_district_manager_or_above),
) -> Facility:
    facility = Facility(
        name=body.name,
        facility_code=body.facility_code,
        organization_id=body.organization_id,
        country_id=body.country_id,
        district_id=body.district_id,
        district=body.district,
        region=body.region,
        latitude=body.latitude,
        longitude=body.longitude,
        facility_type=body.facility_type,
        is_active=body.is_active,
    )
    db.add(facility)
    await db.flush()
    return facility


@router.get("/facilities/{facility_id}", response_model=FacilityResponse)
async def get_facility(
    facility_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_district_manager_or_above),
) -> Facility:
    result = await db.execute(select(Facility).where(Facility.id == facility_id))
    facility = result.scalar_one_or_none()
    if facility is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found.")
    # Enforce country-level scoping for non-platform users
    if current_user.country_id and current_user.role not in (UserRole.platform_admin, UserRole.admin):
        if facility.country_id != current_user.country_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return facility


@router.patch("/facilities/{facility_id}", response_model=FacilityResponse)
async def update_facility(
    facility_id: uuid.UUID,
    body: FacilityUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_district_manager_or_above),
) -> Facility:
    result = await db.execute(select(Facility).where(Facility.id == facility_id))
    facility = result.scalar_one_or_none()
    if facility is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found.")
    for field_name, value in body.model_dump(exclude_unset=True).items():
        setattr(facility, field_name, value)
    await db.flush()
    return facility


@router.delete("/facilities/{facility_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_facility(
    facility_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_district_manager_or_above),
) -> None:
    result = await db.execute(select(Facility).where(Facility.id == facility_id))
    facility = result.scalar_one_or_none()
    if facility is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Facility not found.")
    facility.is_active = False
    await db.flush()


# ── Hierarchy view ─────────────────────────────────────────────────────────────


@router.get("/hierarchy", summary="Full country > org > district > facility tree")
async def get_hierarchy(
    country_id: uuid.UUID | None = Query(default=None, description="Filter to one country"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_national_admin_or_above),
) -> dict[str, Any]:
    """Return the full tenant hierarchy as a nested JSON tree."""

    # Scope to the requesting user's country if they're not a platform admin
    effective_country_id = country_id
    if current_user.role not in (UserRole.platform_admin, UserRole.admin):
        effective_country_id = current_user.country_id

    # Fetch all relevant data in parallel queries
    country_stmt = select(Country).where(Country.is_active == True)  # noqa: E712
    if effective_country_id:
        country_stmt = country_stmt.where(Country.id == effective_country_id)

    countries_res = await db.execute(country_stmt.order_by(Country.name))
    countries = countries_res.scalars().all()

    org_stmt = select(Organization)
    if effective_country_id:
        org_stmt = org_stmt.where(Organization.country_id == effective_country_id)
    orgs_res = await db.execute(org_stmt)
    orgs_by_country: dict[uuid.UUID, list[dict]] = {}
    for org in orgs_res.scalars().all():
        orgs_by_country.setdefault(org.country_id, []).append(
            {"id": str(org.id), "name": org.name, "org_type": org.org_type, "is_active": org.is_active}
        )

    district_stmt = select(District)
    if effective_country_id:
        district_stmt = district_stmt.where(District.country_id == effective_country_id)
    districts_res = await db.execute(district_stmt)
    districts_by_country: dict[uuid.UUID, list[dict]] = {}
    for d in districts_res.scalars().all():
        districts_by_country.setdefault(d.country_id, []).append(
            {"id": str(d.id), "name": d.name, "region": d.region, "population": d.population}
        )

    facility_stmt = select(Facility)
    if effective_country_id:
        facility_stmt = facility_stmt.where(Facility.country_id == effective_country_id)
    facilities_res = await db.execute(facility_stmt)
    facilities_by_country: dict[uuid.UUID, list[dict]] = {}
    for f in facilities_res.scalars().all():
        facilities_by_country.setdefault(f.country_id, []).append(
            {
                "id": str(f.id),
                "name": f.name,
                "facility_code": f.facility_code,
                "facility_type": f.facility_type,
                "district": f.district,
                "region": f.region,
                "organization_id": str(f.organization_id),
                "is_active": f.is_active,
            }
        )

    tree = []
    for c in countries:
        tree.append(
            {
                "id": str(c.id),
                "name": c.name,
                "iso_code": c.iso_code,
                "organizations": orgs_by_country.get(c.id, []),
                "districts": districts_by_country.get(c.id, []),
                "facilities": facilities_by_country.get(c.id, []),
            }
        )

    return {"hierarchy": tree}


# ── Guided onboarding ─────────────────────────────────────────────────────────


@router.post(
    "/onboard",
    response_model=OnboardResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Guided facility onboarding — creates country/org/facility if needed",
)
async def onboard_facility(
    body: OnboardRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_platform_admin),
) -> OnboardResponse:
    """Idempotent guided onboarding.

    - If a country with the given iso_code already exists, it is reused.
    - A new organization is always created (allow multiples per country).
    - A new facility is always created.
    """
    created_new_country = False
    created_new_organization = False

    # 1. Country — find or create
    country_res = await db.execute(
        select(Country).where(Country.iso_code == body.country_iso_code.upper())
    )
    country = country_res.scalar_one_or_none()
    if country is None:
        country = Country(
            name=body.country_name,
            iso_code=body.country_iso_code.upper(),
            timezone=body.country_timezone,
            dhis2_instance_url=body.dhis2_instance_url,
            is_active=True,
        )
        db.add(country)
        await db.flush()
        created_new_country = True

    # 2. Organization — create new
    organization = Organization(
        name=body.organization_name,
        country_id=country.id,
        org_type=body.org_type,
        is_active=True,
    )
    db.add(organization)
    await db.flush()
    created_new_organization = True

    # 3. Facility — create new
    facility = Facility(
        name=body.facility_name,
        facility_code=body.facility_code,
        organization_id=organization.id,
        country_id=country.id,
        district=body.district,
        region=body.region,
        latitude=body.latitude,
        longitude=body.longitude,
        facility_type=body.facility_type,
        is_active=True,
    )
    db.add(facility)
    await db.flush()

    return OnboardResponse(
        country=CountryResponse.model_validate(country),
        organization=OrganizationResponse.model_validate(organization),
        facility=FacilityResponse.model_validate(facility),
        created_new_country=created_new_country,
        created_new_organization=created_new_organization,
    )
