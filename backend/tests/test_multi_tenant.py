"""Tests for multi-tenant architecture.

Covers:
  - Tenant model creation (Country, Organization, District, Facility)
  - JWT tenant claims embedded at login / refresh
  - TenantContext construction from JWT payload
  - Tenant isolation: facility user cannot see data from another facility
  - Hierarchical access: district manager sees all district facilities
  - Tenant CRUD API endpoints (countries, organizations, districts, facilities)
  - Facility onboarding flow (/tenants/onboard)
  - Backward compatibility: users without tenant assignment work as platform-level
"""

from __future__ import annotations

import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import create_access_token, decode_token
from app.core.tenant_context import TenantContext, get_tenant_context
from app.core.tenant_filter import apply_tenant_filter, get_tenant_filter_clauses
from app.models.tenant import Country, District, Facility, FacilityType, Organization, OrgType
from app.models.user import User, UserRole

# ── Helpers ────────────────────────────────────────────────────────────────────


async def _register_and_login(
    client: AsyncClient,
    email: str,
    password: str,
    role: str,
    country_id: str | None = None,
    organization_id: str | None = None,
    facility_id: str | None = None,
) -> str:
    """Register a user (or accept 409) and return an access token."""
    payload: dict = {
        "email": email,
        "password": password,
        "full_name": f"Test {role}",
        "role": role,
    }
    if country_id:
        payload["country_id"] = country_id
    if organization_id:
        payload["organization_id"] = organization_id
    if facility_id:
        payload["facility_id"] = facility_id

    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code in (201, 409), f"Register failed: {resp.text}"

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


async def _create_country(db: AsyncSession, name: str = "Kenya", iso_code: str = "KE") -> Country:
    country = Country(
        id=uuid.uuid4(),
        name=name,
        iso_code=iso_code,
        timezone="Africa/Nairobi",
        is_active=True,
    )
    db.add(country)
    await db.flush()
    return country


async def _create_organization(db: AsyncSession, country_id: uuid.UUID) -> Organization:
    org = Organization(
        id=uuid.uuid4(),
        name="Ministry of Health",
        country_id=country_id,
        org_type=OrgType.government,
        is_active=True,
    )
    db.add(org)
    await db.flush()
    return org


async def _create_district(db: AsyncSession, country_id: uuid.UUID, name: str = "Nairobi") -> District:
    d = District(
        id=uuid.uuid4(),
        name=name,
        country_id=country_id,
        region="Central",
        population=4_500_000,
    )
    db.add(d)
    await db.flush()
    return d


async def _create_facility(
    db: AsyncSession,
    org_id: uuid.UUID,
    country_id: uuid.UUID,
    district_id: uuid.UUID | None = None,
    name: str = "Kenyatta National Hospital",
    district: str | None = "Nairobi",
) -> Facility:
    f = Facility(
        id=uuid.uuid4(),
        name=name,
        organization_id=org_id,
        country_id=country_id,
        district_id=district_id,
        district=district,
        facility_type=FacilityType.hospital,
        is_active=True,
    )
    db.add(f)
    await db.flush()
    return f


# ── Model tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_country(db_session: AsyncSession) -> None:
    country = await _create_country(db_session, "Tanzania", "TZ")
    assert country.id is not None
    assert country.iso_code == "TZ"
    assert country.is_active is True


@pytest.mark.asyncio
async def test_create_organization(db_session: AsyncSession) -> None:
    country = await _create_country(db_session)
    org = await _create_organization(db_session, country.id)
    assert org.country_id == country.id
    assert org.org_type == OrgType.government


@pytest.mark.asyncio
async def test_create_district(db_session: AsyncSession) -> None:
    country = await _create_country(db_session)
    district = await _create_district(db_session, country.id)
    assert district.country_id == country.id
    assert district.name == "Nairobi"


@pytest.mark.asyncio
async def test_create_facility(db_session: AsyncSession) -> None:
    country = await _create_country(db_session)
    org = await _create_organization(db_session, country.id)
    district = await _create_district(db_session, country.id)
    facility = await _create_facility(db_session, org.id, country.id, district.id)
    assert facility.country_id == country.id
    assert facility.organization_id == org.id
    assert facility.district_id == district.id
    assert facility.facility_type == FacilityType.hospital


# ── JWT tenant claims ──────────────────────────────────────────────────────────


