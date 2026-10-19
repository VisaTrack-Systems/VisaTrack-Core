"""Lawyer Schemas: Pydantic models for lawyer/legal professional profile and workload related API validation."""
from datetime import date
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LawyerProfileResponse(BaseModel):
    user_id: UUID
    user_type: str
    bar_number: Optional[str]
    specialties: list[str]
    years_experience: Optional[int]
    bio: Optional[str]
    hourly_rate: Optional[float]
    onboarding_complete: bool


class LawyerProfileUpsertRequest(BaseModel):
    bar_number: Optional[str] = Field(default=None, max_length=100)
    specialties: list[str] = []
    years_experience: Optional[int] = Field(default=None, ge=0, le=80)
    bio: Optional[str] = None
    hourly_rate: Optional[float] = Field(default=None, ge=0)


class LawyerCommunicationTemplateItem(BaseModel):
    key: str
    label: str
    description: str
    # False when an admin has turned this email type off for the whole organization.
    org_enabled: bool
    # The lawyer's own opt-in. Emails go out only when org_enabled and enabled are both true.
    enabled: bool


class LawyerEmailBanner(BaseModel):
    file_name: str
    content_type: str
    # Short-lived link for previewing the image; None if storage is unavailable.
    url: Optional[str] = None


class LawyerCommunicationSettingsResponse(BaseModel):
    banner: Optional[LawyerEmailBanner]
    banner_position: Literal["top", "bottom"]
    templates: list[LawyerCommunicationTemplateItem]


class LawyerCommunicationSettingsUpdateRequest(BaseModel):
    # Notification key -> the lawyer's opt-in. Unknown keys are rejected.
    enabled_templates: dict[str, bool]


class LawyerEmailBannerUploadRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    # Base64 of a .png, .jpg, .jpeg, or .webp image, up to 1 MB before encoding.
    content_base64: str = Field(min_length=1, max_length=1_500_000)


class LawyerCaseCreateRequest(BaseModel):
    client_user_id: UUID
    case_type: str = Field(min_length=2, max_length=100)
    priority: str = Field(default="medium", min_length=2, max_length=20)
    target_filing_date: Optional[date] = None
    description: Optional[str] = None


class LawyerCaseFlagRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_flagged: bool = Field(strict=True)


class LawyerCaseFlagResponse(BaseModel):
    case_number: str
    is_flagged: bool


class InviteClientRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    relationship_type: str = Field(default="related", min_length=2, max_length=50)


class InviteClientResponse(BaseModel):
    case_number: str
    client_email: str
    invited_user_id: UUID
    invitation_url: str


class LawyerClientCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    send_invite: bool = True


class LawyerClientCreateResponse(BaseModel):
    user_id: UUID
    email: str
    full_name: str
    status: str
    organization_name: str
    invitation_url: Optional[str] = None
