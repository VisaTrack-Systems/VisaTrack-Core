"""add organization_id to child tables (org isolation)

Revision ID: a1b2c3d4e5f6
Revises: e92b3ac1b42b
Create Date: 2026-03-02

Adds organization_id to child tables that were missing it and enforces
org-consistency via foreign keys and triggers to prevent cross-org access.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "e92b3ac1b42b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that get organization_id from cases (via case_id)
CASE_CHILD_TABLES = [
    "case_documents",
    "case_assignments",
    "messages",
    "milestones",
    "case_clients",
]
# Tables that get organization_id from another parent (handled separately)
# document_access_log <- case_documents; invoice_items <- invoices; invoices <- cases
# payment_methods <- users (client_id)


def _table_exists(connection, table_name: str) -> bool:
    result = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :name"
        ),
        {"name": table_name},
    )
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()
    uuid_type = UUID(as_uuid=True)

    # 1) Add nullable organization_id to all target tables (only if table exists)
    tables_to_add_from_case = [t for t in CASE_CHILD_TABLES if _table_exists(conn, t)]
    for table in tables_to_add_from_case:
        op.add_column(
            table,
            sa.Column("organization_id", uuid_type, nullable=True),
        )

    # invoices (has case_id)
    if _table_exists(conn, "invoices"):
        op.add_column(
            "invoices",
            sa.Column("organization_id", uuid_type, nullable=True),
        )
    # invoice_items (has invoice_id; we backfill from invoices after invoices has org_id)
    if _table_exists(conn, "invoice_items"):
        op.add_column(
            "invoice_items",
            sa.Column("organization_id", uuid_type, nullable=True),
        )
    # payment_methods (has client_id -> users.organization_id)
    if _table_exists(conn, "payment_methods"):
        op.add_column(
            "payment_methods",
            sa.Column("organization_id", uuid_type, nullable=True),
        )
    # document_access_log (document_id references case_documents; we need case_documents.organization_id first)
    if _table_exists(conn, "document_access_log"):
        op.add_column(
            "document_access_log",
            sa.Column("organization_id", uuid_type, nullable=True),
        )
    # payments (if exists; often has invoice_id or client_id)
    if _table_exists(conn, "payments"):
        op.add_column(
            "payments",
            sa.Column("organization_id", uuid_type, nullable=True),
        )
    # notifications (if exists)
    if _table_exists(conn, "notifications"):
        op.add_column(
            "notifications",
            sa.Column("organization_id", uuid_type, nullable=True),
        )

    # 2) Backfill from parent
    for table in tables_to_add_from_case:
        conn.execute(
            sa.text(
                f"""
                UPDATE {table} c
                SET organization_id = cas.organization_id
                FROM cases cas
                WHERE cas.id = c.case_id
                """
            )
        )

    if _table_exists(conn, "invoices"):
        conn.execute(
            sa.text(
                """
                UPDATE invoices i
                SET organization_id = c.organization_id
                FROM cases c
                WHERE c.id = i.case_id
                """
            )
        )
    if _table_exists(conn, "invoice_items"):
        conn.execute(
            sa.text(
                """
                UPDATE invoice_items ii
                SET organization_id = i.organization_id
                FROM invoices i
                WHERE i.id = ii.invoice_id
                """
            )
        )
    if _table_exists(conn, "payment_methods"):
        conn.execute(
            sa.text(
                """
                UPDATE payment_methods pm
                SET organization_id = u.organization_id
                FROM users u
                WHERE u.id = pm.client_id
                """
            )
        )
    if _table_exists(conn, "document_access_log"):
        # document_id in document_access_log is the case_document id; join to case_documents then cases
        conn.execute(
            sa.text(
                """
                UPDATE document_access_log dal
                SET organization_id = c.organization_id
                FROM case_documents cd
                JOIN cases c ON c.id = cd.case_id
                WHERE cd.id = dal.document_id
                """
            )
        )
    if _table_exists(conn, "payments"):
        # Assume payments has invoice_id; if it has client_id use users.organization_id
        try:
            conn.execute(
                sa.text(
                    """
                    UPDATE payments p
                    SET organization_id = i.organization_id
                    FROM invoices i
                    WHERE i.id = p.invoice_id
                    """
                )
            )
        except Exception:
            conn.execute(
                sa.text(
                    """
                    UPDATE payments p
                    SET organization_id = u.organization_id
                    FROM users u
                    WHERE u.id = p.client_id
                    """
                )
            )
    if _table_exists(conn, "notifications"):
        conn.execute(
            sa.text(
                """
                UPDATE notifications n
                SET organization_id = u.organization_id
                FROM users u
                WHERE u.id = n.user_id
                """
            )
        )

    # 3) Set NOT NULL and add FK for tables we backfilled (skip if no rows could be backfilled to avoid breaking)
    for table in tables_to_add_from_case:
        op.alter_column(
            table,
            "organization_id",
            existing_type=uuid_type,
            nullable=False,
        )
        op.create_foreign_key(
            f"fk_{table}_organization_id",
            table,
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )

    for table in ["invoices", "invoice_items", "payment_methods", "document_access_log", "payments", "notifications"]:
        if not _table_exists(conn, table):
            continue
        # Only enforce NOT NULL where backfill covered all rows; others may have orphan nulls
        try:
            op.alter_column(
                table,
                "organization_id",
                existing_type=uuid_type,
                nullable=False,
            )
        except Exception:
            pass  # Leave nullable if backfill left nulls (e.g. orphan rows)
        op.create_foreign_key(
            f"fk_{table}_organization_id",
            table,
            "organizations",
            ["organization_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # 4) Triggers to enforce org-consistency: organization_id must match parent's organization_id
    # Trigger for case-scoped tables: organization_id must equal (SELECT organization_id FROM cases WHERE id = case_id)
    trigger_sql_case = """
    CREATE OR REPLACE FUNCTION check_org_consistency_case_child()
    RETURNS TRIGGER AS $$
    DECLARE
        parent_org_id uuid;
    BEGIN
        SELECT organization_id INTO parent_org_id FROM cases WHERE id = NEW.case_id;
        IF parent_org_id IS NULL THEN
            RAISE EXCEPTION 'case_id % does not exist', NEW.case_id;
        END IF;
        IF NEW.organization_id IS DISTINCT FROM parent_org_id THEN
            RAISE EXCEPTION 'organization_id must match case organization (case_id=%)', NEW.case_id;
        END IF;
        RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    """
    conn.execute(sa.text(trigger_sql_case))
    for table in tables_to_add_from_case:
        op.execute(
            f"""
            DROP TRIGGER IF EXISTS trg_{table}_org_consistency ON {table};
            CREATE TRIGGER trg_{table}_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id
                ON {table}
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_child();
            """
        )

    # Trigger for invoices (case_id -> cases)
    if _table_exists(conn, "invoices"):
        op.execute(
            """
            DROP TRIGGER IF EXISTS trg_invoices_org_consistency ON invoices;
            CREATE TRIGGER trg_invoices_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id
                ON invoices
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_child();
            """
        )
    # Trigger for invoice_items (invoice_id -> invoices.organization_id)
    if _table_exists(conn, "invoice_items"):
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION check_org_consistency_invoice_item()
                RETURNS TRIGGER AS $$
                DECLARE
                    parent_org_id uuid;
                BEGIN
                    SELECT organization_id INTO parent_org_id FROM invoices WHERE id = NEW.invoice_id;
                    IF parent_org_id IS NULL THEN
                        RAISE EXCEPTION 'invoice_id % does not exist', NEW.invoice_id;
                    END IF;
                    IF NEW.organization_id IS DISTINCT FROM parent_org_id THEN
                        RAISE EXCEPTION 'organization_id must match invoice organization';
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute(
            """
            DROP TRIGGER IF EXISTS trg_invoice_items_org_consistency ON invoice_items;
            CREATE TRIGGER trg_invoice_items_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, invoice_id
                ON invoice_items
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_invoice_item();
            """
        )
    # Trigger for payment_methods (client_id -> users.organization_id)
    if _table_exists(conn, "payment_methods"):
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION check_org_consistency_payment_method()
                RETURNS TRIGGER AS $$
                DECLARE
                    parent_org_id uuid;
                BEGIN
                    SELECT organization_id INTO parent_org_id FROM users WHERE id = NEW.client_id;
                    IF parent_org_id IS NULL THEN
                        RAISE EXCEPTION 'client_id % does not exist', NEW.client_id;
                    END IF;
                    IF NEW.organization_id IS DISTINCT FROM parent_org_id THEN
                        RAISE EXCEPTION 'organization_id must match user organization';
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute(
            """
            DROP TRIGGER IF EXISTS trg_payment_methods_org_consistency ON payment_methods;
            CREATE TRIGGER trg_payment_methods_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, client_id
                ON payment_methods
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_payment_method();
            """
        )
    # Trigger for document_access_log (document_id -> case_documents)
    if _table_exists(conn, "document_access_log"):
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION check_org_consistency_document_access_log()
                RETURNS TRIGGER AS $$
                DECLARE
                    parent_org_id uuid;
                BEGIN
                    SELECT cd.organization_id INTO parent_org_id
                    FROM case_documents cd WHERE cd.id = NEW.document_id;
                    IF parent_org_id IS NULL THEN
                        RAISE EXCEPTION 'document_id % not found in case_documents', NEW.document_id;
                    END IF;
                    IF NEW.organization_id IS DISTINCT FROM parent_org_id THEN
                        RAISE EXCEPTION 'organization_id must match case_document organization';
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute(
            """
            DROP TRIGGER IF EXISTS trg_document_access_log_org_consistency ON document_access_log;
            CREATE TRIGGER trg_document_access_log_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, document_id
                ON document_access_log
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_document_access_log();
            """
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Drop triggers first
    for table in CASE_CHILD_TABLES:
        if _table_exists(conn, table):
            op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_org_consistency ON {table};")
    op.execute("DROP FUNCTION IF EXISTS check_org_consistency_case_child();")
    if _table_exists(conn, "invoices"):
        op.execute("DROP TRIGGER IF EXISTS trg_invoices_org_consistency ON invoices;")
    if _table_exists(conn, "invoice_items"):
        op.execute("DROP TRIGGER IF EXISTS trg_invoice_items_org_consistency ON invoice_items;")
    op.execute("DROP FUNCTION IF EXISTS check_org_consistency_invoice_item();")
    if _table_exists(conn, "payment_methods"):
        op.execute("DROP TRIGGER IF EXISTS trg_payment_methods_org_consistency ON payment_methods;")
    op.execute("DROP FUNCTION IF EXISTS check_org_consistency_payment_method();")
    if _table_exists(conn, "document_access_log"):
        op.execute("DROP TRIGGER IF EXISTS trg_document_access_log_org_consistency ON document_access_log;")
    op.execute("DROP FUNCTION IF EXISTS check_org_consistency_document_access_log();")

    # Drop FKs and columns
    for table in CASE_CHILD_TABLES:
        if _table_exists(conn, table):
            op.drop_constraint(f"fk_{table}_organization_id", table, type_="foreignkey")
            op.drop_column(table, "organization_id")

    for table in ["invoices", "invoice_items", "payment_methods", "document_access_log", "payments", "notifications"]:
        if _table_exists(conn, table):
            op.drop_constraint(f"fk_{table}_organization_id", table, type_="foreignkey")
            op.drop_column(table, "organization_id")
