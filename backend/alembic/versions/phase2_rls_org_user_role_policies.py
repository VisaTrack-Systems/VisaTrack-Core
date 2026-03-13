"""Phase 2 RLS: app.org_id / app.user_id / app.role + client & lawyer policies (SOC 2 serious)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-02

Session variables:
  app.org_id   - current tenant (uuid)
  app.user_id  - current user (uuid)
  app.role     - 'client' | 'lawyer' | 'org_admin' | 'super_admin' (for policy branching)
  app.bypass_rls - 'true' for super_admin cross-org

Policies:
  - Tenant: organization_id = current_setting('app.org_id')::uuid
  - cases: + Client policy (client sees only rows where user in case_clients)
           + Lawyer policy (lawyer sees only rows where user is primary_lawyer or in case_assignments)
  - Other tables: tenant-only (so raw SQL cannot fetch another org's rows).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = [
    "cases",
    "case_documents",
    "messages",
    "invoices",
    "payments",
    "trust_account_entries",
]

# Tenant-only policy: bypass OR organization_id = app.org_id (used for all except cases)
TENANT_POLICY_EXPR = """
(
  COALESCE(current_setting('app.bypass_rls', true), 'false')::boolean IS TRUE
  OR organization_id = (current_setting('app.org_id', true)::uuid)
)
"""

# cases: tenant + client (only if in case_clients) + lawyer (only if primary or in case_assignments)
CASES_POLICY_EXPR = """
(
  COALESCE(current_setting('app.bypass_rls', true), 'false')::boolean IS TRUE
  OR (
    organization_id = (current_setting('app.org_id', true)::uuid)
    AND (
      current_setting('app.role', true) IS NULL
      OR current_setting('app.role', true) IN ('org_admin', 'super_admin')
      OR (
        current_setting('app.role', true) = 'client'
        AND EXISTS (
          SELECT 1 FROM case_clients cc
          WHERE cc.case_id = cases.id
            AND cc.client_user_id = (current_setting('app.user_id', true)::uuid)
            AND cc.removed_at IS NULL
        )
      )
      OR (
        current_setting('app.role', true) = 'lawyer'
        AND (
          cases.primary_lawyer_id = (current_setting('app.user_id', true)::uuid)
          OR EXISTS (
            SELECT 1 FROM case_assignments ca
            WHERE ca.case_id = cases.id
              AND ca.lawyer_id = (current_setting('app.user_id', true)::uuid)
              AND ca.removed_at IS NULL
          )
        )
      )
    )
  )
)
"""


def _table_exists(connection, table_name: str) -> bool:
    r = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :n"
        ),
        {"n": table_name},
    )
    return r.scalar() is not None


def _table_has_organization_id(connection, table_name: str) -> bool:
    r = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = 'organization_id'"
        ),
        {"t": table_name},
    )
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    for table in RLS_TABLES:
        if not _table_exists(conn, table):
            continue
        if not _table_has_organization_id(conn, table):
            continue

        policy_name = f"rls_tenant_{table}"
        op.execute(f"DROP POLICY IF EXISTS {policy_name} ON {table}")

        if table == "cases":
            op.execute(
                f"""
                CREATE POLICY {policy_name} ON {table}
                USING {CASES_POLICY_EXPR}
                WITH CHECK {CASES_POLICY_EXPR}
                """
            )
        else:
            op.execute(
                f"""
                CREATE POLICY {policy_name} ON {table}
                USING {TENANT_POLICY_EXPR}
                WITH CHECK {TENANT_POLICY_EXPR}
                """
            )


def downgrade() -> None:
    """Restore Phase 1 / Gap 2 policies: app.current_organization_id + app.bypass_rls only."""
    conn = op.get_bind()

    policy_expr_legacy = """
(
  COALESCE(current_setting('app.bypass_rls', true), 'false')::boolean IS TRUE
  OR organization_id = (current_setting('app.current_organization_id', true)::uuid)
)
"""
    for table in RLS_TABLES:
        if not _table_exists(conn, table):
            continue
        if not _table_has_organization_id(conn, table):
            continue
        policy_name = f"rls_tenant_{table}"
        op.execute(f"DROP POLICY IF EXISTS {policy_name} ON {table}")
        op.execute(
            f"""
            CREATE POLICY {policy_name} ON {table}
            USING {policy_expr_legacy}
            WITH CHECK {policy_expr_legacy}
            """
        )
