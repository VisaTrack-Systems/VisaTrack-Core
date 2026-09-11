"""Dashboard Routes: API endpoints for dashboard data, analytics, summary statistics, and overview information."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, require_permissions, require_roles
from app.db.deps import get_db
from app.models.case import Case
from app.models.milestone import Milestone
from app.models.organization import Organization
from app.models.user import User
from app.schemas.dashboard import (
    DashboardCase,
    DashboardMilestone,
    DashboardOverview,
    DashboardStats,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

LEGACY_CASE_STATUS_MAP = {
    "document_collection": "awaiting_client",
    "additional_documents_requested": "awaiting_client",
    "rfe_received": "awaiting_client",
    "document_review": "in_progress",
    "application_prep": "in_progress",
    "ready_to_submit": "in_progress",
    "submitted": "in_progress",
    "under_review": "in_progress",
    "decision_pending": "in_progress",
    "approved": "closed",
    "refused": "closed",
    "withdrawn": "closed",
}


def _normalized_case_status(value: str) -> str:
    token = str(value).strip().lower().replace(" ", "_").replace("-", "_")
    return LEGACY_CASE_STATUS_MAP.get(token, token)


@router.get("/overview", response_model=DashboardOverview)
def get_dashboard_overview(
    auth: AuthContext = Depends(require_roles("org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> DashboardOverview:
    org_filter = [] if auth.active_role == "super_admin" else [Organization.id == auth.organization_id]
    user_filter = [] if auth.active_role == "super_admin" else [User.organization_id == auth.organization_id]
    case_filter = [] if auth.active_role == "super_admin" else [Case.organization_id == auth.organization_id]

    organizations_count = db.scalar(
        select(func.count()).select_from(Organization).where(Organization.deleted_at.is_(None), *org_filter)
    )
    users_count = db.scalar(
        select(func.count()).select_from(User).where(User.deleted_at.is_(None), *user_filter)
    )
    active_cases_count = db.scalar(
        select(func.count())
        .select_from(Case)
        .where(Case.deleted_at.is_(None), Case.status != "closed")
        .where(*case_filter)
    )
    completed_cases_count = db.scalar(
        select(func.count())
        .select_from(Case)
        .where(Case.status == "closed", Case.deleted_at.is_(None), *case_filter)
    )

    client_user = User
    recent_cases_rows = db.execute(
        select(
            Case.id,
            Case.case_number,
            Case.case_type,
            Case.status,
            Case.priority,
            client_user.first_name,
            client_user.last_name,
        )
        .join(client_user, client_user.id == Case.client_id)
        .where(Case.deleted_at.is_(None), *case_filter)
        .order_by(Case.created_at.desc())
        .limit(6)
    ).all()

    upcoming_rows = db.execute(
        select(
            Milestone.id,
            Milestone.case_id,
            Case.case_number,
            Milestone.name,
            Milestone.due_date,
            Milestone.status,
        )
        .join(Case, Case.id == Milestone.case_id)
        .where(
            Case.deleted_at.is_(None),
            Milestone.status.in_(["not_started", "in_progress", "blocked"]),
            Milestone.due_date.is_not(None),
            *case_filter,
        )
        .order_by(Milestone.due_date.asc())
        .limit(8)
    ).all()

    return DashboardOverview(
        stats=DashboardStats(
            organizations=organizations_count or 0,
            users=users_count or 0,
            active_cases=active_cases_count or 0,
            completed_cases=completed_cases_count or 0,
        ),
        recent_cases=[
            DashboardCase(
                id=row.id,
                case_number=row.case_number,
                case_type=row.case_type,
                status=_normalized_case_status(row.status),
                priority=row.priority,
                client_name=f"{row.first_name} {row.last_name}",
            )
            for row in recent_cases_rows
        ],
        upcoming_milestones=[
            DashboardMilestone(
                id=row.id,
                case_id=row.case_id,
                case_number=row.case_number,
                name=row.name,
                due_date=row.due_date,
                status=row.status,
            )
            for row in upcoming_rows
        ],
    )
