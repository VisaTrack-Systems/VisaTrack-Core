"""add document quarantine, scanning, retention, and durable jobs

Revision ID: c83e02f7a5d4
Revises: b72d91e8f4c3
Create Date: 2026-09-11 16:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c83e02f7a5d4"
down_revision: Union[str, Sequence[str], None] = "b72d91e8f4c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "case_documents",
        sa.Column("scan_status", sa.String(length=30), nullable=False, server_default="clean"),
    )
    op.add_column("case_documents", sa.Column("scan_engine", sa.String(length=100)))
    op.add_column("case_documents", sa.Column("scan_signature_version", sa.String(length=100)))
    op.add_column("case_documents", sa.Column("scan_completed_at", sa.DateTime(timezone=True)))
    op.add_column("case_documents", sa.Column("scan_failure_reason", sa.Text()))
    op.add_column("case_documents", sa.Column("retention_delete_after", sa.DateTime(timezone=True)))
    op.add_column("case_documents", sa.Column("storage_purged_at", sa.DateTime(timezone=True)))
    op.add_column(
        "case_documents",
        sa.Column("legal_hold", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_check_constraint(
        "ck_case_documents_scan_status",
        "case_documents",
        "scan_status IN ('pending', 'scanning', 'clean', 'infected', 'invalid', 'failed')",
    )
    op.create_index(
        "idx_case_documents_scan_pending",
        "case_documents",
        ["scan_status", "created_at"],
        postgresql_where=sa.text("deleted_at IS NULL AND scan_status <> 'clean'"),
    )

    op.create_table(
        "background_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_type", sa.String(length=100), nullable=False),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("organization_id", "idempotency_key", name="uq_background_jobs_idempotency"),
        sa.CheckConstraint(
            "status IN ('pending', 'running', 'retry', 'completed', 'failed', 'cancelled')",
            name="ck_background_jobs_status",
        ),
    )
    op.create_index(
        "idx_background_jobs_claim",
        "background_jobs",
        ["status", "scheduled_at", "created_at"],
    )

    op.create_table(
        "audit_outbox",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("exported_at", sa.DateTime(timezone=True)),
        sa.Column("export_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text()),
    )
    op.create_index(
        "idx_audit_outbox_pending",
        "audit_outbox",
        ["created_at"],
        postgresql_where=sa.text("exported_at IS NULL"),
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_audit_mutation()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'audit records are append-only';
        END;
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER activity_log_append_only BEFORE UPDATE OR DELETE ON activity_log "
        "FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation()"
    )
    op.execute(
        "CREATE TRIGGER document_access_log_append_only BEFORE UPDATE OR DELETE ON document_access_log "
        "FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS document_access_log_append_only ON document_access_log")
    op.execute("DROP TRIGGER IF EXISTS activity_log_append_only ON activity_log")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_mutation()")
    op.drop_table("audit_outbox")
    op.drop_table("background_jobs")
    op.drop_index("idx_case_documents_scan_pending", table_name="case_documents")
    op.drop_constraint("ck_case_documents_scan_status", "case_documents", type_="check")
    op.drop_column("case_documents", "legal_hold")
    op.drop_column("case_documents", "retention_delete_after")
    op.drop_column("case_documents", "storage_purged_at")
    op.drop_column("case_documents", "scan_failure_reason")
    op.drop_column("case_documents", "scan_completed_at")
    op.drop_column("case_documents", "scan_signature_version")
    op.drop_column("case_documents", "scan_engine")
    op.drop_column("case_documents", "scan_status")
