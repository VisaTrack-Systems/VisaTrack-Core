"""User Schemas: Pydantic models for user-related API requests and responses. Includes user creation, updates, and profile management."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: Optional[UUID]
    email: str
    first_name: str
    last_name: str
    status: str
    created_at: datetime


class UserListItem(BaseModel):
    id: UUID
    email: str
    full_name: str
    status: str
    organization_id: Optional[UUID]
    created_at: datetime
    roles: list[str] = Field(default_factory=list)
