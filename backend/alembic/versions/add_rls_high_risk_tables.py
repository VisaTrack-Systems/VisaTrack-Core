"""add RLS on high-risk tables (SOC 2 DB-level access enforcement)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-02

Enables Row-Level Security on cases, case_documents, messages, invoices,
payments, and trust_account_entries. Policies restrict access to rows where
organization_id matches the session variable app.current_organization_id.
Super-admin can bypass via app.bypass_rls = true.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that have organization_id and get RLS (tenant isolation)
RLS_TABLES = [
    "cases",
    "case_documents",
    "messages",
    "invoices",
    "payments",
    "trust_account_entries",
]

# Policy expression: allow if bypass is set, or organization_id matches session
POLICY_EXPR = """
(
  current_setting('app.bypass_rls', true)::boolean IS TRUE
  OR organization_id = current_setting('app.current_organization_id', true)::uuid
)
"""


def _table_exists(connection, table_name: str) -> bool:
    result = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :name"
        ),
        {"name": table_name},
    )
    return result.scalar() is not None


def _table_has_organization_id(connection, table_name: str) -> bool:
    result = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :tname AND column_name = 'organization_id'"
        ),
        {"tname": table_name},
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    for table in RLS_TABLES:
        if not _table_exists(conn, table):
            continue
        if not _table_has_organization_id(conn, table):
            continue

        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

        policy_name = f"rls_tenant_{table}"
        op.execute(f"DROP POLICY IF EXISTS {policy_name} ON {table}")
        op.execute(
            f"""
            CREATE POLICY {policy_name} ON {table}
            USING {POLICY_EXPR}
            WITH CHECK {POLICY_EXPR}
            """
        )


def downgrade() -> None:
    conn = op.get_bind()

    for table in RLS_TABLES:
        if not _table_exists(conn, table):
            continue
        policy_name = f"rls_tenant_{table}"
        op.execute(f"DROP POLICY IF EXISTS {policy_name} ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
