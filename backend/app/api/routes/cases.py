from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, select, text
from sqlalchemy.orm import Session, aliased

from app.api.deps.auth import AuthContext, require_roles
from app.db.deps import get_db
from app.models.case import Case
from app.models.case_client import CaseClient
from app.models.milestone import Milestone
from app.models.organization import Organization
from app.models.user import User
from app.schemas.case import (
    CaseCreateRequest,
    CaseCustomDocumentCreateRequest,
    CaseDocumentRenameRequest,
    CaseDocumentRenameResponse,
    CaseDetailsUpdateRequest,
    CaseDetailsUpdateResponse,
    CaseMessageCreateRequest,
    CaseMilestoneCreateRequest,
    CaseMilestoneUpdateRequest,
    CaseCustomDocumentSuiteCreateRequest,
    CaseDocumentStatusUpdateRequest,
    CaseDocumentStatusUpdateResponse,
    CaseListItem,
    CasePortalPermissions,
    CasePortalPermissionsUpdateRequest,
    CaseSummary,
    CaseWorkspace,
    CaseWorkspaceAppointment,
    CaseWorkspaceAssignment,
    CaseWorkspaceBillingSummary,
    CaseWorkspaceDocument,
    CaseWorkspaceDocumentSuite,
    CaseWorkspaceInfo,
    CaseWorkspaceMessage,
    CaseWorkspaceMilestone,
    CaseWorkspacePaymentItem,
    MilestoneSummary,
)
from app.services.audit import log_activity

router = APIRouter(prefix="/cases", tags=["cases"])

DEFAULT_PORTAL_PERMISSIONS = {
    "show_case_status_progress": True,
    "show_milestone_details": True,
    "show_document_requirements": True,
    "portal_access": "full_access",
    "document_upload": "enabled",
    "messaging": "two_way",
}

