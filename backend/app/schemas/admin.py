from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AdminCreateOrganizationRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    contact_email: str = Field(min_length=3, max_length=255)
    slug: str = Field(min_length=2, max_length=100)
    subscription_tier: str = Field(default="basic", min_length=2, max_length=50)
    subscription_status: str = Field(default="active", min_length=2, max_length=50)


class AdminCreateUserRequest(BaseModel):
    organization_id: UUID
    email: str = Field(min_length=3, max_length=255)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    status: str = Field(default="active", min_length=2, max_length=50)
    role_slug: str = Field(default="lawyer", min_length=2, max_length=100)


class AdminCreateUserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    status: str
    organization_id: Optional[UUID]
    created_at: datetime
    roles: list[str] = Field(default_factory=list)
    invitation_url: Optional[str] = None


class AdminOverviewStats(BaseModel):
    organizations: int
    users: int
    active_users: int
    active_cases: int
    completed_cases: int


class AdminOverviewOrganization(BaseModel):
    id: UUID
    name: str
    slug: str
    contact_email: str
    subscription_status: str
    created_at: datetime


class AdminOverviewUser(BaseModel):
    id: UUID
    organization_id: Optional[UUID]
    email: str
    full_name: str
    status: str
    created_at: datetime


class AdminOverviewCase(BaseModel):
    id: UUID
    case_number: str
    case_type: str
    status: str
    priority: str
    client_name: str
    created_at: datetime


class AdminOverviewResponse(BaseModel):
    stats: AdminOverviewStats
    recent_organizations: list[AdminOverviewOrganization]
    recent_users: list[AdminOverviewUser]
    recent_cases: list[AdminOverviewCase]


class AdminRoleItem(BaseModel):
    id: UUID
    organization_id: Optional[UUID]
    name: str
    slug: str
    description: Optional[str]
    is_system: bool
    permissions: list[str]


class AdminAssignRoleRequest(BaseModel):
    role_slug: str = Field(min_length=2, max_length=100)


class AdminCaseAssignmentRequest(BaseModel):
    lawyer_user_id: Optional[UUID] = None


class AdminCaseAssignmentResponse(BaseModel):
    case_id: UUID
    case_number: str
    primary_lawyer_id: Optional[UUID]
    primary_lawyer_name: Optional[str]


class AdminOpsLawyerWorkloadItem(BaseModel):
    lawyer_user_id: UUID
    full_name: str
    active_cases: int


class AdminOpsCaseItem(BaseModel):
    case_id: UUID
    case_number: str
    case_type: str
    status: str
    priority: str
    created_at: datetime
    days_open: int
    primary_lawyer_id: Optional[UUID]
    primary_lawyer_name: Optional[str]


class AdminOpsInvitationItem(BaseModel):
    invitation_id: UUID
    user_id: UUID
    email: str
    role_slug: str
    created_at: datetime
    expires_at: datetime
    status: str
    invited_by_name: Optional[str]


class SendInvitationEmailRequest(BaseModel):
    to_email: str = Field(min_length=3, max_length=255)
    recipient_name: str = Field(min_length=1, max_length=200)
    invitation_url: str = Field(min_length=10, max_length=2000)
    organization_name: Optional[str] = Field(default=None, max_length=255)


class AdminOperationsResponse(BaseModel):
    organization_id: UUID
    unassigned_cases: list[AdminOpsCaseItem]
    aging_cases: list[AdminOpsCaseItem]
    lawyer_workload: list[AdminOpsLawyerWorkloadItem]
    pending_invitations: list[AdminOpsInvitationItem]
