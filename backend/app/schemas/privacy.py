from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PrivacyRequestCreate(BaseModel):
    request_type: Literal["access", "correction", "deletion"]
    details: Optional[str] = Field(default=None, max_length=5000)


class PrivacyRequestResponse(BaseModel):
    id: UUID
    request_type: str
    status: str
    details: Optional[str]
    resolution_note: Optional[str]
    due_at: datetime
    completed_at: Optional[datetime]
    created_at: datetime


class PrivacyRequestReview(BaseModel):
    status: Literal["in_review", "blocked_legal_hold", "completed", "denied"]
    resolution_note: str = Field(min_length=3, max_length=5000)


class PublicDeletionRequest(BaseModel):
    organization_slug: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    details: Optional[str] = Field(default=None, max_length=2000)
    confirm_deletion: Literal[True]


class PublicDeletionResponse(BaseModel):
    status: Literal["accepted"]
    message: str


class UnsubscribeRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    token: str = Field(min_length=32, max_length=128)


class UnsubscribeResponse(BaseModel):
    status: Literal["unsubscribed"]
