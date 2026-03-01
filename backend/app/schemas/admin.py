from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AdminCreateOrganizationRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    contact_email: str = Field(min_length=3, max_length=255)
    slug: Optional[str] = Field(default=None, min_length=2, max_length=100)
    subscription_tier: str = Field(default="basic", min_length=2, max_length=50)
    subscription_status: str = Field(default="active", min_length=2, max_length=50)


class AdminCreateUserRequest(BaseModel):
    organization_id: UUID
    email: str = Field(min_length=3, max_length=255)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    status: str = Field(default="active", min_length=2, max_length=50)
    role_slug: str = Field(default="lawyer", min_length=2, max_length=100)


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
