"""Add organization_id and RLS to trust_account_entries (tenant isolation)

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-03-03

Bridges gap: trust_account_entries had no organization_id so RLS was skipped.
- Add organization_id (nullable then backfill from cases via case_id), NOT NULL, FK.
- Enable RLS with tenant policy (same pattern as invoices/payments).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
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


TENANT_POLICY_EXPR = """
(
  COALESCE(current_setting('app.bypass_rls', true), 'false')::boolean IS TRUE
  OR organization_id = (current_setting('app.org_id', true)::uuid)
)
"""


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "trust_account_entries"):
        return

    if _column_exists(conn, "trust_account_entries", "organization_id"):
        return

    op.add_column(
        "trust_account_entries",
        sa.Column("organization_id", PGUUID(as_uuid=True), nullable=True),
    )

    conn.execute(
        sa.text(
            """
            UPDATE trust_account_entries t
            SET organization_id = c.organization_id
            FROM cases c
            WHERE c.id = t.case_id
            """
        )
    )

    op.alter_column(
        "trust_account_entries",
        "organization_id",
        nullable=False,
        existing_type=PGUUID(as_uuid=True),
    )
    op.create_foreign_key(
        "fk_trust_account_entries_organization_id",
        "trust_account_entries",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_trust_account_entries_organization_id",
        "trust_account_entries",
        ["organization_id"],
        unique=False,
    )

    op.execute("ALTER TABLE trust_account_entries ENABLE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS rls_tenant_trust_account_entries ON trust_account_entries")
    op.execute(
        f"""
        CREATE POLICY rls_tenant_trust_account_entries ON trust_account_entries
        USING {TENANT_POLICY_EXPR}
        WITH CHECK {TENANT_POLICY_EXPR}
        """
    )


def downgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "trust_account_entries"):
        return

    op.execute("DROP POLICY IF EXISTS rls_tenant_trust_account_entries ON trust_account_entries")
    op.execute("ALTER TABLE trust_account_entries DISABLE ROW LEVEL SECURITY")
    op.drop_index("ix_trust_account_entries_organization_id", table_name="trust_account_entries")
    op.drop_constraint(
        "fk_trust_account_entries_organization_id",
        "trust_account_entries",
        type_="foreignkey",
    )
    op.drop_column("trust_account_entries", "organization_id")
