"""baseline revision

Revision ID: e92b3ac1b42b
Revises:
Create Date: 2026-02-10 23:59:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB, ARRAY

# revision identifiers, used by Alembic.
revision: str = "e92b3ac1b42b"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create core schema tables so later SOC migrations can operate."""
    uuid_type = PGUUID(as_uuid=True)

    # organizations
    op.create_table(
        "organizations",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("legal_name", sa.String(255)),
        sa.Column("tax_id", sa.String(50)),
        sa.Column("address", JSONB),
        sa.Column("contact_email", sa.String(255), nullable=False),
        sa.Column("contact_phone", sa.String(50)),
        sa.Column("website", sa.String(255)),
        sa.Column("logo_url", sa.String(500)),
        sa.Column("settings", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("subscription_tier", sa.String(50), nullable=False, server_default="basic"),
        sa.Column("subscription_status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    # users
    op.create_table(
        "users",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(50)),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("mfa_secret", sa.String(255)),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.Column("login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="America/Toronto"),
        sa.Column("locale", sa.String(10), nullable=False, server_default="en-CA"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    # roles
    op.create_table(
        "roles",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("permissions", JSONB, nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # user_profiles
    op.create_table(
        "user_profiles",
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_type", sa.String(50), nullable=False),
        sa.Column("bar_number", sa.String(100)),
        sa.Column("jurisdiction", sa.String(100)),
        sa.Column("specialties", ARRAY(sa.String())),
        sa.Column("years_experience", sa.Integer()),
        sa.Column("bio", sa.Text()),
        sa.Column("hourly_rate", sa.Numeric(10, 2)),
        sa.Column("date_of_birth", sa.Date()),
        sa.Column("nationality", sa.String(100)),
        sa.Column("current_status", sa.String(100)),
        sa.Column("uci_number", sa.String(50)),
        sa.Column("application_number", sa.String(50)),
        sa.Column("emergency_contact", JSONB),
        sa.Column("address", JSONB),
        sa.Column(
            "notification_prefs",
            JSONB,
            nullable=False,
            server_default=sa.text(
                "'{\"email_case_updates\": true, \"email_documents\": true, \"email_payments\": true, \"sms_urgent\": false}'::jsonb"
            ),
        ),
        sa.Column("custom_fields", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # user_roles
    op.create_table(
        "user_roles",
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_id", uuid_type, sa.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assigned_by", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
    )

    # organizations-linked invitations (minimal)
    op.create_table(
        "user_invitations",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("invited_by", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("roles", JSONB),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # cases
    op.create_table(
        "cases",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("case_number", sa.String(100), nullable=False),
        sa.Column("client_id", uuid_type, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("primary_lawyer_id", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("case_type", sa.String(100), nullable=False),
        sa.Column("case_subtype", sa.String(100)),
        sa.Column("status", sa.String(50), nullable=False, server_default="intake"),
        sa.Column("intake_date", sa.Date()),
        sa.Column("target_filing_date", sa.Date()),
        sa.Column("estimated_completion_from", sa.Date()),
        sa.Column("estimated_completion_to", sa.Date()),
        sa.Column("completion_confidence", sa.Integer()),
        sa.Column("description", sa.Text()),
        sa.Column("internal_notes", sa.Text()),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("complexity", sa.String(20), nullable=False, server_default="standard"),
        sa.Column("fee_agreement", JSONB),
        sa.Column("source", sa.String(50)),
        sa.Column("tags", ARRAY(sa.Text())),
        sa.Column("custom_fields", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    # case_clients (no organization_id yet; added in later migration)
    op.create_table(
        "case_clients",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", uuid_type, sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relationship_type", sa.String(50), nullable=False, server_default="primary"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("invited_by", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("invited_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
    )

    # case_assignments (no organization_id yet; added in later migration)
    op.create_table(
        "case_assignments",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", uuid_type, sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lawyer_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="associate"),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
    )

    # milestones (no organization_id yet; added later)
    op.create_table(
        "milestones",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", uuid_type, sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("milestone_type", sa.String(100)),
        sa.Column("planned_date", sa.Date()),
        sa.Column("actual_date", sa.Date()),
        sa.Column("due_date", sa.Date()),
        sa.Column("status", sa.String(50), nullable=False, server_default="not_started"),
        sa.Column("completion_percentage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("depends_on", ARRAY(uuid_type)),
        sa.Column("assigned_to", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("reminder_days", ARRAY(sa.Integer())),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_by", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )

    # messages (no organization_id yet; added later)
    op.create_table(
        "messages",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", uuid_type, sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("recipient_id", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("subject", sa.String(255)),
        sa.Column("body", sa.Text()),
        sa.Column("is_draft", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("visible_to_client", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # case_documents (no organization_id yet; added later)
    op.create_table(
        "case_documents",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", uuid_type, sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_id", uuid_type),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("file_name", sa.String(500)),
        sa.Column("file_path", sa.String(1000)),
        sa.Column("file_size_bytes", sa.BigInteger()),
        sa.Column("file_type", sa.String(255)),
        sa.Column("file_hash", sa.String(255)),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("previous_version_id", uuid_type),
        sa.Column("status", sa.String(50), nullable=False, server_default="not_requested"),
        sa.Column("issue_date", sa.Date()),
        sa.Column("expiry_date", sa.Date()),
        sa.Column("uploaded_by", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )

    # invoices (no organization_id yet; added later)
    op.create_table(
        "invoices",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", uuid_type, sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_number", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("amount_paid", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("amount_due", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("due_date", sa.Date()),
        sa.Column("paid_date", sa.DateTime(timezone=True)),
        sa.Column("tax", sa.Numeric(10, 2)),
        sa.Column("currency", sa.String(10), nullable=False, server_default="CAD"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # invoice_items (no organization_id yet; added later)
    op.create_table(
        "invoice_items",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_id", uuid_type, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )

    # payment_methods (no organization_id yet; added later)
    op.create_table(
        "payment_methods",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("client_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(50)),
        sa.Column("brand", sa.String(50)),
        sa.Column("last_four", sa.String(4)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # payments (no organization_id yet; added later)
    op.create_table(
        "payments",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_id", uuid_type, sa.ForeignKey("invoices.id", ondelete="CASCADE")),
        sa.Column("payment_method_id", uuid_type, sa.ForeignKey("payment_methods.id")),
        sa.Column("client_id", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("provider", sa.String(50)),
        sa.Column("provider_payment_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # trust_account_entries (minimal; no organization_id yet, added later)
    op.create_table(
        "trust_account_entries",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("case_id", uuid_type, sa.ForeignKey("cases.id", ondelete="CASCADE")),
        sa.Column("client_id", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),  # credit / debit
        sa.Column("description", sa.Text()),
        sa.Column("created_by", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # activity_log (full shape so Phase 3 only adds immutability)
    op.create_table(
        "activity_log",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE")),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("user_type", sa.String(50), nullable=False, server_default="system"),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", uuid_type),
        sa.Column("case_id", uuid_type, sa.ForeignKey("cases.id")),
        sa.Column("client_id", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("old_values", JSONB),
        sa.Column("new_values", JSONB),
        sa.Column("metadata", JSONB),
        sa.Column("changed_fields", sa.ARRAY(sa.Text())),
        sa.Column("sensitivity_level", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # document_access_log (no organization_id yet; added later)
    op.create_table(
        "document_access_log",
        sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", uuid_type, sa.ForeignKey("case_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id")),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("ip_address", sa.dialects.postgresql.INET),
        sa.Column("user_agent", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    for table in [
        "document_access_log",
        "activity_log",
        "trust_account_entries",
        "payments",
        "payment_methods",
        "invoice_items",
        "invoices",
        "case_documents",
        "messages",
        "milestones",
        "case_assignments",
        "case_clients",
        "cases",
        "user_invitations",
        "user_roles",
        "user_profiles",
        "roles",
        "users",
        "organizations",
    ]:
        op.drop_table(table)

