"""add legal AI provider, retrieval, chat, and form draft records

Revision ID: f26a4d9c8e10
Revises: e15f8a2c7b91
Create Date: 2026-09-15 23:55:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f26a4d9c8e10"
down_revision: Union[str, Sequence[str], None] = "e15f8a2c7b91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE roles
        SET permissions = permissions || '["ai:use"]'::jsonb,
            updated_at = NOW()
        WHERE slug IN ('lawyer', 'org_admin')
          AND organization_id IS NULL
          AND NOT permissions ? 'ai:use'
        """
    )
    op.create_table(
        "ai_provider_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False),
        sa.Column("key_hint", sa.String(length=20), nullable=False),
        sa.Column("selected_model", sa.String(length=200)),
        sa.Column("data_processing_acknowledged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledgement_version", sa.String(length=50), nullable=False),
        sa.Column("last_verified_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("provider IN ('openai', 'anthropic')", name="ck_ai_provider_connections_provider"),
        sa.UniqueConstraint("user_id", "provider", name="uq_ai_provider_connections_user_provider"),
    )
    op.create_index("idx_ai_provider_connections_org_user", "ai_provider_connections", ["organization_id", "user_id"])

    op.create_table(
        "ai_chats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_ai_chats_case_creator", "ai_chats", ["case_id", "created_by", "updated_at"])

    op.create_table(
        "ai_chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_chats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("provider", sa.String(length=30)),
        sa.Column("model", sa.String(length=200)),
        sa.Column("prompt_version", sa.String(length=50)),
        sa.Column("input_tokens", sa.Integer()),
        sa.Column("output_tokens", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("role IN ('user', 'assistant')", name="ck_ai_chat_messages_role"),
    )
    op.create_index("idx_ai_chat_messages_chat_created", "ai_chat_messages", ["chat_id", "created_at"])

    op.create_table(
        "ai_document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer()),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed("to_tsvector('simple', coalesce(content, ''))", persisted=True),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("case_document_id", "chunk_index", name="uq_ai_document_chunks_document_index"),
    )
    op.create_index("idx_ai_document_chunks_case", "ai_document_chunks", ["organization_id", "case_id"])
    op.create_index("idx_ai_document_chunks_search", "ai_document_chunks", ["search_vector"], postgresql_using="gin")

    op.create_table(
        "ai_form_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case_documents.id", ondelete="SET NULL")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("model", sa.String(length=200), nullable=False),
        sa.Column("prompt_version", sa.String(length=50), nullable=False),
        sa.Column("source_sha256", sa.String(length=64), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("field_values", postgresql.JSONB(), nullable=False),
        sa.Column("citations", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("unresolved_fields", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("unsupported_fields", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("status IN ('draft', 'reviewed', 'superseded')", name="ck_ai_form_drafts_status"),
    )
    op.create_index("idx_ai_form_drafts_case_created", "ai_form_drafts", ["case_id", "created_at"])

    op.create_table(
        "ai_usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="SET NULL")),
        sa.Column("request_type", sa.String(length=30), nullable=False),
        sa.Column("idempotency_key_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="started"),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("model", sa.String(length=200), nullable=False),
        sa.Column("input_tokens", sa.Integer()),
        sa.Column("output_tokens", sa.Integer()),
        sa.Column("error_code", sa.String(length=100)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("request_type IN ('chat', 'form_draft')", name="ck_ai_usage_events_request_type"),
        sa.CheckConstraint("status IN ('started', 'completed', 'failed')", name="ck_ai_usage_events_status"),
        sa.CheckConstraint("input_tokens IS NULL OR input_tokens >= 0", name="ck_ai_usage_events_input_tokens"),
        sa.CheckConstraint("output_tokens IS NULL OR output_tokens >= 0", name="ck_ai_usage_events_output_tokens"),
        sa.UniqueConstraint(
            "organization_id",
            "user_id",
            "idempotency_key_hash",
            name="uq_ai_usage_events_idempotency",
        ),
    )
    op.create_index(
        "idx_ai_usage_events_org_user_created",
        "ai_usage_events",
        ["organization_id", "user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("ai_usage_events")
    op.drop_table("ai_form_drafts")
    op.drop_table("ai_document_chunks")
    op.drop_table("ai_chat_messages")
    op.drop_table("ai_chats")
    op.drop_table("ai_provider_connections")
    op.execute(
        """
        UPDATE roles
        SET permissions = permissions - 'ai:use',
            updated_at = NOW()
        WHERE slug IN ('lawyer', 'org_admin')
          AND organization_id IS NULL
        """
    )
