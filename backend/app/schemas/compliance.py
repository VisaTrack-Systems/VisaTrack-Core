"""Schemas for data deletion requests and consents (privacy/compliance)."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class DataDeletionRequestCreate(BaseModel):
    subject_type: str
    subject_id: UUID
    scope: str
    notes: Optional[str] = None


class DataDeletionRequestItem(BaseModel):
    id: UUID
    organization_id: UUID
    requester_user_id: Optional[UUID]
    subject_type: str
    subject_id: UUID
    scope: str
    status: str
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    completed_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime


class ConsentCreate(BaseModel):
    subject_type: str
    subject_id: UUID
    consent_type: str
    granted: bool
    metadata: Optional[dict[str, Any]] = None


class ConsentItem(BaseModel):
    id: UUID
    organization_id: UUID
    subject_type: str
    subject_id: UUID
    consent_type: str
    granted: bool
    granted_at: datetime
    granted_by: Optional[UUID]
    revoked_at: Optional[datetime]
    metadata: Optional[dict[str, Any]]
    created_at: datetime
