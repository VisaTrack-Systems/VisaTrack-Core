"""Organization Routes: API endpoints for organization management, settings, and tenant administration."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, require_roles
from app.db.deps import get_db
from app.models.organization import Organization
from app.schemas.organization import OrganizationRead

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=list[OrganizationRead])
def list_organizations(
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> list[OrganizationRead]:
    stmt = (
        select(Organization)
        .where(Organization.deleted_at.is_(None))
        .order_by(Organization.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if "super_admin" not in auth.roles:
        stmt = stmt.where(Organization.id == auth.organization_id)
    return list(db.scalars(stmt).all())
