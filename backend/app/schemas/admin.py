"""Admin Schemas: Pydantic models for administrator-specific operations. Handles org management and user administration requests."""
from datetime import datetime
from typing import Literal, Optional
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


class ResendInvitationResponse(BaseModel):
    invitation_url: str


# Rich-text templates are HTML, which is several times longer than the text it shows.
MAX_TEMPLATE_HTML_CHARS = 20000


class InvitationStyles(BaseModel):
    button_color: str = Field(default="#dc2626", max_length=7)
    button_label: str = Field(default="Activate my account", max_length=100)
    subject: str = Field(
        default="You have been invited to join {organization_name}",
        max_length=255,
    )
    bold_org_name: bool = True


class InvitationTemplateResponse(BaseModel):
    body: str
    is_custom: bool
    styles: InvitationStyles


class InvitationTemplateRequest(BaseModel):
    # The full template body: plain text, or HTML from the rich-text editor (sanitized on save).
    # Use {recipient_name}, {organization_name}, {invitation_url} as placeholders.
    # Send an empty string to reset to default.
    body: str = Field(max_length=MAX_TEMPLATE_HTML_CHARS)
    styles: InvitationStyles = Field(default_factory=InvitationStyles)


class NotificationTemplateItem(BaseModel):
    key: str
    label: str
    description: str
    body: str
    default_body: str
    subject: str
    default_subject: str
    is_custom: bool
    enabled: bool
    variables: list[str]


class EmailTemplatesOverviewResponse(BaseModel):
    banner_position: Literal["top", "bottom"]
    # Whether lawyers and admins can email invitation links from the app.
    invitation_enabled: bool = True
    # Placeholders the invitation template may use (it has its own endpoints for the body).
    invitation_variables: list[str] = Field(default_factory=list)
    templates: list[NotificationTemplateItem]


class NotificationTemplateRequest(BaseModel):
    # Plain text or rich-text HTML (sanitized on save). Send an empty string to reset to the default body.
    body: str = Field(max_length=MAX_TEMPLATE_HTML_CHARS)
    # Send an empty string to use the default subject line.
    subject: str = Field(default="", max_length=255)


class EmailNotificationSettingsRequest(BaseModel):
    banner_position: Literal["top", "bottom"]
    # Notification key -> enabled for the whole organization. Unknown keys are rejected.
    enabled_templates: dict[str, bool]
    # Leave out to keep the current setting.
    invitation_enabled: bool | None = None


class TemplateFileExtractRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    # Base64 of a .txt or .pdf file, up to 2 MB before encoding.
    content_base64: str = Field(min_length=1, max_length=3_000_000)


class TemplateFileExtractResponse(BaseModel):
    text: str


class OrganizationGeneralSettingsResponse(BaseModel):
    # The organization's main contact email ({organization_main_email} in templates).
    contact_email: str
    # Where clients go for help ({organization_support_email}); "" means use the main contact email.
    support_email: str = ""
    # RCIC / Law Society license number ({license_number}); "" if not set.
    license_number: str = ""
    timezone: str
    # The timezones an admin can pick from, so the frontend list matches what the server accepts.
    available_timezones: list[str]


class OrganizationGeneralSettingsRequest(BaseModel):
    contact_email: str = Field(min_length=3, max_length=255)
    # Optional; leave empty to use the main contact email.
    support_email: str = Field(default="", max_length=255)
    license_number: str = Field(default="", max_length=100)
    timezone: str = Field(min_length=1, max_length=50)


class AdminOperationsResponse(BaseModel):
    organization_id: UUID
    unassigned_cases: list[AdminOpsCaseItem]
    aging_cases: list[AdminOpsCaseItem]
    lawyer_workload: list[AdminOpsLawyerWorkloadItem]
    invitations: list[AdminOpsInvitationItem]
