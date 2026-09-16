"""Contracts for the lawyer-only, case-scoped AI assistant."""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

AiProvider = Literal["openai", "anthropic"]


class AiProviderConnectRequest(BaseModel):
    provider: AiProvider
    api_key: str = Field(min_length=16, max_length=500)
    selected_model: str | None = Field(default=None, min_length=1, max_length=200)
    data_processing_acknowledged: bool
    current_password: str = Field(min_length=1, max_length=128)
    mfa_code: str | None = Field(default=None, min_length=6, max_length=32)


class AiProviderSelectModelRequest(BaseModel):
    selected_model: str | None = Field(default=None, max_length=200)


class AiProviderConnectionResponse(BaseModel):
    provider: AiProvider
    key_hint: str
    selected_model: str | None
    last_verified_at: datetime | None
    data_processing_acknowledged_at: datetime


class AiProviderModelsResponse(BaseModel):
    provider: AiProvider
    models: list[str]
    selected_model: str | None
    recommended_model: str | None


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
    model: str | None = None
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


class AiIndexResponse(BaseModel):
    queued_documents: int


class AiFormDraftCreateRequest(BaseModel):
    source_document_id: UUID
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
    populated_fields: list[str]
    unresolved_fields: list[str]
    field_evidence: dict[str, AiFormFieldEvidence]
    citations: list[AiCitation]
    warning: str
    created_at: datetime