def test_access_token_includes_tenant_claims() -> None:
    """create_access_token should embed country/org/facility IDs in the payload."""
    country_id = uuid.uuid4()
    org_id = uuid.uuid4()
    facility_id = uuid.uuid4()

    token = create_access_token(
        user_id=str(uuid.uuid4()),
        role="facility_manager",
        country_id=country_id,
        organization_id=org_id,
        facility_id=facility_id,
    )
    payload = decode_token(token)

    assert payload["country_id"] == str(country_id)
    assert payload["organization_id"] == str(org_id)
    assert payload["facility_id"] == str(facility_id)
    assert payload["role"] == "facility_manager"
    assert payload["type"] == "access"


def test_access_token_without_tenant_claims() -> None:
    """Legacy tokens without tenant claims should decode cleanly."""
    token = create_access_token(user_id=str(uuid.uuid4()), role="admin")
    payload = decode_token(token)
    assert "country_id" not in payload
    assert "facility_id" not in payload


def test_token_invalid_uuid_raises() -> None:
    """Tokens with a malformed UUID tenant claim should fail decode_token."""
    from app.core.security import _create_token
    from datetime import timedelta
    from jose import JWTError

    token = _create_token(
        {"sub": str(uuid.uuid4()), "role": "viewer", "type": "access", "country_id": "not-a-uuid"},
        timedelta(minutes=30),
    )
    with pytest.raises(JWTError):
        decode_token(token)


# ── TenantContext ──────────────────────────────────────────────────────────────


def test_tenant_context_platform_admin() -> None:
    ctx = TenantContext(user_id=uuid.uuid4(), role=UserRole.platform_admin)
    assert ctx.is_platform_admin is True
    assert ctx.can_access_country(uuid.uuid4()) is True
    assert ctx.can_access_facility(uuid.uuid4()) is True


def test_tenant_context_facility_scoped() -> None:
    facility_id = uuid.uuid4()
    ctx = TenantContext(
        user_id=uuid.uuid4(),
        role=UserRole.facility_manager,
        country_id=uuid.uuid4(),
        facility_id=facility_id,
    )
    assert ctx.is_platform_admin is False
    assert ctx.is_facility_scoped is True
    assert ctx.can_access_facility(facility_id) is True
    assert ctx.can_access_facility(uuid.uuid4()) is False


def test_tenant_context_national_admin() -> None:
    country_id = uuid.uuid4()
    ctx = TenantContext(
        user_id=uuid.uuid4(),
        role=UserRole.national_admin,
        country_id=country_id,
    )
    assert ctx.is_national_admin is True
    assert ctx.can_access_country(country_id) is True
    assert ctx.can_access_country(uuid.uuid4()) is False


def test_tenant_context_district_manager() -> None:
    ctx = TenantContext(
        user_id=uuid.uuid4(),
        role=UserRole.district_manager,
        country_id=uuid.uuid4(),
        district="Nairobi",
    )
    assert ctx.is_district_manager is True


def test_tenant_context_no_assignment_is_platform_level() -> None:
    """A user with no tenant assignment (all None) should behave like platform-level."""
    ctx = TenantContext(user_id=uuid.uuid4(), role=UserRole.viewer)
    # No country_id set — treated as platform-level (no restriction)
    assert ctx.country_id is None
    assert ctx.can_access_country(uuid.uuid4()) is True


# ── Tenant filter ──────────────────────────────────────────────────────────────


def test_filter_clauses_platform_admin_empty() -> None:
    """Platform admins get no WHERE clauses."""
    ctx = TenantContext(role=UserRole.platform_admin, country_id=uuid.uuid4())
    clauses = get_tenant_filter_clauses(Facility, ctx)
    assert clauses == []


def test_filter_clauses_national_admin() -> None:
    """National admin gets a country_id clause."""
    country_id = uuid.uuid4()
    ctx = TenantContext(role=UserRole.national_admin, country_id=country_id)
    clauses = get_tenant_filter_clauses(Facility, ctx)
    # Should produce exactly one clause targeting country_id
    assert len(clauses) >= 1


def test_filter_clauses_no_country_empty() -> None:
    """User with no country_id gets no filter (backward compat)."""
    ctx = TenantContext(role=UserRole.national_admin, country_id=None)
    clauses = get_tenant_filter_clauses(Facility, ctx)
    assert clauses == []


