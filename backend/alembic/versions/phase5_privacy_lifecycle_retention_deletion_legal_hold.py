"""Phase 5: Privacy lifecycle — retention, deletion, legal hold

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-02

Goal: handle "delete my data", "legal hold", "retain financial records".

- case_documents.legal_hold BOOLEAN, case_documents.retain_until DATE
- data_deletion_requests: track request, scope, status, approved_by
- consents: for intelligent extraction and other features
- retention_policy_definitions: what is deletable vs must be retained
  (billing/trust/invoices/payments must be retained for audit; documents
  follow retain_until and legal_hold)

Definition of done: You can prove retention and deletion behavior.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(connection, table_name: str) -> bool:
    r = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :n"
        ),
        {"n": table_name},
    )
    return r.scalar() is not None


def _column_exists(connection, table_name: str, column_name: str) -> bool:
    r = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table_name, "c": column_name},
    )
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    uuid_type = PGUUID(as_uuid=True)

    # ---- case_documents: legal_hold, retain_until ----
    if _table_exists(conn, "case_documents"):
        if not _column_exists(conn, "case_documents", "legal_hold"):
            op.add_column(
                "case_documents",
                sa.Column("legal_hold", sa.Boolean(), server_default=sa.text("false"), nullable=False),
            )
        if not _column_exists(conn, "case_documents", "retain_until"):
            op.add_column(
                "case_documents",
                sa.Column("retain_until", sa.Date(), nullable=True),
            )

    # ---- data_deletion_requests ----
    # Only create if core reference tables exist (organizations, users).
    if (
        _table_exists(conn, "organizations")
        and _table_exists(conn, "users")
        and not _table_exists(conn, "data_deletion_requests")
    ):
        op.create_table(
            "data_deletion_requests",
            sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("requester_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("subject_type", sa.String(50), nullable=False),
            sa.Column("subject_id", uuid_type, nullable=False),
            sa.Column("scope", sa.String(100), nullable=False),
            sa.Column("status", sa.String(50), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("approved_by", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        )
        op.create_index("ix_data_deletion_requests_organization_id", "data_deletion_requests", ["organization_id"], unique=False)
        op.create_index("ix_data_deletion_requests_status", "data_deletion_requests", ["status"], unique=False)
        op.create_index("ix_data_deletion_requests_subject", "data_deletion_requests", ["subject_type", "subject_id"], unique=False)
        if _table_exists(conn, "data_deletion_requests"):
            op.execute("ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;")
            op.execute(
                """
                CREATE POLICY data_deletion_requests_tenant ON data_deletion_requests
                FOR ALL USING (
                    COALESCE(current_setting('app.bypass_rls', true), 'false')::boolean IS TRUE
                    OR organization_id = (current_setting('app.org_id', true)::uuid)
                );
                """
            )

    # ---- consents (intelligent extraction, etc.) ----
    # Only create if core reference tables exist (organizations, users).
    if (
        _table_exists(conn, "organizations")
        and _table_exists(conn, "users")
        and not _table_exists(conn, "consents")
    ):
        op.create_table(
            "consents",
            sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("subject_type", sa.String(50), nullable=False),
            sa.Column("subject_id", uuid_type, nullable=False),
            sa.Column("consent_type", sa.String(100), nullable=False),
            sa.Column("granted", sa.Boolean(), nullable=False),
            sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("granted_by", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("metadata", JSONB, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_consents_organization_id", "consents", ["organization_id"], unique=False)
        op.create_index("ix_consents_subject", "consents", ["subject_type", "subject_id"], unique=False)
        op.create_index("ix_consents_consent_type", "consents", ["consent_type"], unique=False)
        if _table_exists(conn, "consents"):
            op.execute("ALTER TABLE consents ENABLE ROW LEVEL SECURITY;")
            op.execute(
                """
                CREATE POLICY consents_tenant ON consents
                FOR ALL USING (
                    COALESCE(current_setting('app.bypass_rls', true), 'false')::boolean IS TRUE
                    OR organization_id = (current_setting('app.org_id', true)::uuid)
                );
                """
            )

    # ---- retention_policy_definitions: prove what is deletable vs retained ----
    if not _table_exists(conn, "retention_policy_definitions"):
        op.create_table(
            "retention_policy_definitions",
            sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("category", sa.String(100), nullable=False),
            sa.Column("table_or_scope", sa.String(200), nullable=False),
            sa.Column("retention_rule", sa.String(50), nullable=False),
            sa.Column("retain_years", sa.Integer(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
        op.create_index("ix_retention_policy_definitions_category", "retention_policy_definitions", ["category"], unique=False)
        conn.execute(
            sa.text(
                """
                INSERT INTO retention_policy_definitions (category, table_or_scope, retention_rule, retain_years, description)
                VALUES
                    ('financial', 'invoices', 'indefinite', NULL, 'Billing records; retain for audit/compliance'),
                    ('financial', 'invoice_items', 'indefinite', NULL, 'Invoice line items'),
                    ('financial', 'payments', 'indefinite', NULL, 'Payment records'),
                    ('financial', 'trust_account_entries', 'indefinite', NULL, 'Trust ledger'),
                    ('financial', 'invoice_events', 'indefinite', NULL, 'Invoice event trail'),
                    ('financial', 'trust_entry_events', 'indefinite', NULL, 'Trust event trail'),
                    ('documents', 'case_documents', 'retain_until_or_legal_hold', NULL, 'Delete only when retain_until passed and legal_hold false'),
                    ('documents', 'document_access_log', 'follow_document', NULL, 'Retain as long as related document'),
                    ('requests', 'data_deletion_requests', 'indefinite', NULL, 'Audit trail of deletion requests'),
                    ('consents', 'consents', 'indefinite', NULL, 'Consent history')
                """
            )
        )

    # ---- Enforce: no hard delete of case_documents under legal_hold or before retain_until ----
    if _table_exists(conn, "case_documents"):
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION case_documents_retention_legal_hold()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF TG_OP = 'DELETE' THEN
                        IF OLD.legal_hold = true THEN
                            RAISE EXCEPTION 'case_documents: cannot delete document under legal_hold';
                        END IF;
                        IF OLD.retain_until IS NOT NULL AND OLD.retain_until > current_date THEN
                            RAISE EXCEPTION 'case_documents: cannot delete before retain_until (%)', OLD.retain_until;
                        END IF;
                    END IF;
                    RETURN COALESCE(NEW, OLD);
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute("DROP TRIGGER IF EXISTS trg_case_documents_retention_legal_hold ON case_documents;")
        op.execute(
            """
            CREATE TRIGGER trg_case_documents_retention_legal_hold
                BEFORE DELETE ON case_documents
                FOR EACH ROW EXECUTE PROCEDURE case_documents_retention_legal_hold();
            """
        )


def downgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "case_documents"):
        op.execute("DROP TRIGGER IF EXISTS trg_case_documents_retention_legal_hold ON case_documents;")
        op.execute("DROP FUNCTION IF EXISTS case_documents_retention_legal_hold();")
        if _column_exists(conn, "case_documents", "retain_until"):
            op.drop_column("case_documents", "retain_until")
        if _column_exists(conn, "case_documents", "legal_hold"):
            op.drop_column("case_documents", "legal_hold")

    if _table_exists(conn, "retention_policy_definitions"):
        op.drop_table("retention_policy_definitions")

    if _table_exists(conn, "consents"):
        op.execute("DROP POLICY IF EXISTS consents_tenant ON consents;")
        op.drop_table("consents")

    if _table_exists(conn, "data_deletion_requests"):
        op.execute("DROP POLICY IF EXISTS data_deletion_requests_tenant ON data_deletion_requests;")
        op.drop_table("data_deletion_requests")
