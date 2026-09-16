"""Contracts for the lawyer-only, case-scoped AI assistant."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

AiProvider = Literal["openai", "anthropic"]


class AiProviderConnectRequest(BaseModel):
    provider: AiProvider
    api_key: str = Field(
        min_length=16,
        max_length=500,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )
    selected_model: str | None = Field(default=None, min_length=1, max_length=200)
    data_processing_acknowledged: bool
    current_password: str = Field(
        min_length=1,
        max_length=128,
        json_schema_extra={"writeOnly": True, "format": "password"},
    )
    mfa_code: str | None = Field(
        default=None,
        min_length=6,
        max_length=32,
        json_schema_extra={"writeOnly": True},
    )


class AiProviderSelectModelRequest(BaseModel):
    selected_model: str = Field(min_length=1, max_length=200)


class AiProviderConnectionResponse(BaseModel):
    provider: AiProvider
    key_hint: str
    selected_model: str | None
    last_verified_at: datetime | None
    data_processing_acknowledged_at: datetime
    acknowledgement_version: str


class AiProviderModelsResponse(BaseModel):
    provider: AiProvider
    models: list[str]
    selected_model: str | None
    recommended_model: str | None
    form_drafts_enabled: bool


class AiChatCreateRequest(BaseModel):
    title: str = Field(default="Case assistant", min_length=1, max_length=200)


class AiCitation(BaseModel):
    source_id: str
    case_document_id: UUID
    document_name: str
    page_number: int | None
    excerpt: str


class AiChatMessageResponse(BaseModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    citations: list[AiCitation] = Field(default_factory=list)
    provider: AiProvider | None = None
    requested_model: str | None = None
    model: str | None = None
    prompt_version: str | None = None
    finish_reason: str | None = None
    created_at: datetime


class AiChatResponse(BaseModel):
    id: UUID
    case_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[AiChatMessageResponse] = Field(default_factory=list)


class AiChatMessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=12000)
    provider: AiProvider


class AiIndexResponse(BaseModel):
    queued_documents: int


class AiFormDraftCreateRequest(BaseModel):
    source_document_id: UUID
    provider: AiProvider
    instructions: str | None = Field(default=None, max_length=2000)


class AiFormFieldEvidence(BaseModel):
    value: str
    sources: list[str]


class AiFormDraftResponse(BaseModel):
    id: UUID
    source_document_id: UUID | None
    file_name: str
    download_url: str
    expires_in_seconds: int
    provider: AiProvider
    requested_model: str
    model: str
    prompt_version: str
    finish_reason: str | None
    source_sha256: str
    populated_fields: list[str]
    unresolved_fields: list[str]
    unsupported_fields: list[str]
    field_evidence: dict[str, AiFormFieldEvidence]
    citations: list[AiCitation]
    warning: str
    created_at: datetime


class AiFormDraftSummaryResponse(BaseModel):
    id: UUID
    source_document_id: UUID | None
    file_name: str
    provider: AiProvider
    requested_model: str
    model: str
    prompt_version: str
    source_sha256: str
    status: Literal["draft", "reviewed", "superseded"]
    unresolved_fields: list[str]
    unsupported_fields: list[str]
    reviewed_by: UUID | None
    reviewed_at: datetime | None
    review_note: str | None
    adobe_validation_completed: bool
    created_at: datetime


class AiFormDraftReviewRequest(BaseModel):
    status: Literal["reviewed", "superseded"]
    review_note: str = Field(min_length=10, max_length=2000)
    adobe_validation_completed: bool = False


class AiFormDraftDownloadResponse(BaseModel):
    id: UUID
    file_name: str
    download_url: str
    expires_in_seconds: int
