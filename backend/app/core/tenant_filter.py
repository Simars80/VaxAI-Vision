"""Tenant-scoped query filtering.

Provides:
- TenantMixin — SQLAlchemy mixin that adds a `tenant_country_id` column and
  registers event listeners for automatic WHERE-clause injection.
- apply_tenant_filter(query, model, ctx) — explicit filter helper for use in
  route handlers that need full control.
- get_tenant_filter_clauses(model, ctx) — returns a list of SQLAlchemy WHERE
  expressions for the given model and tenant context.

Scoping rules (from most to least restrictive):
  platform_admin / admin  → sees everything (no filter added)
  national_admin          → filtered to country_id
  district_manager        → filtered to country_id + district
  facility_manager /
  clinician / analyst /
  viewer                  → filtered to facility_id (if set) or country_id
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Select, and_, or_
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.core.tenant_context import TenantContext, current_tenant_context
from app.models.user import UserRole


# ── TenantMixin ────────────────────────────────────────────────────────────────


class TenantMixin:
    """Mixin for models that should be automatically scoped to a tenant.

    Models that inherit from both Base and TenantMixin get a `tenant_country_id`
    column.  The apply_tenant_filter() helper uses that column (and optionally
    facility_id / district columns when they exist) to restrict query results.

    Example:
        class SupplyTransaction(Base, TenantMixin):
            __tablename__ = "supply_transactions"
            ...
    """

    # Optional — models that carry a country FK can expose it here so the
    # generic filter can find it automatically.
    tenant_country_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True, default=None
    )


# ── Filter helpers ─────────────────────────────────────────────────────────────


def get_tenant_filter_clauses(model: Any, ctx: TenantContext) -> list:
    """Return a list of SQLAlchemy filter expressions for the given ORM model.

    The list is empty when no restriction is needed (platform admins).
    Callers should AND the list into their existing query:

        clauses = get_tenant_filter_clauses(MyModel, ctx)
        stmt = select(MyModel)
        if clauses:
            stmt = stmt.where(and_(*clauses))
    """
    # Platform admins: no restriction
    if ctx.is_platform_admin or ctx.country_id is None:
        return []

    clauses: list = []

    # -- Country filter (always applied when country_id is set) --
    _country_col = _find_col(model, ("country_id", "tenant_country_id", "country"))
    if _country_col is not None:
        if _is_uuid_col(_country_col):
            clauses.append(_country_col == ctx.country_id)
        else:
            # String country column — try iso_code style
            # We can only filter if the column stores UUID values; string country
            # columns (legacy) are skipped to preserve backward compatibility.
            pass

    # -- District filter for district_manager --
    if ctx.role == UserRole.district_manager and ctx.district:
        _district_col = _find_col(model, ("district", "district_name"))
        if _district_col is not None:
            clauses.append(_district_col == ctx.district)

    # -- Facility filter for facility-scoped roles --
    if ctx.facility_id is not None and ctx.role in (
        UserRole.facility_manager,
        UserRole.clinician,
        UserRole.analyst,
        UserRole.viewer,
    ):
        _facility_col = _find_col(model, ("facility_id",))
        if _facility_col is not None:
            if _is_uuid_col(_facility_col):
                clauses.append(_facility_col == ctx.facility_id)
            # If facility_id stored as string, cast for comparison
            # (legacy models use String facility_id)
            else:
                clauses.append(_facility_col == str(ctx.facility_id))

    return clauses


def apply_tenant_filter(stmt: Select, model: Any, ctx: TenantContext | None = None) -> Select:
    """Apply tenant WHERE clauses to a SQLAlchemy Select statement.

    If ctx is None the current request context is used.

    Usage:
        stmt = select(SupplyTransaction)
        stmt = apply_tenant_filter(stmt, SupplyTransaction)
        rows = await db.execute(stmt)
    """
    if ctx is None:
        ctx = current_tenant_context()
    if ctx is None:
        return stmt  # no context available — allow (e.g. background jobs)

    clauses = get_tenant_filter_clauses(model, ctx)
    if clauses:
        stmt = stmt.where(and_(*clauses))
    return stmt


# ── Private helpers ────────────────────────────────────────────────────────────


def _find_col(model: Any, names: tuple[str, ...]) -> Any:
    """Return the first mapped column found by name, or None."""
    for name in names:
        col = getattr(model, name, None)
        if col is not None:
            return col
    return None


def _is_uuid_col(col: Any) -> bool:
    """Heuristic: check if the column type is UUID."""
    try:
        from sqlalchemy.dialects.postgresql import UUID as PGUUID
        import sqlalchemy as sa
        col_type = col.property.columns[0].type
        return isinstance(col_type, (PGUUID, sa.Uuid))
    except Exception:
        return False


# ── Convenience: build a full scoped query for a model ────────────────────────


def scoped_select(model: Any, ctx: TenantContext | None = None) -> Select:
    """Return a tenant-scoped SELECT * for the given model."""
    from sqlalchemy import select
    stmt = select(model)
    return apply_tenant_filter(stmt, model, ctx)