ALLOWED_PORTAL_ACCESS = {"full_access", "limited_access", "read_only", "disabled"}
ALLOWED_DOCUMENT_UPLOAD = {"enabled", "disabled"}
ALLOWED_MESSAGING = {"two_way", "one_way", "disabled"}
ALLOWED_DOCUMENT_STATUSES = {
    "pending",
    "received",
    "under_review",
    "approved",
    "rejected",
    "needs_revision",
    "expired",
    "not_requested",
}
ALLOWED_CASE_PRIORITIES = {"low", "medium", "high", "urgent"}
ALLOWED_CASE_STATUSES = {
    "intake",
    "document_collection",
    "document_review",
    "application_prep",
    "ready_to_submit",
    "submitted",
    "under_review",
    "additional_documents_requested",
    "decision_pending",
    "approved",
    "refused",
    "withdrawn",
    "closed",
}
ALLOWED_MILESTONE_STATUSES = {
    "not_started",
    "in_progress",
    "blocked",
    "completed",
    "skipped",
}


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _date_or_none(value: Optional[date]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def _milestone_completion_from_status(status: str) -> int:
    completion_map = {
        "not_started": 0,
        "in_progress": 60,
        "blocked": 20,
        "completed": 100,
        "skipped": 100,
    }
    return completion_map.get(status, 0)


def _workspace_milestone_from_row(row: Any) -> CaseWorkspaceMilestone:
    dependencies = row.get("depends_on") if isinstance(row, dict) else getattr(row, "depends_on", None)
    dependency_values = dependencies or []
    return CaseWorkspaceMilestone(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        status=row["status"],
        due_date=row["due_date"],
        completion_percentage=row["completion_percentage"],
        client_visible=bool(row["client_visible"]),
        dependencies=[str(dependency_id) for dependency_id in dependency_values],
        completed_at=row["completed_at"],
    )


def _progress_from_status(status: str) -> int:
    progress_map = {
        "intake": 15,
        "document_collection": 35,
        "document_review": 55,
        "application_prep": 70,
        "ready_to_submit": 85,
        "submitted": 92,
        "under_review": 95,
        "approved": 100,
        "closed": 100,
        "withdrawn": 100,
        "refused": 100,
    }
    return progress_map.get(status, 40)


def _normalize_token(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def _generate_case_number(db: Session, organization_id: UUID) -> str:
    year = date.today().year
    prefix_like = f"C-{year}-%"
    capture_pattern = f"^C-{year}-([0-9]+)$"

    max_suffix = db.execute(
        text(
            """
            SELECT COALESCE(MAX(CAST(substring(case_number FROM :capture_pattern) AS INTEGER)), 0)
            FROM cases
            WHERE organization_id = :organization_id
              AND deleted_at IS NULL
              AND case_number LIKE :prefix_like
            """
        ),
        {
            "organization_id": organization_id,
            "prefix_like": prefix_like,
            "capture_pattern": capture_pattern,
        },
    ).scalar_one()

    next_suffix = int(max_suffix) + 1
    return f"C-{year}-{next_suffix:03d}"


def _normalized_portal_permissions(raw: Any) -> dict[str, Any]:
    normalized = dict(DEFAULT_PORTAL_PERMISSIONS)
    if not isinstance(raw, dict):
        return normalized

    for key in ["show_case_status_progress", "show_milestone_details", "show_document_requirements"]:
        if key in raw:
            normalized[key] = bool(raw[key])

    portal_access = str(raw.get("portal_access", normalized["portal_access"])).strip().lower()
    if portal_access in ALLOWED_PORTAL_ACCESS:
        normalized["portal_access"] = portal_access

    document_upload = str(raw.get("document_upload", normalized["document_upload"])).strip().lower()
    if document_upload in ALLOWED_DOCUMENT_UPLOAD:
        normalized["document_upload"] = document_upload

    messaging = str(raw.get("messaging", normalized["messaging"])).strip().lower()
    if messaging in ALLOWED_MESSAGING:
        normalized["messaging"] = messaging

    return normalized


def _normalized_custom_document_suites(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []

    normalized: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    for suite in raw:
        if not isinstance(suite, dict):
            continue

        suite_id = str(suite.get("id") or "").strip()
        name = str(suite.get("name") or "").strip()
        if not suite_id or not name or suite_id in seen_ids:
            continue

        reason = str(suite.get("reason") or "").strip() or "Custom document suite"
        normalized.append({"id": suite_id, "name": name, "reason": reason})
        seen_ids.add(suite_id)

    return normalized


def _normalized_document_status_overrides(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}

    normalized: dict[str, str] = {}
    for key, value in raw.items():
        doc_id = str(key).strip()
        status_value = _normalize_token(str(value)) if value is not None else ""
        if not doc_id or status_value not in ALLOWED_DOCUMENT_STATUSES:
            continue
        normalized[doc_id] = status_value
    return normalized


def _normalized_document_name_overrides(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}

    normalized: dict[str, str] = {}
    for key, value in raw.items():
        doc_id = str(key).strip()
        name = str(value or "").strip()
        if not doc_id or not name:
            continue
        normalized[doc_id] = name
    return normalized


def _normalized_hidden_document_ids(raw: Any) -> set[str]:
    if not isinstance(raw, list):
        return set()
    return {str(value).strip() for value in raw if str(value).strip()}


def _normalized_iso_date(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    if isinstance(raw, date):
        return raw.isoformat()

    value = str(raw).strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def _normalized_custom_documents(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []

    normalized: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for doc in raw:
        if not isinstance(doc, dict):
            continue

        doc_id = str(doc.get("id") or "").strip()
        name = str(doc.get("name") or "").strip()
        if not doc_id or not name or doc_id in seen_ids:
            continue

        suite_id = str(doc.get("suite_id") or "").strip() or None
        status_value = _normalize_token(str(doc.get("status") or ""))
        status = status_value if status_value in ALLOWED_DOCUMENT_STATUSES else None

        normalized.append(
            {
                "id": doc_id,
                "name": name,
                "suite_id": suite_id,
                "required": bool(doc.get("required", True)),
                "due_date": _normalized_iso_date(doc.get("due_date")),
                "instructions": (str(doc.get("instructions") or "").strip() or None),
                "status": status,
            }
        )
        seen_ids.add(doc_id)

    return normalized


def _get_case_with_write_access(
    *,
    case_number: str,
    auth: AuthContext,
    db: Session,
) -> Case:
    case = db.scalar(
        select(Case).where(
            Case.case_number == case_number,
            Case.organization_id == auth.organization_id,
            Case.deleted_at.is_(None),
        )
    )
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    if "super_admin" not in auth.roles and "org_admin" not in auth.roles:
        if case.primary_lawyer_id != auth.user_id and case.created_by != auth.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to modify this case")

    return case


@router.post("", response_model=CaseListItem, status_code=status.HTTP_201_CREATED)
def create_case(
    payload: CaseCreateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseListItem:
    if "super_admin" not in auth.roles and payload.organization_id != auth.organization_id:
        raise HTTPException(status_code=403, detail="Cross-organization access is not allowed")

    organization_exists = db.scalar(
        select(Organization.id).where(
            Organization.id == payload.organization_id, Organization.deleted_at.is_(None)
        )
    )
    if organization_exists is None:
        raise HTTPException(status_code=400, detail="Organization not found")

    client_user = db.scalar(
        select(User).where(User.id == payload.client_id, User.deleted_at.is_(None))
    )
    if client_user is None:
        raise HTTPException(status_code=400, detail="Client user not found")

    if client_user.organization_id != payload.organization_id:
        raise HTTPException(
            status_code=400,
            detail="Client user does not belong to the selected organization",
        )

    primary_lawyer = None
    if payload.primary_lawyer_id is not None:
        primary_lawyer = db.scalar(
            select(User).where(
                User.id == payload.primary_lawyer_id, User.deleted_at.is_(None)
            )
        )
        if primary_lawyer is None:
            raise HTTPException(status_code=400, detail="Primary lawyer not found")
        if primary_lawyer.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=400,
                detail="Primary lawyer does not belong to the selected organization",
            )

    case_type = payload.case_type.strip()
    if not case_type:
        raise HTTPException(status_code=400, detail="case_type is required")

    normalized_priority = _normalize_token(payload.priority)
    if normalized_priority not in ALLOWED_CASE_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid priority value")

    normalized_status = _normalize_token(payload.status)
    if normalized_status not in ALLOWED_CASE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status value")

    case_number = (
        payload.case_number.strip() if payload.case_number and payload.case_number.strip() else None
    )
    if case_number is None:
        case_number = _generate_case_number(db, payload.organization_id)

    existing_case = db.scalar(
        select(Case.id).where(
            Case.organization_id == payload.organization_id,
            Case.case_number == case_number,
            Case.deleted_at.is_(None),
        )
    )
    if existing_case is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Case number already exists in this organization",
        )

    new_case = Case(
        organization_id=payload.organization_id,
        case_number=case_number,
        client_id=payload.client_id,
        primary_lawyer_id=payload.primary_lawyer_id,
        case_type=case_type,
        status=normalized_status,
        priority=normalized_priority,
        intake_date=date.today(),
        target_filing_date=payload.target_filing_date,
        description=payload.description,
        internal_notes=payload.internal_notes,
        created_by=auth.user_id,
    )
    db.add(new_case)
    db.flush()
    db.add(
        CaseClient(
            case_id=new_case.id,
            client_user_id=payload.client_id,
            relationship_type="primary",
            status="active",
            invited_by=auth.user_id,
        )
    )
    db.commit()
    db.refresh(new_case)

    return CaseListItem(
        id=new_case.id,
        organization_id=new_case.organization_id,
        case_number=new_case.case_number,
        case_type=new_case.case_type,
        status=new_case.status,
        priority=new_case.priority,
        client_name=f"{client_user.first_name} {client_user.last_name}",
        primary_lawyer_name=(
            f"{primary_lawyer.first_name} {primary_lawyer.last_name}"
            if primary_lawyer is not None
            else None
        ),
        target_filing_date=new_case.target_filing_date,
        created_at=new_case.created_at,
    )


@router.get("", response_model=list[CaseListItem])
def list_cases(
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> list[CaseListItem]:
    client_user = aliased(User)
    lawyer_user = aliased(User)

    stmt = (
        select(
            Case,
            client_user.first_name,
            client_user.last_name,
            lawyer_user.first_name,
            lawyer_user.last_name,
        )
        .join(client_user, client_user.id == Case.client_id)
        .outerjoin(lawyer_user, lawyer_user.id == Case.primary_lawyer_id)
        .where(Case.deleted_at.is_(None), Case.organization_id == auth.organization_id)
        .order_by(Case.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    if "super_admin" not in auth.roles and "org_admin" not in auth.roles:
        stmt = stmt.where((Case.primary_lawyer_id == auth.user_id) | (Case.created_by == auth.user_id))

    if status:
        stmt = stmt.where(cast(Case.status, String) == status)

    rows = db.execute(stmt).all()

    return [
        CaseListItem(
            id=case.id,
            organization_id=case.organization_id,
            case_number=case.case_number,
            case_type=case.case_type,
            status=case.status,
            priority=case.priority,
            client_name=f"{client_first} {client_last}",
            primary_lawyer_name=(
                f"{lawyer_first} {lawyer_last}" if lawyer_first and lawyer_last else None
            ),
            target_filing_date=case.target_filing_date,
            created_at=case.created_at,
        )
        for case, client_first, client_last, lawyer_first, lawyer_last in rows
    ]


@router.get("/by-number/{case_number}", response_model=CaseSummary)
def get_case_by_number(
    case_number: str,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin", "client")),
    db: Session = Depends(get_db),
) -> CaseSummary:
    client_user = aliased(User)
    lawyer_user = aliased(User)

    stmt = (
        select(
            Case,
            client_user.first_name,
            client_user.last_name,
            lawyer_user.first_name,
            lawyer_user.last_name,
        )
        .join(client_user, client_user.id == Case.client_id)
        .outerjoin(lawyer_user, lawyer_user.id == Case.primary_lawyer_id)
        .where(
            Case.case_number == case_number,
            Case.organization_id == auth.organization_id,
            Case.deleted_at.is_(None),
        )
        .limit(1)
    )

    if "super_admin" not in auth.roles and "org_admin" not in auth.roles:
        if "lawyer" in auth.roles:
            stmt = stmt.where((Case.primary_lawyer_id == auth.user_id) | (Case.created_by == auth.user_id))
        elif "client" in auth.roles:
            client_membership = (
                select(CaseClient.id)
                .where(
                    CaseClient.case_id == Case.id,
                    CaseClient.client_user_id == auth.user_id,
                    CaseClient.removed_at.is_(None),
                )
                .exists()
            )
            stmt = stmt.where((Case.client_id == auth.user_id) | client_membership)

    row = db.execute(stmt).first()

    if row is None:
        raise HTTPException(status_code=404, detail="Case not found")

    case, client_first, client_last, lawyer_first, lawyer_last = row
    milestone_rows = db.execute(
        select(
            Milestone.id,
            Milestone.name,
            Milestone.status,
            Milestone.due_date,
            Milestone.completion_percentage,
        )
        .where(Milestone.case_id == case.id)
        .order_by(Milestone.sort_order.asc(), Milestone.due_date.asc())
    ).all()

    return CaseSummary(
        id=case.id,
        case_number=case.case_number,
        case_type=case.case_type,
        status=case.status,
        priority=case.priority,
        client_name=f"{client_first} {client_last}",
        primary_lawyer_name=(f"{lawyer_first} {lawyer_last}" if lawyer_first and lawyer_last else None),
        target_filing_date=case.target_filing_date,
        estimated_completion_from=case.estimated_completion_from,
        estimated_completion_to=case.estimated_completion_to,
        description=case.description,
        internal_notes=case.internal_notes,
        milestones=[
            MilestoneSummary(
                id=milestone_row.id,
                name=milestone_row.name,
                status=milestone_row.status,
                due_date=milestone_row.due_date,
                completion_percentage=milestone_row.completion_percentage,
            )
            for milestone_row in milestone_rows
        ],
    )


@router.patch("/by-number/{case_number}", response_model=CaseDetailsUpdateResponse)
def update_case_details_by_number(
    case_number: str,
    payload: CaseDetailsUpdateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseDetailsUpdateResponse:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    case_type = payload.case_type.strip()
    if not case_type:
        raise HTTPException(status_code=400, detail="case_type is required")
    if len(case_type) > 100:
        raise HTTPException(status_code=400, detail="case_type must be 100 characters or fewer")

    normalized_priority = _normalize_token(payload.priority)
    if normalized_priority not in ALLOWED_CASE_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid priority value")

    normalized_status = _normalize_token(payload.status)
    if normalized_status not in ALLOWED_CASE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status value")

    normalized_description = (payload.description or "").strip() or None
    normalized_internal_notes = (payload.internal_notes or "").strip() or None

    old_values = {
        "case_type": case.case_type,
        "priority": case.priority,
        "status": case.status,
        "target_filing_date": _date_or_none(case.target_filing_date),
        "description": case.description,
        "internal_notes": case.internal_notes,
    }

    case.case_type = case_type
    case.priority = normalized_priority
    case.status = normalized_status
    case.target_filing_date = payload.target_filing_date
    case.description = normalized_description
    case.internal_notes = normalized_internal_notes
    case.updated_at = datetime.now(timezone.utc)

    new_values = {
        "case_type": case.case_type,
        "priority": case.priority,
        "status": case.status,
        "target_filing_date": _date_or_none(case.target_filing_date),
        "description": case.description,
        "internal_notes": case.internal_notes,
    }

    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="updated",
        entity_type="case",
        entity_id=case.id,
        case_id=case.id,
        client_id=case.client_id,
        old_values=old_values,
        new_values=new_values,
    )

    db.add(case)
    db.commit()
    db.refresh(case)

    return CaseDetailsUpdateResponse(
        case_number=case.case_number,
        case_type=case.case_type,
        priority=case.priority,
        status=case.status,
        target_filing_date=case.target_filing_date,
        description=case.description,
        internal_notes=case.internal_notes,
        updated_at=case.updated_at,
    )


@router.post(
    "/by-number/{case_number}/milestones",
    response_model=CaseWorkspaceMilestone,
    status_code=status.HTTP_201_CREATED,
)
def create_case_milestone(
    case_number: str,
    payload: CaseMilestoneCreateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseWorkspaceMilestone:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Milestone name is required")
    if len(name) > 255:
        raise HTTPException(status_code=400, detail="Milestone name must be 255 characters or fewer")

    normalized_status = _normalize_token(payload.status)
    if normalized_status not in ALLOWED_MILESTONE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid milestone status")

    completion_percentage = _milestone_completion_from_status(normalized_status)
    completed_at = datetime.now(timezone.utc) if normalized_status == "completed" else None

    next_sort_order = db.execute(
        text(
            """
            SELECT COALESCE(MAX(sort_order), 0) + 1
            FROM milestones
            WHERE case_id = :case_id
            """
        ),
        {"case_id": str(case.id)},
    ).scalar_one()

    inserted_row = db.execute(
        text(
            """
            INSERT INTO milestones (
                case_id,
                name,
                description,
                due_date,
                status,
                completion_percentage,
                client_visible,
                sort_order,
                created_by,
                completed_by,
                completed_at,
                created_at,
                updated_at
            )
            VALUES (
                :case_id,
                :name,
                :description,
                :due_date,
                :status,
                :completion_percentage,
                :client_visible,
                :sort_order,
                :created_by,
                :completed_by,
                :completed_at,
                NOW(),
                NOW()
            )
            RETURNING
                id,
                name,
                description,
                status,
                due_date,
                completion_percentage,
                client_visible,
                depends_on,
                completed_at
            """
        ),
        {
            "case_id": str(case.id),
            "name": name,
            "description": (payload.description or "").strip() or None,
            "due_date": payload.due_date,
            "status": normalized_status,
            "completion_percentage": completion_percentage,
            "client_visible": payload.client_visible,
            "sort_order": next_sort_order,
            "created_by": str(auth.user_id),
            "completed_by": str(auth.user_id) if completed_at is not None else None,
            "completed_at": completed_at,
        },
    ).mappings().one()

    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="created",
        entity_type="milestone",
        entity_id=inserted_row["id"],
        case_id=case.id,
        client_id=case.client_id,
        new_values={
            "name": inserted_row["name"],
            "status": inserted_row["status"],
            "due_date": _date_or_none(inserted_row["due_date"]),
            "client_visible": bool(inserted_row["client_visible"]),
        },
    )

    db.commit()
    return _workspace_milestone_from_row(inserted_row)


@router.patch(
    "/by-number/{case_number}/milestones/{milestone_id}",
    response_model=CaseWorkspaceMilestone,
)
def update_case_milestone(
    case_number: str,
    milestone_id: str,
    payload: CaseMilestoneUpdateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseWorkspaceMilestone:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    try:
        milestone_uuid = UUID(milestone_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid milestone id") from exc

    existing_row = db.execute(
        text(
            """
            SELECT
                id,
                name,
                description,
                status,
                due_date,
                completion_percentage,
                client_visible,
                depends_on,
                completed_by,
                completed_at
            FROM milestones
            WHERE id = :milestone_id AND case_id = :case_id
            LIMIT 1
            """
        ),
        {"milestone_id": str(milestone_uuid), "case_id": str(case.id)},
    ).mappings().first()
    if existing_row is None:
        raise HTTPException(status_code=404, detail="Milestone not found")

    provided_fields = payload.model_fields_set
    next_name = existing_row["name"]
    next_description = existing_row["description"]
    next_due_date = existing_row["due_date"]
    next_status = existing_row["status"]
    next_client_visible = bool(existing_row["client_visible"])

    if "name" in provided_fields and payload.name is not None:
        normalized_name = payload.name.strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Milestone name is required")
        if len(normalized_name) > 255:
            raise HTTPException(status_code=400, detail="Milestone name must be 255 characters or fewer")
        next_name = normalized_name

    if "description" in provided_fields:
        next_description = (payload.description or "").strip() or None

    if "due_date" in provided_fields:
        next_due_date = payload.due_date

    if "client_visible" in provided_fields and payload.client_visible is not None:
        next_client_visible = bool(payload.client_visible)

    if "status" in provided_fields and payload.status is not None:
        normalized_status = _normalize_token(payload.status)
        if normalized_status not in ALLOWED_MILESTONE_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid milestone status")
        next_status = normalized_status

    next_completion = existing_row["completion_percentage"]
    next_completed_by = existing_row["completed_by"]
    next_completed_at = existing_row["completed_at"]
    if "status" in provided_fields and payload.status is not None:
        next_completion = _milestone_completion_from_status(next_status)
        if next_status == "completed":
            next_completed_by = existing_row["completed_by"] or auth.user_id
            next_completed_at = existing_row["completed_at"] or datetime.now(timezone.utc)
        else:
            next_completed_by = None
            next_completed_at = None

    updated_row = db.execute(
        text(
            """
            UPDATE milestones
            SET
                name = :name,
                description = :description,
                due_date = :due_date,
                status = :status,
                completion_percentage = :completion_percentage,
                client_visible = :client_visible,
                completed_by = :completed_by,
                completed_at = :completed_at,
                updated_at = NOW()
            WHERE id = :milestone_id AND case_id = :case_id
            RETURNING
                id,
                name,
                description,
                status,
                due_date,
                completion_percentage,
                client_visible,
                depends_on,
                completed_at
            """
        ),
        {
            "milestone_id": str(milestone_uuid),
            "case_id": str(case.id),
            "name": next_name,
            "description": next_description,
            "due_date": next_due_date,
            "status": next_status,
            "completion_percentage": next_completion,
            "client_visible": next_client_visible,
            "completed_by": str(next_completed_by) if next_completed_by is not None else None,
            "completed_at": next_completed_at,
        },
    ).mappings().one()

    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="updated",
        entity_type="milestone",
        entity_id=updated_row["id"],
        case_id=case.id,
        client_id=case.client_id,
        old_values={
            "name": existing_row["name"],
            "description": existing_row["description"],
            "status": existing_row["status"],
            "due_date": _date_or_none(existing_row["due_date"]),
            "client_visible": bool(existing_row["client_visible"]),
        },
        new_values={
            "name": updated_row["name"],
            "description": updated_row["description"],
            "status": updated_row["status"],
            "due_date": _date_or_none(updated_row["due_date"]),
            "client_visible": bool(updated_row["client_visible"]),
        },
    )

    db.commit()
    return _workspace_milestone_from_row(updated_row)


@router.delete("/by-number/{case_number}/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case_milestone(
    case_number: str,
    milestone_id: str,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> None:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    try:
        milestone_uuid = UUID(milestone_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid milestone id") from exc

    removed_row = db.execute(
        text(
            """
            DELETE FROM milestones
            WHERE id = :milestone_id AND case_id = :case_id
            RETURNING id, name, status, due_date, client_visible
            """
        ),
        {"milestone_id": str(milestone_uuid), "case_id": str(case.id)},
    ).mappings().first()
    if removed_row is None:
        raise HTTPException(status_code=404, detail="Milestone not found")

    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="deleted",
        entity_type="milestone",
        entity_id=removed_row["id"],
        case_id=case.id,
        client_id=case.client_id,
        old_values={
            "name": removed_row["name"],
            "status": removed_row["status"],
            "due_date": _date_or_none(removed_row["due_date"]),
            "client_visible": bool(removed_row["client_visible"]),
        },
    )

    db.commit()


@router.post(
    "/by-number/{case_number}/messages",
    response_model=CaseWorkspaceMessage,
    status_code=status.HTTP_201_CREATED,
)
def create_case_message(
    case_number: str,
    payload: CaseMessageCreateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseWorkspaceMessage:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    subject = payload.subject.strip()
    body = payload.body.strip()
    if not subject:
        raise HTTPException(status_code=400, detail="Subject is required")
    if len(subject) > 255:
        raise HTTPException(status_code=400, detail="Subject must be 255 characters or fewer")
    if not body:
        raise HTTPException(status_code=400, detail="Message body is required")

    inserted_row = db.execute(
        text(
            """
            INSERT INTO messages (
                case_id,
                sender_id,
                recipient_id,
                subject,
                body,
                is_draft,
                sent_at,
                visible_to_client,
                created_at,
                updated_at
            )
            VALUES (
                :case_id,
                :sender_id,
                :recipient_id,
                :subject,
                :body,
                FALSE,
                NOW(),
                :visible_to_client,
                NOW(),
                NOW()
            )
            RETURNING id, subject, body, sent_at, read_at
            """
        ),
        {
            "case_id": str(case.id),
            "sender_id": str(auth.user_id),
            "recipient_id": str(case.client_id),
            "subject": subject,
            "body": body,
            "visible_to_client": payload.visible_to_client,
        },
    ).mappings().one()

    sender_name = f"{auth.user.first_name} {auth.user.last_name}".strip() if auth.user else "Firm"
    if not sender_name:
        sender_name = "Firm"

    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="created",
        entity_type="message",
        entity_id=inserted_row["id"],
        case_id=case.id,
        client_id=case.client_id,
        new_values={
            "subject": subject,
            "visible_to_client": payload.visible_to_client,
            "send_email": payload.send_email,
        },
    )

    db.commit()
    return CaseWorkspaceMessage(
        id=inserted_row["id"],
        sender_name=sender_name,
        subject=inserted_row["subject"] or "(No subject)",
        body=inserted_row["body"] or "",
        sent_at=inserted_row["sent_at"],
        read_at=inserted_row["read_at"],
        from_client=False,
    )


@router.get("/by-number/{case_number}/workspace", response_model=CaseWorkspace)
def get_case_workspace_by_number(
    case_number: str,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin", "client")),
    db: Session = Depends(get_db),
) -> CaseWorkspace:
    case_row = db.execute(
        text(
            """
            SELECT
                c.id,
                c.organization_id,
                c.client_id,
                c.primary_lawyer_id,
                c.created_by,
                c.case_number,
                c.case_type,
                c.status,
                c.priority,
                c.start_date,
                c.target_filing_date,
                c.estimated_completion_from,
                c.estimated_completion_to,
                c.completion_confidence,
                c.description,
                c.internal_notes,
                c.custom_fields,
                CONCAT(cu.first_name, ' ', cu.last_name) AS client_name,
                CASE
                    WHEN lu.id IS NULL THEN NULL
                    ELSE CONCAT(lu.first_name, ' ', lu.last_name)
                END AS primary_lawyer_name
            FROM cases c
            JOIN users cu ON cu.id = c.client_id
            LEFT JOIN users lu ON lu.id = c.primary_lawyer_id
            WHERE
                c.case_number = :case_number
                AND c.organization_id = :organization_id
                AND c.deleted_at IS NULL
            LIMIT 1
            """
        ),
        {"case_number": case_number, "organization_id": str(auth.organization_id)},
    ).mappings().first()

    if case_row is None:
        raise HTTPException(status_code=404, detail="Case not found")

    if "super_admin" not in auth.roles and "org_admin" not in auth.roles:
        if "lawyer" in auth.roles:
            if case_row["primary_lawyer_id"] != auth.user_id and case_row["created_by"] != auth.user_id:
                raise HTTPException(status_code=404, detail="Case not found")
        elif "client" in auth.roles:
            if case_row["client_id"] != auth.user_id:
                case_membership = db.execute(
                    text(
                        """
                        SELECT 1
                        FROM case_clients
                        WHERE case_id = :case_id
                          AND client_user_id = :client_id
                          AND removed_at IS NULL
                        LIMIT 1
                        """
                    ),
                    {"case_id": str(case_row["id"]), "client_id": str(auth.user_id)},
                ).first()
                if case_membership is None:
                    raise HTTPException(status_code=404, detail="Case not found")

    case_id = case_row["id"]
    organization_id = case_row["organization_id"]
    case_type = case_row["case_type"]
    client_id = case_row["client_id"]
    custom_fields = case_row["custom_fields"] if isinstance(case_row.get("custom_fields"), dict) else {}
    document_status_overrides = _normalized_document_status_overrides(
        custom_fields.get("document_status_overrides")
    )
    document_name_overrides = _normalized_document_name_overrides(
        custom_fields.get("document_name_overrides")
    )
    hidden_document_ids = _normalized_hidden_document_ids(
        custom_fields.get("hidden_document_ids")
    )
    custom_documents = _normalized_custom_documents(custom_fields.get("custom_documents"))
    portal_permissions_payload = _normalized_portal_permissions(custom_fields.get("portal_permissions"))
    is_client_portal_view = (
        "client" in auth.roles
        and "lawyer" not in auth.roles
        and "org_admin" not in auth.roles
        and "super_admin" not in auth.roles
    )
    portal_access = portal_permissions_payload["portal_access"]
    client_can_view_case_status = (
        portal_access in {"full_access", "read_only"}
        and bool(portal_permissions_payload["show_case_status_progress"])
    )
    client_can_view_milestones = (
        portal_access == "full_access"
        and bool(portal_permissions_payload["show_milestone_details"])
    )
    client_can_view_documents = (
        portal_access != "disabled"
        and bool(portal_permissions_payload["show_document_requirements"])
    )
    client_can_view_messages = (
        portal_access != "disabled"
        and portal_permissions_payload["messaging"] != "disabled"
    )
    client_can_view_billing = portal_access in {"full_access", "read_only"}

    document_rows = db.execute(
        text(
            """
            SELECT
                ds.id AS suite_id,
                ds.name AS suite_name,
                ds.description AS suite_description,
                ds.is_system AS suite_is_system,
                dt.id AS template_id,
                dt.name AS template_name,
                dt.instructions,
                dt.is_required,
                COALESCE(cd.status, CASE WHEN dt.is_required THEN 'pending' ELSE 'not_requested' END) AS doc_status,
                cd.uploaded_at,
                cd.expiry_date
            FROM document_suites ds
            LEFT JOIN document_templates dt ON dt.suite_id = ds.id AND dt.is_active = TRUE
            LEFT JOIN LATERAL (
                SELECT
                    cdx.status,
                    cdx.uploaded_at,
                    cdx.expiry_date
                FROM case_documents cdx
                WHERE
                    cdx.case_id = :case_id
                    AND cdx.template_id = dt.id
                    AND cdx.deleted_at IS NULL
                ORDER BY cdx.uploaded_at DESC NULLS LAST, cdx.created_at DESC
                LIMIT 1
            ) cd ON TRUE
            WHERE
                ds.is_active = TRUE
                AND (ds.organization_id IS NULL OR ds.organization_id = :organization_id)
                AND (
                    ds.case_types IS NULL
                    OR cardinality(ds.case_types) = 0
                    OR :case_type = ANY(ds.case_types)
                )
            ORDER BY ds.sort_order, ds.name, dt.sort_order, dt.name
            """
        ),
        {
            "case_id": case_id,
            "organization_id": organization_id,
            "case_type": case_type,
        },
    ).mappings().all()

    suites_map: dict[str, dict[str, Any]] = {}
    for document_row in document_rows:
        suite_id = str(document_row["suite_id"])
        if suite_id not in suites_map:
            suites_map[suite_id] = {
                "id": suite_id,
                "name": document_row["suite_name"],
                "reason": document_row["suite_description"] or "Required for this case type",
                "recommended": bool(document_row["suite_is_system"]),
                "documents": [],
            }

        template_id = document_row["template_id"]
        if template_id is not None:
            template_id_str = str(template_id)
            if template_id_str in hidden_document_ids:
                continue
            suites_map[suite_id]["documents"].append(
                CaseWorkspaceDocument(
                    id=template_id_str,
                    name=document_name_overrides.get(template_id_str, document_row["template_name"]),
                    required=bool(document_row["is_required"]),
                    status=document_status_overrides.get(template_id_str, document_row["doc_status"]),
                    due_date=document_row["expiry_date"],
                    uploaded_at=document_row["uploaded_at"],
                    instructions=document_row["instructions"],
                )
            )

    custom_document_rows = db.execute(
        text(
            """
            SELECT
                id,
                name,
                status,
                uploaded_at,
                expiry_date
            FROM case_documents
            WHERE
                case_id = :case_id
                AND template_id IS NULL
                AND deleted_at IS NULL
            ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
            """
        ),
        {"case_id": case_id},
    ).mappings().all()

    custom_upload_documents = []
    for custom_document_row in custom_document_rows:
        custom_document_id = str(custom_document_row["id"])
        if custom_document_id in hidden_document_ids:
            continue

        custom_upload_documents.append(
            CaseWorkspaceDocument(
                id=custom_document_id,
                name=document_name_overrides.get(custom_document_id, custom_document_row["name"]),
                required=False,
                status=document_status_overrides.get(
                    custom_document_id,
                    custom_document_row["status"] or "received",
                ),
                due_date=custom_document_row["expiry_date"],
                uploaded_at=custom_document_row["uploaded_at"],
                instructions="",
            )
        )

    if custom_upload_documents:
        suites_map["custom_uploads"] = {
            "id": "custom_uploads",
            "name": "Custom Uploads",
            "reason": "Additional files uploaded outside standard template suites",
            "recommended": False,
            "documents": custom_upload_documents,
        }

    for custom_suite in _normalized_custom_document_suites(custom_fields.get("custom_document_suites")):
        if custom_suite["id"] not in suites_map:
            suites_map[custom_suite["id"]] = {
                "id": custom_suite["id"],
                "name": custom_suite["name"],
                "reason": custom_suite["reason"],
                "recommended": False,
                "documents": [],
            }

    for custom_document in custom_documents:
        custom_document_id = custom_document["id"]
        if custom_document_id in hidden_document_ids:
            continue

        suite_id = custom_document.get("suite_id") or "custom_uploads"
        if suite_id not in suites_map:
            suites_map[suite_id] = {
                "id": suite_id,
                "name": "Custom Uploads",
                "reason": "Additional custom document requests",
                "recommended": False,
                "documents": [],
            }

        default_status = custom_document["status"] or ("pending" if custom_document["required"] else "not_requested")
        suites_map[suite_id]["documents"].append(
            CaseWorkspaceDocument(
                id=custom_document_id,
                name=document_name_overrides.get(custom_document_id, custom_document["name"]),
                required=bool(custom_document["required"]),
                status=document_status_overrides.get(custom_document_id, default_status),
                due_date=custom_document["due_date"],
                uploaded_at=None,
                instructions=custom_document["instructions"],
            )
        )

    document_suites = [CaseWorkspaceDocumentSuite(**suite_value) for suite_value in suites_map.values()]
    documents = [document for suite in document_suites for document in suite.documents]

    milestone_rows = db.execute(
        text(
            """
            SELECT
                id,
                name,
                description,
                status,
                due_date,
                completion_percentage,
                client_visible,
                depends_on,
                completed_at
            FROM milestones
            WHERE case_id = :case_id
            ORDER BY sort_order, due_date NULLS LAST, created_at
            """
        ),
        {"case_id": case_id},
    ).mappings().all()

    milestones = [
        CaseWorkspaceMilestone(
            id=milestone_row["id"],
            name=milestone_row["name"],
            description=milestone_row["description"],
            status=milestone_row["status"],
            due_date=milestone_row["due_date"],
            completion_percentage=milestone_row["completion_percentage"],
            client_visible=bool(milestone_row["client_visible"]),
            dependencies=[str(dependency_id) for dependency_id in (milestone_row["depends_on"] or [])],
            completed_at=milestone_row["completed_at"],
        )
        for milestone_row in milestone_rows
    ]

    if is_client_portal_view:
        milestones = [milestone for milestone in milestones if milestone.client_visible]
        if not client_can_view_milestones:
            milestones = []

    payment_rows = db.execute(
        text(
            """
            SELECT
                i.id,
                i.invoice_number,
                i.status,
                i.total_amount,
                i.amount_paid,
                i.amount_due,
                i.due_date,
                i.paid_date,
                COALESCE(string_agg(ii.description, '; ' ORDER BY ii.sort_order), CONCAT('Invoice ', i.invoice_number)) AS description
            FROM invoices i
            LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
            WHERE i.case_id = :case_id
            GROUP BY i.id
            ORDER BY i.due_date NULLS LAST, i.created_at DESC
            """
        ),
        {"case_id": case_id},
    ).mappings().all()

    payment_items = [
        CaseWorkspacePaymentItem(
            id=str(payment_row["id"]),
            description=payment_row["description"],
            amount=_to_float(payment_row["total_amount"]),
            amount_paid=_to_float(payment_row["amount_paid"]),
            amount_due=_to_float(payment_row["amount_due"]),
            status=payment_row["status"],
            due_date=payment_row["due_date"],
            paid_date=payment_row["paid_date"],
            invoice_number=payment_row["invoice_number"],
        )
        for payment_row in payment_rows
    ]

    message_rows = db.execute(
        text(
            """
            SELECT
                m.id,
                COALESCE(CONCAT(su.first_name, ' ', su.last_name), 'System') AS sender_name,
                m.subject,
                m.body,
                m.sent_at,
                m.read_at,
                (m.sender_id = :client_id) AS from_client
            FROM messages m
            LEFT JOIN users su ON su.id = m.sender_id
            WHERE
                m.case_id = :case_id
                AND COALESCE(m.is_draft, FALSE) = FALSE
                AND (
                    :is_client_portal_view = FALSE
                    OR COALESCE(m.visible_to_client, TRUE) = TRUE
                )
            ORDER BY COALESCE(m.sent_at, m.created_at) DESC
            LIMIT 25
            """
        ),
        {
            "case_id": case_id,
            "client_id": client_id,
            "is_client_portal_view": is_client_portal_view,
        },
    ).mappings().all()

    messages = [
        CaseWorkspaceMessage(
            id=message_row["id"],
            sender_name=message_row["sender_name"],
            subject=message_row["subject"] or "(No subject)",
            body=message_row["body"] or "",
            sent_at=message_row["sent_at"],
            read_at=message_row["read_at"],
            from_client=bool(message_row["from_client"]),
        )
        for message_row in message_rows
    ]

    appointments = [
        CaseWorkspaceAppointment(
            title=milestone.name,
            date=milestone.due_date,
            time="TBD",
            appointment_type="Case Deadline",
        )
        for milestone in milestones
        if milestone.due_date is not None and milestone.status not in {"completed", "skipped"}
    ][:3]

    billing_row = db.execute(
        text(
            """
            SELECT
                COALESCE(SUM(total_amount), 0) AS total_fees,
                COALESCE(SUM(amount_paid), 0) AS total_paid,
                COALESCE(SUM(amount_due), 0) AS total_remaining,
                MIN(due_date) FILTER (
                    WHERE amount_due > 0 AND status NOT IN ('paid', 'cancelled', 'refunded')
                ) AS next_payment_due
            FROM invoices
            WHERE case_id = :case_id
            """
        ),
        {"case_id": case_id},
    ).mappings().first()

    payment_method_row = db.execute(
        text(
            """
            SELECT provider, brand, last_four
            FROM payment_methods
            WHERE client_id = :client_id AND is_active = TRUE
            ORDER BY is_default DESC, updated_at DESC NULLS LAST, created_at DESC
            LIMIT 1
            """
        ),
        {"client_id": client_id},
    ).mappings().first()

    payment_method = None
    if payment_method_row is not None:
        brand = payment_method_row["brand"]
        last_four = payment_method_row["last_four"]
        provider = payment_method_row["provider"]
        if brand and last_four:
            payment_method = f"{brand.title()} ending in {last_four}"
        elif provider:
            payment_method = str(provider).title()

    assignments_rows = db.execute(
        text(
            """
            SELECT
                ca.id,
                COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unassigned') AS member_name,
                COALESCE(ca.role, 'associate') AS role,
                ca.assigned_at
            FROM case_assignments ca
            LEFT JOIN users u ON u.id = ca.lawyer_id
            WHERE ca.case_id = :case_id AND ca.removed_at IS NULL
            ORDER BY ca.assigned_at DESC
            """
        ),
        {"case_id": case_id},
    ).mappings().all()

    assignments = [
        CaseWorkspaceAssignment(
            id=assignment_row["id"],
            member_name=assignment_row["member_name"],
            role=assignment_row["role"],
            assigned_at=assignment_row["assigned_at"],
        )
        for assignment_row in assignments_rows
    ]

    if milestones:
        progress_percent = int(round(sum(milestone.completion_percentage for milestone in milestones) / len(milestones)))
    else:
        progress_percent = _progress_from_status(case_row["status"])

    completion_confidence = case_row["completion_confidence"]
    if completion_confidence is None:
        completion_confidence = min(95, max(10, progress_percent))

    workspace_case = CaseWorkspaceInfo(
        id=case_row["id"],
        case_number=case_row["case_number"],
        case_type=case_row["case_type"],
        status=case_row["status"],
        priority=case_row["priority"],
        client_id=case_row["client_id"],
        client_name=case_row["client_name"],
        primary_lawyer_name=case_row["primary_lawyer_name"],
        start_date=case_row["start_date"],
        target_filing_date=case_row["target_filing_date"],
        estimated_completion_from=case_row["estimated_completion_from"],
        estimated_completion_to=case_row["estimated_completion_to"],
        completion_confidence=completion_confidence,
        progress_percent=progress_percent,
        description=case_row["description"],
        internal_notes=case_row["internal_notes"],
    )

    billing_summary = CaseWorkspaceBillingSummary(
        total_fees=_to_float(billing_row["total_fees"]) if billing_row else 0,
        paid=_to_float(billing_row["total_paid"]) if billing_row else 0,
        remaining=_to_float(billing_row["total_remaining"]) if billing_row else 0,
        next_payment=billing_row["next_payment_due"] if billing_row else None,
        payment_method=payment_method,
    )

    if is_client_portal_view:
        workspace_case.internal_notes = None
        assignments = []

        if not client_can_view_case_status:
            workspace_case.status = "restricted"
            workspace_case.progress_percent = 0
            workspace_case.completion_confidence = None
            workspace_case.target_filing_date = None
            workspace_case.estimated_completion_from = None
            workspace_case.estimated_completion_to = None

        if not client_can_view_documents:
            document_suites = []
            documents = []

        if not client_can_view_messages:
            messages = []

        if not client_can_view_billing:
            payment_items = []
            billing_summary = CaseWorkspaceBillingSummary(
                total_fees=0,
                paid=0,
                remaining=0,
                next_payment=None,
                payment_method=None,
            )

    return CaseWorkspace(
        case=workspace_case,
        document_suites=document_suites,
        documents=documents,
        milestones=milestones,
        payment_items=payment_items,
        messages=messages,
        appointments=appointments,
        billing_summary=billing_summary,
        assignments=assignments,
        portal_permissions=CasePortalPermissions(**portal_permissions_payload),
    )


@router.put("/by-number/{case_number}/permissions", response_model=CasePortalPermissions)
def update_case_portal_permissions(
    case_number: str,
    payload: CasePortalPermissionsUpdateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CasePortalPermissions:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    normalized_payload = _normalized_portal_permissions(payload.model_dump())
    custom_fields = case.custom_fields if isinstance(case.custom_fields, dict) else {}
    case.custom_fields = {**custom_fields, "portal_permissions": normalized_payload}

    db.add(case)
    db.commit()

    return CasePortalPermissions(**normalized_payload)


@router.post(
    "/by-number/{case_number}/custom-document-suites",
    response_model=CaseWorkspaceDocumentSuite,
    status_code=status.HTTP_201_CREATED,
)
def create_case_custom_document_suite(
    case_number: str,
    payload: CaseCustomDocumentSuiteCreateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseWorkspaceDocumentSuite:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Suite name is required")
    if len(name) > 255:
        raise HTTPException(status_code=400, detail="Suite name must be 255 characters or fewer")

    reason = (payload.description or "").strip() or "Custom document suite"

    custom_fields = case.custom_fields if isinstance(case.custom_fields, dict) else {}
    suites = _normalized_custom_document_suites(custom_fields.get("custom_document_suites"))
    normalized_name = name.lower()
    if any(existing_suite["name"].lower() == normalized_name for existing_suite in suites):
        raise HTTPException(status_code=409, detail="A custom suite with this name already exists")

    new_suite = {
        "id": str(uuid4()),
        "name": name,
        "reason": reason,
    }
    suites.append(new_suite)
    case.custom_fields = {**custom_fields, "custom_document_suites": suites}

    db.add(case)
    db.commit()

    return CaseWorkspaceDocumentSuite(
        id=new_suite["id"],
        name=new_suite["name"],
        reason=new_suite["reason"],
        recommended=False,
        documents=[],
    )


@router.post(
    "/by-number/{case_number}/documents/custom",
    response_model=CaseWorkspaceDocument,
    status_code=status.HTTP_201_CREATED,
)
def create_case_custom_document(
    case_number: str,
    payload: CaseCustomDocumentCreateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseWorkspaceDocument:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Document name is required")
    if len(name) > 255:
        raise HTTPException(status_code=400, detail="Document name must be 255 characters or fewer")

    suite_id = (payload.suite_id or "").strip() or None
    if suite_id is not None:
        template_suite_exists = db.execute(
            text(
                """
                SELECT 1
                FROM document_suites
                WHERE
                    is_active = TRUE
                    AND (organization_id IS NULL OR organization_id = :organization_id)
                    AND (
                        case_types IS NULL
                        OR cardinality(case_types) = 0
                        OR :case_type = ANY(case_types)
                    )
                    AND id = :suite_id
                LIMIT 1
                """
            ),
            {
                "organization_id": str(case.organization_id),
                "case_type": case.case_type,
                "suite_id": suite_id,
            },
        ).first()

        if template_suite_exists is None:
            custom_fields = case.custom_fields if isinstance(case.custom_fields, dict) else {}
            custom_suites = _normalized_custom_document_suites(custom_fields.get("custom_document_suites"))
            custom_suite_exists = any(custom_suite["id"] == suite_id for custom_suite in custom_suites)
            if not custom_suite_exists:
                raise HTTPException(status_code=400, detail="Document suite not found for this case")

    custom_fields = case.custom_fields if isinstance(case.custom_fields, dict) else {}
    custom_documents = _normalized_custom_documents(custom_fields.get("custom_documents"))
    new_document_id = str(uuid4())
    default_status = "pending" if payload.required else "not_requested"
    new_document = {
        "id": new_document_id,
        "name": name,
        "suite_id": suite_id,
        "required": bool(payload.required),
        "due_date": _normalized_iso_date(payload.due_date),
        "instructions": (payload.instructions or "").strip() or None,
        "status": default_status,
    }
    custom_documents.append(new_document)
    case.custom_fields = {**custom_fields, "custom_documents": custom_documents}

    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="created",
        entity_type="document",
        entity_id=None,
        case_id=case.id,
        client_id=case.client_id,
        new_values={
            "id": new_document_id,
            "name": name,
            "required": bool(payload.required),
            "suite_id": suite_id,
        },
    )

    db.add(case)
    db.commit()

    return CaseWorkspaceDocument(
        id=new_document_id,
        name=name,
        required=bool(payload.required),
        status=default_status,
        due_date=new_document["due_date"],
        uploaded_at=None,
        instructions=new_document["instructions"],
    )


@router.patch(
    "/by-number/{case_number}/documents/{document_id}",
    response_model=CaseDocumentRenameResponse,
)
def rename_case_document(
    case_number: str,
    document_id: str,
    payload: CaseDocumentRenameRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseDocumentRenameResponse:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    normalized_name = payload.name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Document name is required")
    if len(normalized_name) > 255:
        raise HTTPException(status_code=400, detail="Document name must be 255 characters or fewer")

    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc

    custom_fields = case.custom_fields if isinstance(case.custom_fields, dict) else {}
    custom_documents = _normalized_custom_documents(custom_fields.get("custom_documents"))
    custom_doc_updated = False
    for custom_document in custom_documents:
        if custom_document["id"] == str(document_uuid):
            custom_document["name"] = normalized_name
            custom_doc_updated = True
            break

    template_exists = db.execute(
        text(
            """
            SELECT 1
            FROM document_templates dt
            JOIN document_suites ds ON ds.id = dt.suite_id
            WHERE dt.id = :template_id
              AND dt.is_active = TRUE
              AND ds.is_active = TRUE
              AND (ds.organization_id IS NULL OR ds.organization_id = :organization_id)
              AND (
                ds.case_types IS NULL
                OR cardinality(ds.case_types) = 0
                OR :case_type = ANY(ds.case_types)
              )
            LIMIT 1
            """
        ),
        {
            "template_id": str(document_uuid),
            "organization_id": str(case.organization_id),
            "case_type": case.case_type,
        },
    ).first()

    case_document_exists = db.execute(
        text(
            """
            SELECT 1
            FROM case_documents
            WHERE id = :document_id
              AND case_id = :case_id
              AND deleted_at IS NULL
            LIMIT 1
            """
        ),
        {"document_id": str(document_uuid), "case_id": str(case.id)},
    ).first()

    if not custom_doc_updated and template_exists is None and case_document_exists is None:
        raise HTTPException(status_code=404, detail="Document not found for this case")

    name_overrides = _normalized_document_name_overrides(custom_fields.get("document_name_overrides"))
    name_overrides[str(document_uuid)] = normalized_name
    next_custom_fields = {**custom_fields, "document_name_overrides": name_overrides}
    if custom_doc_updated:
        next_custom_fields["custom_documents"] = custom_documents

    case.custom_fields = next_custom_fields

    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="updated",
        entity_type="document",
        entity_id=None,
        case_id=case.id,
        client_id=case.client_id,
        new_values={
            "document_id": str(document_uuid),
            "name": normalized_name,
        },
    )

    db.add(case)
    db.commit()

    return CaseDocumentRenameResponse(
        document_id=str(document_uuid),
        name=normalized_name,
    )


@router.delete("/by-number/{case_number}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case_document(
    case_number: str,
    document_id: str,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> None:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc

    custom_fields = case.custom_fields if isinstance(case.custom_fields, dict) else {}
    custom_documents = _normalized_custom_documents(custom_fields.get("custom_documents"))
    previous_count = len(custom_documents)
    custom_documents = [doc for doc in custom_documents if doc["id"] != str(document_uuid)]
    removed_custom_document = len(custom_documents) != previous_count

    removed_case_document = db.execute(
        text(
            """
            UPDATE case_documents
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = :document_id AND case_id = :case_id AND deleted_at IS NULL
            RETURNING id
            """
        ),
        {"document_id": str(document_uuid), "case_id": str(case.id)},
    ).first()

    template_exists = db.execute(
        text(
            """
            SELECT 1
            FROM document_templates dt
            JOIN document_suites ds ON ds.id = dt.suite_id
            WHERE dt.id = :template_id
              AND dt.is_active = TRUE
              AND ds.is_active = TRUE
              AND (ds.organization_id IS NULL OR ds.organization_id = :organization_id)
              AND (
                ds.case_types IS NULL
                OR cardinality(ds.case_types) = 0
                OR :case_type = ANY(ds.case_types)
              )
            LIMIT 1
            """
        ),
        {
            "template_id": str(document_uuid),
            "organization_id": str(case.organization_id),
            "case_type": case.case_type,
        },
    ).first()

    if not removed_custom_document and removed_case_document is None and template_exists is None:
        raise HTTPException(status_code=404, detail="Document not found for this case")

    hidden_document_ids = _normalized_hidden_document_ids(custom_fields.get("hidden_document_ids"))
    hidden_document_ids.add(str(document_uuid))

    name_overrides = _normalized_document_name_overrides(custom_fields.get("document_name_overrides"))
    name_overrides.pop(str(document_uuid), None)
    status_overrides = _normalized_document_status_overrides(custom_fields.get("document_status_overrides"))
    status_overrides.pop(str(document_uuid), None)

    case.custom_fields = {
        **custom_fields,
        "custom_documents": custom_documents,
        "hidden_document_ids": sorted(hidden_document_ids),
        "document_name_overrides": name_overrides,
        "document_status_overrides": status_overrides,
    }

    log_activity(
        db,
        organization_id=case.organization_id,
        user_id=auth.user_id,
        action="deleted",
        entity_type="document",
        entity_id=None,
        case_id=case.id,
        client_id=case.client_id,
        old_values={"document_id": str(document_uuid)},
    )

    db.add(case)
    db.commit()


@router.patch(
    "/by-number/{case_number}/documents/{document_id}/status",
    response_model=CaseDocumentStatusUpdateResponse,
)
def update_case_document_status(
    case_number: str,
    document_id: str,
    payload: CaseDocumentStatusUpdateRequest,
    auth: AuthContext = Depends(require_roles("lawyer", "org_admin", "super_admin")),
    db: Session = Depends(get_db),
) -> CaseDocumentStatusUpdateResponse:
    case = _get_case_with_write_access(case_number=case_number, auth=auth, db=db)

    normalized_status = _normalize_token(payload.status)
    if normalized_status not in ALLOWED_DOCUMENT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid document status")

    try:
        document_uuid = UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid document id") from exc

    case_document_exists = db.execute(
        text(
            """
            SELECT 1
            FROM case_documents
            WHERE id = :document_id
              AND case_id = :case_id
              AND deleted_at IS NULL
            LIMIT 1
            """
        ),
        {"document_id": str(document_uuid), "case_id": str(case.id)},
    ).first()

    template_exists = db.execute(
        text(
            """
            SELECT 1
            FROM document_templates dt
            JOIN document_suites ds ON ds.id = dt.suite_id
            WHERE dt.id = :template_id
              AND dt.is_active = TRUE
              AND ds.is_active = TRUE
              AND (ds.organization_id IS NULL OR ds.organization_id = :organization_id)
              AND (
                ds.case_types IS NULL
                OR cardinality(ds.case_types) = 0
                OR :case_type = ANY(ds.case_types)
              )
            LIMIT 1
            """
        ),
        {
            "template_id": str(document_uuid),
            "organization_id": str(case.organization_id),
            "case_type": case.case_type,
        },
    ).first()

    custom_fields = case.custom_fields if isinstance(case.custom_fields, dict) else {}
    custom_documents = _normalized_custom_documents(custom_fields.get("custom_documents"))
    custom_document_exists = any(
        custom_document["id"] == str(document_uuid) for custom_document in custom_documents
    )

    if case_document_exists is None and template_exists is None and not custom_document_exists:
        raise HTTPException(status_code=404, detail="Document not found for this case")

    status_overrides = _normalized_document_status_overrides(
        custom_fields.get("document_status_overrides")
    )

    if custom_document_exists:
        for custom_document in custom_documents:
            if custom_document["id"] == str(document_uuid):
                custom_document["status"] = normalized_status
                break
        status_overrides.pop(str(document_uuid), None)
        case.custom_fields = {
            **custom_fields,
            "custom_documents": custom_documents,
            "document_status_overrides": status_overrides,
        }
    else:
        status_overrides[str(document_uuid)] = normalized_status
        case.custom_fields = {**custom_fields, "document_status_overrides": status_overrides}

    db.add(case)
    db.commit()

    return CaseDocumentStatusUpdateResponse(
        document_id=str(document_uuid),
        status=normalized_status,
    )
