"""User Management Routes: API endpoints for user CRUD, profile management, and user administration."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, require_roles
from app.db.deps import get_db
from app.models.user import User
from app.schemas.user import UserListItem

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserListItem])
def list_users(
    organization_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> list[UserListItem]:
    stmt = select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())

    if "super_admin" in auth.roles:
        if organization_id is not None:
            stmt = stmt.where(User.organization_id == organization_id)
    else:
        stmt = stmt.where(User.organization_id == auth.organization_id)

    users = db.scalars(stmt.limit(limit).offset(offset)).all()

    return [
        UserListItem(
            id=user.id,
            email=user.email,
            full_name=f"{user.first_name} {user.last_name}",
            status=user.status,
            organization_id=user.organization_id,
            created_at=user.created_at,
        )
        for user in users
    ]
