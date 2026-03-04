from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    organization_slug: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int


class CurrentUserResponse(BaseModel):
    id: UUID
    organization_id: UUID
    email: str
    full_name: str
    status: str
    roles: list[str]
    active_role: str
    onboarding_required: bool
    last_login_at: Optional[datetime]


class SwitchActiveRoleRequest(BaseModel):
    role: str = Field(min_length=2, max_length=100)


class SwitchActiveRoleResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    active_role: str
    roles: list[str]


class CurrentUserSettingsResponse(BaseModel):
    id: UUID
    organization_id: UUID
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    avatar_url: Optional[str]
    email_verified: bool
    phone_verified: bool
    mfa_enabled: bool
    timezone: str
    locale: str
    status: str


class UpdateCurrentUserSettingsRequest(BaseModel):
    email: Optional[str] = Field(default=None, min_length=3, max_length=255)
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    mfa_enabled: Optional[bool] = None
    timezone: Optional[str] = Field(default=None, min_length=2, max_length=50)
    locale: Optional[str] = Field(default=None, min_length=2, max_length=10)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class AcceptInvitationRequest(BaseModel):
    token: str = Field(min_length=16, max_length=512)
    password: str = Field(min_length=8, max_length=128)


class AcceptInvitationResponse(BaseModel):
    message: str
    email: str
    organization_id: UUID