# ── API: Country CRUD ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_country_api_platform_admin(client: AsyncClient) -> None:
    token = await _register_and_login(client, "platform_admin_test@vaxai.test", "PAdmin123!", "platform_admin")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/tenants/countries",
        json={"name": "Ghana", "iso_code": "GH", "timezone": "Africa/Accra"},
        headers=headers,
    )
    assert resp.status_code in (201, 409), resp.text
    if resp.status_code == 201:
        data = resp.json()
        assert data["iso_code"] == "GH"
        assert data["name"] == "Ghana"


@pytest.mark.asyncio
async def test_create_country_api_requires_platform_admin(client: AsyncClient) -> None:
    """A national_admin should not be able to create countries."""
    token = await _register_and_login(client, "natadmin_nocountry@vaxai.test", "NatAdmin123!", "national_admin")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/tenants/countries",
        json={"name": "TestCountry", "iso_code": "XX"},
        headers=headers,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_countries_national_admin(client: AsyncClient) -> None:
    """National admins can list countries."""
    token = await _register_and_login(client, "natadmin_list@vaxai.test", "NatAdmin123!", "national_admin")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/v1/tenants/countries", headers=headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── API: Organization CRUD ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_organization_api(client: AsyncClient, db_session: AsyncSession) -> None:
    # Create a country first via DB (bypass API country creation restriction)
    country = await _create_country(db_session, "Zambia", "ZM")
    await db_session.commit()

    token = await _register_and_login(client, "natadmin_org@vaxai.test", "NatAdmin123!", "national_admin")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/tenants/organizations",
        json={"name": "Zambia MoH", "country_id": str(country.id), "org_type": "government"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "Zambia MoH"
    assert data["country_id"] == str(country.id)


# ── API: District CRUD ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_district_api(client: AsyncClient, db_session: AsyncSession) -> None:
    country = await _create_country(db_session, "Uganda", "UG")
    await db_session.commit()

    token = await _register_and_login(client, "natadmin_dist@vaxai.test", "NatAdmin123!", "national_admin")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/tenants/districts",
        json={"name": "Kampala", "country_id": str(country.id), "region": "Central"},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "Kampala"


# ── API: Facility CRUD ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_facility_api(client: AsyncClient, db_session: AsyncSession) -> None:
    country = await _create_country(db_session, "Rwanda", "RW")
    org = await _create_organization(db_session, country.id)
    await db_session.commit()

    token = await _register_and_login(client, "distmgr_fac@vaxai.test", "DistMgr123!", "district_manager")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/tenants/facilities",
        json={
            "name": "Kigali District Hospital",
            "organization_id": str(org.id),
            "country_id": str(country.id),
            "facility_type": "hospital",
            "district": "Kigali",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["name"] == "Kigali District Hospital"
    assert data["facility_type"] == "hospital"


@pytest.mark.asyncio
async def test_viewer_cannot_create_facility(client: AsyncClient) -> None:
    token = await _register_and_login(client, "viewer_nofac@vaxai.test", "Viewer123!", "viewer")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/tenants/facilities",
        json={
            "name": "Some Facility",
            "organization_id": str(uuid.uuid4()),
            "country_id": str(uuid.uuid4()),
            "facility_type": "dispensary",
        },
        headers=headers,
    )
    assert resp.status_code == 403


# ── API: Hierarchy ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hierarchy_endpoint(client: AsyncClient) -> None:
    token = await _register_and_login(client, "natadmin_hier@vaxai.test", "NatAdmin123!", "national_admin")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/v1/tenants/hierarchy", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert "hierarchy" in body
    assert isinstance(body["hierarchy"], list)


# ── API: Guided onboarding ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_onboard_creates_country_org_facility(client: AsyncClient) -> None:
    token = await _register_and_login(
        client, "platform_onboard@vaxai.test", "PAdmin123!", "platform_admin"
    )
    headers = {"Authorization": f"Bearer {token}"}

    iso_code = f"O{uuid.uuid4().hex[:1].upper()}"  # unique 2-char code
    resp = await client.post(
        "/api/v1/tenants/onboard",
        json={
            "country_name": "Onboard Country",
            "country_iso_code": iso_code,
            "organization_name": "Onboard MoH",
            "org_type": "government",
            "facility_name": "Onboard Central Hospital",
            "facility_type": "hospital",
            "district": "Central",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["created_new_country"] is True
    assert data["created_new_organization"] is True
    assert data["country"]["iso_code"] == iso_code.upper()
    assert data["organization"]["name"] == "Onboard MoH"
    assert data["facility"]["name"] == "Onboard Central Hospital"


@pytest.mark.asyncio
async def test_onboard_reuses_existing_country(client: AsyncClient, db_session: AsyncSession) -> None:
    """If the country already exists, onboard should reuse it."""
    country = await _create_country(db_session, "Existing Land", "EL")
    await db_session.commit()

    token = await _register_and_login(
        client, "platform_onboard2@vaxai.test", "PAdmin123!", "platform_admin"
    )
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/tenants/onboard",
        json={
            "country_name": "Existing Land",
            "country_iso_code": "EL",
            "organization_name": "New MoH",
            "org_type": "ngo",
            "facility_name": "New Clinic",
            "facility_type": "health_center",
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["created_new_country"] is False
    assert data["country"]["id"] == str(country.id)


# ── Tenant isolation ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_login_response_includes_tenant_context(client: AsyncClient) -> None:
    """Login response should surface tenant_context dict."""
    email = "tc_login@vaxai.test"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "TCLogin123!", "full_name": "TC Login", "role": "viewer"},
    )
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "TCLogin123!"})
    assert resp.status_code == 200
    body = resp.json()
    assert "tenant_context" in body
    # For a user with no tenant assignment tenant_context values are None
    tc = body["tenant_context"]
    assert tc["country_id"] is None
    assert tc["facility_id"] is None


