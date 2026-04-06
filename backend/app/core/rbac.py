"""RBAC dependency factories.

Usage in route handlers:
    @router.get("/admin-only")
    async def admin_only(user: User = Depends(require_roles(UserRole.admin))):
        ...

    @router.get("/clinician-or-admin")
    async def multi(user: User = Depends(require_roles(UserRole.admin, UserRole.clinician))):
        ...
"""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from app.dependencies import get_current_active_user
from app.models.user import User, UserRole


def require_roles(*roles: UserRole) -> Callable:
    """Return a FastAPI dependency that enforces the caller has one of the given roles."""

    async def _check(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not permitted for this resource.",
            )
        return current_user

    return _check


# Convenience aliases
require_admin = require_roles(UserRole.admin)
require_clinician_or_above = require_roles(UserRole.admin, UserRole.clinician)
require_analyst_or_above = require_roles(
    UserRole.admin, UserRole.clinician, UserRole.analyst
)