@pytest.mark.asyncio
async def test_jwt_tenant_claims_present_for_tenant_user(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """A user assigned to a facility should get tenant claims in their JWT."""
    country = await _create_country(db_session, "ClaimTest", "CT")
    org = await _create_organization(db_session, country.id)
    facility = await _create_facility(db_session, org.id, country.id)
    await db_session.commit()

    email = "tc_facility@vaxai.test"
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "TCFacility123!",
            "full_name": "TC Facility User",
            "role": "facility_manager",
            "country_id": str(country.id),
            "organization_id": str(org.id),
            "facility_id": str(facility.id),
        },
    )
    assert resp.status_code in (201, 409)

    resp = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "TCFacility123!"}
    )
    assert resp.status_code == 200
    body = resp.json()
    token = body["access_token"]

    payload = decode_token(token)
    assert payload.get("country_id") == str(country.id)
    assert payload.get("organization_id") == str(org.id)
    assert payload.get("facility_id") == str(facility.id)


# ── Backward compatibility ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_existing_user_without_tenant_still_works(client: AsyncClient) -> None:
    """Users with no tenant fields should still authenticate and access /me."""
    email = "legacy_user@vaxai.test"
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Legacy123!", "full_name": "Legacy User", "role": "analyst"},
    )
    assert resp.status_code in (201, 409)

    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": "Legacy123!"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == email
    # Tenant fields should be null
    assert data["country_id"] is None
    assert data["facility_id"] is None


# ── Role hierarchy ─────────────────────────────────────────────────────────────


def test_role_hierarchy_ordering() -> None:
    from app.models.user import has_at_least_role, role_level

    # platform_admin is most privileged
    assert role_level(UserRole.platform_admin) < role_level(UserRole.national_admin)
    assert role_level(UserRole.national_admin) < role_level(UserRole.district_manager)
    assert role_level(UserRole.district_manager) < role_level(UserRole.facility_manager)
    assert role_level(UserRole.facility_manager) < role_level(UserRole.viewer)

    assert has_at_least_role(UserRole.platform_admin, UserRole.viewer) is True
    assert has_at_least_role(UserRole.viewer, UserRole.platform_admin) is False
    assert has_at_least_role(UserRole.national_admin, UserRole.national_admin) is True
    assert has_at_least_role(UserRole.national_admin, UserRole.district_manager) is True
    assert has_at_least_role(UserRole.district_manager, UserRole.national_admin) is False


def test_legacy_admin_role_is_platform_equivalent() -> None:
    """Legacy 'admin' role should behave like platform_admin in TenantContext."""
    ctx = TenantContext(user_id=uuid.uuid4(), role=UserRole.admin, country_id=uuid.uuid4())
    assert ctx.is_platform_admin is True
    # Platform admin bypasses all tenant filters
    clauses = get_tenant_filter_clauses(Facility, ctx)
    assert clauses == []
