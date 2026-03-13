"""Phase 1 tenant isolation: stricter triggers + indexes (SOC 2 critical)

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-02

- Replaces org-consistency triggers with stricter checks so cross-org ID links
  fail at INSERT/UPDATE (case.org = client_user.org, uploader.org, sender/recipient
  org, document.case.org = user.org, payments invoice.client = payment_method.client).
- Adds indexes (organization_id, case_id), (organization_id, created_at),
  (organization_id, user_id) for tenant-scoped queries.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
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

    # ---- 1) Stricter org-consistency trigger functions ----
    # case_clients: case.org = client_user.org = row.org
    # case_assignments: case.org = lawyer.org = row.org
    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION check_org_consistency_case_child()
            RETURNS TRIGGER AS $$
            DECLARE
                case_org_id uuid;
                user_org_id uuid;
            BEGIN
                SELECT organization_id INTO case_org_id FROM cases WHERE id = NEW.case_id;
                IF case_org_id IS NULL THEN
                    RAISE EXCEPTION 'case_id % does not exist', NEW.case_id;
                END IF;
                IF NEW.organization_id IS DISTINCT FROM case_org_id THEN
                    RAISE EXCEPTION 'organization_id must match case organization (case_id=%)', NEW.case_id;
                END IF;
                IF TG_TABLE_NAME = 'case_clients' THEN
                    SELECT organization_id INTO user_org_id FROM users WHERE id = NEW.client_user_id;
                    IF user_org_id IS NULL THEN
                        RAISE EXCEPTION 'client_user_id % does not exist', NEW.client_user_id;
                    END IF;
                    IF user_org_id IS DISTINCT FROM case_org_id THEN
                        RAISE EXCEPTION 'case_clients: client_user must belong to case organization';
                    END IF;
                ELSIF TG_TABLE_NAME = 'case_assignments' THEN
                    IF NEW.lawyer_id IS NOT NULL THEN
                        SELECT organization_id INTO user_org_id FROM users WHERE id = NEW.lawyer_id;
                        IF user_org_id IS NULL THEN
                            RAISE EXCEPTION 'lawyer_id % does not exist', NEW.lawyer_id;
                        END IF;
                        IF user_org_id IS DISTINCT FROM case_org_id THEN
                            RAISE EXCEPTION 'case_assignments: lawyer must belong to case organization';
                        END IF;
                    END IF;
                END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )

    # case_documents: case.org = uploader.org = row.org
    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION check_org_consistency_case_document()
            RETURNS TRIGGER AS $$
            DECLARE
                case_org_id uuid;
                uploader_org_id uuid;
            BEGIN
                SELECT organization_id INTO case_org_id FROM cases WHERE id = NEW.case_id;
                IF case_org_id IS NULL THEN
                    RAISE EXCEPTION 'case_id % does not exist', NEW.case_id;
                END IF;
                IF NEW.organization_id IS DISTINCT FROM case_org_id THEN
                    RAISE EXCEPTION 'organization_id must match case organization';
                END IF;
                IF NEW.uploaded_by IS NOT NULL THEN
                    SELECT organization_id INTO uploader_org_id FROM users WHERE id = NEW.uploaded_by;
                    IF uploader_org_id IS NULL THEN
                        RAISE EXCEPTION 'uploaded_by user % does not exist', NEW.uploaded_by;
                    END IF;
                    IF uploader_org_id IS DISTINCT FROM case_org_id THEN
                        RAISE EXCEPTION 'case_documents: uploader must belong to case organization';
                    END IF;
                END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )

    # document_access_log: document.case.org = user.org = row.org
    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION check_org_consistency_document_access_log()
            RETURNS TRIGGER AS $$
            DECLARE
                doc_org_id uuid;
                actor_org_id uuid;
            BEGIN
                SELECT c.organization_id INTO doc_org_id
                FROM case_documents cd
                JOIN cases c ON c.id = cd.case_id
                WHERE cd.id = NEW.document_id;
                IF doc_org_id IS NULL THEN
                    RAISE EXCEPTION 'document_id % not found in case_documents', NEW.document_id;
                END IF;
                IF NEW.organization_id IS DISTINCT FROM doc_org_id THEN
                    RAISE EXCEPTION 'organization_id must match case_document organization';
                END IF;
                IF NEW.user_id IS NOT NULL THEN
                    SELECT organization_id INTO actor_org_id FROM users WHERE id = NEW.user_id;
                    IF actor_org_id IS NOT NULL AND actor_org_id IS DISTINCT FROM doc_org_id THEN
                        RAISE EXCEPTION 'document_access_log: user must belong to document case organization';
                    END IF;
                END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )

    # messages: case.org = sender.org = recipient.org = row.org
    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION check_org_consistency_message()
            RETURNS TRIGGER AS $$
            DECLARE
                case_org_id uuid;
                sender_org_id uuid;
                recip_org_id uuid;
            BEGIN
                SELECT organization_id INTO case_org_id FROM cases WHERE id = NEW.case_id;
                IF case_org_id IS NULL THEN
                    RAISE EXCEPTION 'case_id % does not exist', NEW.case_id;
                END IF;
                IF NEW.organization_id IS DISTINCT FROM case_org_id THEN
                    RAISE EXCEPTION 'organization_id must match case organization';
                END IF;
                IF NEW.sender_id IS NOT NULL THEN
                    SELECT organization_id INTO sender_org_id FROM users WHERE id = NEW.sender_id;
                    IF sender_org_id IS NULL THEN
                        RAISE EXCEPTION 'sender_id % does not exist', NEW.sender_id;
                    END IF;
                    IF sender_org_id IS DISTINCT FROM case_org_id THEN
                        RAISE EXCEPTION 'messages: sender must belong to case organization';
                    END IF;
                END IF;
                IF NEW.recipient_id IS NOT NULL THEN
                    SELECT organization_id INTO recip_org_id FROM users WHERE id = NEW.recipient_id;
                    IF recip_org_id IS NULL THEN
                        RAISE EXCEPTION 'recipient_id % does not exist', NEW.recipient_id;
                    END IF;
                    IF recip_org_id IS DISTINCT FROM case_org_id THEN
                        RAISE EXCEPTION 'messages: recipient must belong to case organization';
                    END IF;
                END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )

    # payments: invoice.org = row.org; when columns exist, payment_method.client = invoice.client and payments.client_id = invoice.client_id
    # Use a single function that checks only columns we know invoices has (organization_id, client_id). For payments we need invoice_id.
    # If payments has payment_method_id/client_id we check them; PL/pgSQL will error if we reference missing columns, so create only when table has them.
    if _table_exists(conn, "payments") and _column_exists(conn, "payments", "invoice_id"):
        has_pm = _column_exists(conn, "payments", "payment_method_id")
        has_client = _column_exists(conn, "payments", "client_id")
        inv_has_client = _column_exists(conn, "invoices", "client_id")
        if has_pm and has_client and inv_has_client:
            conn.execute(
                sa.text(
                    """
                    CREATE OR REPLACE FUNCTION check_org_consistency_payment()
                    RETURNS TRIGGER AS $$
                    DECLARE
                        inv_org_id uuid;
                        inv_client_id uuid;
                        pm_client_id uuid;
                    BEGIN
                        SELECT organization_id, client_id INTO inv_org_id, inv_client_id
                        FROM invoices WHERE id = NEW.invoice_id;
                        IF inv_org_id IS NULL THEN
                            RAISE EXCEPTION 'invoice_id % does not exist', NEW.invoice_id;
                        END IF;
                        IF NEW.organization_id IS DISTINCT FROM inv_org_id THEN
                            RAISE EXCEPTION 'payments: organization_id must match invoice organization';
                        END IF;
                        IF NEW.payment_method_id IS NOT NULL AND inv_client_id IS NOT NULL THEN
                            SELECT client_id INTO pm_client_id FROM payment_methods WHERE id = NEW.payment_method_id;
                            IF pm_client_id IS DISTINCT FROM inv_client_id THEN
                                RAISE EXCEPTION 'payments: payment_method client must match invoice client';
                            END IF;
                        END IF;
                        IF inv_client_id IS NOT NULL AND NEW.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM inv_client_id THEN
                            RAISE EXCEPTION 'payments: client_id must match invoice client';
                        END IF;
                        RETURN NEW;
                    END; $$ LANGUAGE plpgsql;
                    """
                )
            )
        else:
            conn.execute(
                sa.text(
                    """
                    CREATE OR REPLACE FUNCTION check_org_consistency_payment()
                    RETURNS TRIGGER AS $$
                    DECLARE inv_org_id uuid;
                    BEGIN
                        SELECT organization_id INTO inv_org_id FROM invoices WHERE id = NEW.invoice_id;
                        IF inv_org_id IS NULL THEN
                            RAISE EXCEPTION 'invoice_id % does not exist', NEW.invoice_id;
                        END IF;
                        IF NEW.organization_id IS DISTINCT FROM inv_org_id THEN
                            RAISE EXCEPTION 'payments: organization_id must match invoice organization';
                        END IF;
                        RETURN NEW;
                    END; $$ LANGUAGE plpgsql;
                    """
                )
            )

    # case_clients: trigger must fire on client_user_id change
    if _table_exists(conn, "case_clients"):
        op.execute("DROP TRIGGER IF EXISTS trg_case_clients_org_consistency ON case_clients;")
        op.execute(
            """
            CREATE TRIGGER trg_case_clients_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id, client_user_id
                ON case_clients
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_child();
            """
        )
    # case_assignments: trigger must fire on lawyer_id change
    if _table_exists(conn, "case_assignments"):
        op.execute("DROP TRIGGER IF EXISTS trg_case_assignments_org_consistency ON case_assignments;")
        op.execute(
            """
            CREATE TRIGGER trg_case_assignments_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id, lawyer_id
                ON case_assignments
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_child();
            """
        )

    # Drop old case_documents trigger (used generic case_child) and attach case_document-specific
    if _table_exists(conn, "case_documents"):
        op.execute("DROP TRIGGER IF EXISTS trg_case_documents_org_consistency ON case_documents;")
        op.execute(
            """
            CREATE TRIGGER trg_case_documents_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id, uploaded_by
                ON case_documents
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_document();
            """
        )

    # document_access_log: trigger must fire on user_id change
    if _table_exists(conn, "document_access_log"):
        op.execute("DROP TRIGGER IF EXISTS trg_document_access_log_org_consistency ON document_access_log;")
        op.execute(
            """
            CREATE TRIGGER trg_document_access_log_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, document_id, user_id
                ON document_access_log
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_document_access_log();
            """
        )

    # messages: replace generic with message-specific
    if _table_exists(conn, "messages"):
        op.execute("DROP TRIGGER IF EXISTS trg_messages_org_consistency ON messages;")
        op.execute(
            """
            CREATE TRIGGER trg_messages_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id, sender_id, recipient_id
                ON messages
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_message();
            """
        )

    # payments: create trigger only if we created the function (payments has invoice_id + organization_id)
    if _table_exists(conn, "payments") and _column_exists(conn, "payments", "organization_id") and _column_exists(conn, "payments", "invoice_id"):
        op.execute("DROP TRIGGER IF EXISTS trg_payments_org_consistency ON payments;")
        op.execute(
            """
            CREATE TRIGGER trg_payments_org_consistency
                BEFORE INSERT OR UPDATE ON payments
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_payment();
            """
        )

    # notifications: if table exists, ensure sender/recipient org = row.org
    if _table_exists(conn, "notifications") and _column_exists(conn, "notifications", "organization_id"):
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION check_org_consistency_notification()
                RETURNS TRIGGER AS $$
                DECLARE
                    case_org_id uuid;
                    user_org_id uuid;
                BEGIN
                    IF NEW.case_id IS NOT NULL THEN
                        SELECT organization_id INTO case_org_id FROM cases WHERE id = NEW.case_id;
                        IF case_org_id IS NULL THEN
                            RAISE EXCEPTION 'case_id % does not exist', NEW.case_id;
                        END IF;
                        IF NEW.organization_id IS DISTINCT FROM case_org_id THEN
                            RAISE EXCEPTION 'organization_id must match case organization';
                        END IF;
                    END IF;
                    IF NEW.user_id IS NOT NULL THEN
                        SELECT organization_id INTO user_org_id FROM users WHERE id = NEW.user_id;
                        IF user_org_id IS NOT NULL AND NEW.organization_id IS NOT NULL AND user_org_id IS DISTINCT FROM NEW.organization_id THEN
                            RAISE EXCEPTION 'notifications: user must belong to row organization';
                        END IF;
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute("DROP TRIGGER IF EXISTS trg_notifications_org_consistency ON notifications;")
        op.execute(
            """
            CREATE TRIGGER trg_notifications_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id, user_id
                ON notifications
                FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_notification();
            """
        )

    # ---- 2) Indexes for tenant-scoped queries ----
    index_specs = [
        ("case_clients", ["organization_id", "case_id"], "ix_case_clients_org_case"),
        ("case_assignments", ["organization_id", "case_id"], "ix_case_assignments_org_case"),
        ("milestones", ["organization_id", "case_id"], "ix_milestones_org_case"),
        ("milestones", ["organization_id", "created_at"], "ix_milestones_org_created"),
        ("messages", ["organization_id", "case_id"], "ix_messages_org_case"),
        ("messages", ["organization_id", "created_at"], "ix_messages_org_created"),
        ("case_documents", ["organization_id", "case_id"], "ix_case_documents_org_case"),
        ("case_documents", ["organization_id", "created_at"], "ix_case_documents_org_created"),
        ("document_access_log", ["organization_id", "created_at"], "ix_document_access_log_org_created"),
        ("invoices", ["organization_id", "case_id"], "ix_invoices_org_case"),
        ("invoices", ["organization_id", "created_at"], "ix_invoices_org_created"),
        ("invoice_items", ["organization_id", "invoice_id"], "ix_invoice_items_org_invoice"),
        ("payment_methods", ["organization_id", "client_id"], "ix_payment_methods_org_client"),
        ("payments", ["organization_id", "created_at"], "ix_payments_org_created"),
        ("notifications", ["organization_id", "user_id"], "ix_notifications_org_user"),
        ("notifications", ["organization_id", "created_at"], "ix_notifications_org_created"),
    ]
    for table, cols, idx_name in index_specs:
        if not _table_exists(conn, table):
            continue
        if not all(_column_exists(conn, table, c) for c in cols):
            continue
        op.create_index(idx_name, table, cols, unique=False)

    # activity_log / document_access_log user_id index if column exists
    if _table_exists(conn, "document_access_log") and _column_exists(conn, "document_access_log", "user_id"):
        op.create_index(
            "ix_document_access_log_org_user",
            "document_access_log",
            ["organization_id", "user_id"],
            unique=False,
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Drop indexes (reverse order by table)
    for table, cols, idx_name in [
        ("document_access_log", ["organization_id", "user_id"], "ix_document_access_log_org_user"),
        ("notifications", ["organization_id", "created_at"], "ix_notifications_org_created"),
        ("notifications", ["organization_id", "user_id"], "ix_notifications_org_user"),
        ("payments", ["organization_id", "created_at"], "ix_payments_org_created"),
        ("payment_methods", ["organization_id", "client_id"], "ix_payment_methods_org_client"),
        ("invoice_items", ["organization_id", "invoice_id"], "ix_invoice_items_org_invoice"),
        ("invoices", ["organization_id", "created_at"], "ix_invoices_org_created"),
        ("invoices", ["organization_id", "case_id"], "ix_invoices_org_case"),
        ("document_access_log", ["organization_id", "created_at"], "ix_document_access_log_org_created"),
        ("case_documents", ["organization_id", "created_at"], "ix_case_documents_org_created"),
        ("case_documents", ["organization_id", "case_id"], "ix_case_documents_org_case"),
        ("messages", ["organization_id", "created_at"], "ix_messages_org_created"),
        ("messages", ["organization_id", "case_id"], "ix_messages_org_case"),
        ("milestones", ["organization_id", "created_at"], "ix_milestones_org_created"),
        ("milestones", ["organization_id", "case_id"], "ix_milestones_org_case"),
        ("case_assignments", ["organization_id", "case_id"], "ix_case_assignments_org_case"),
        ("case_clients", ["organization_id", "case_id"], "ix_case_clients_org_case"),
    ]:
        if _table_exists(conn, table):
            op.drop_index(idx_name, table_name=table, if_exists=True)

    # Restore original trigger functions and triggers (simplified; case_documents/messages use generic case_child again)
    if _table_exists(conn, "case_documents"):
        op.execute("DROP TRIGGER IF EXISTS trg_case_documents_org_consistency ON case_documents;")
    if _table_exists(conn, "messages"):
        op.execute("DROP TRIGGER IF EXISTS trg_messages_org_consistency ON messages;")
    if _table_exists(conn, "payments"):
        op.execute("DROP TRIGGER IF EXISTS trg_payments_org_consistency ON payments;")
    if _table_exists(conn, "notifications"):
        op.execute("DROP TRIGGER IF EXISTS trg_notifications_org_consistency ON notifications;")

    op.execute("DROP FUNCTION IF EXISTS check_org_consistency_payment();")
    op.execute("DROP FUNCTION IF EXISTS check_org_consistency_notification();")
    # Restore original check_org_consistency_case_child (without case_clients/case_assignments user checks)
    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION check_org_consistency_case_child()
            RETURNS TRIGGER AS $$
            DECLARE parent_org_id uuid;
            BEGIN
                SELECT organization_id INTO parent_org_id FROM cases WHERE id = NEW.case_id;
                IF parent_org_id IS NULL THEN RAISE EXCEPTION 'case_id % does not exist', NEW.case_id; END IF;
                IF NEW.organization_id IS DISTINCT FROM parent_org_id THEN
                    RAISE EXCEPTION 'organization_id must match case organization (case_id=%)', NEW.case_id;
                END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )
    # Re-attach case_clients and case_assignments with original UPDATE OF list
    if _table_exists(conn, "case_clients"):
        op.execute("DROP TRIGGER IF EXISTS trg_case_clients_org_consistency ON case_clients;")
        op.execute(
            """
            CREATE TRIGGER trg_case_clients_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id
                ON case_clients FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_child();
            """
        )
    if _table_exists(conn, "case_assignments"):
        op.execute("DROP TRIGGER IF EXISTS trg_case_assignments_org_consistency ON case_assignments;")
        op.execute(
            """
            CREATE TRIGGER trg_case_assignments_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id
                ON case_assignments FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_child();
            """
        )
    # Re-attach case_documents and messages to generic trigger
    if _table_exists(conn, "case_documents"):
        op.execute(
            """
            CREATE TRIGGER trg_case_documents_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id
                ON case_documents FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_child();
            """
        )
    if _table_exists(conn, "messages"):
        op.execute(
            """
            CREATE TRIGGER trg_messages_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, case_id
                ON messages FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_case_child();
            """
        )
    # Restore document_access_log trigger with original UPDATE OF
    if _table_exists(conn, "document_access_log"):
        op.execute("DROP TRIGGER IF EXISTS trg_document_access_log_org_consistency ON document_access_log;")
        op.execute(
            """
            CREATE TRIGGER trg_document_access_log_org_consistency
                BEFORE INSERT OR UPDATE OF organization_id, document_id
                ON document_access_log FOR EACH ROW EXECUTE PROCEDURE check_org_consistency_document_access_log();
            """
        )
    # Restore original case_document and document_access_log and message functions (simplified)
    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION check_org_consistency_case_document()
            RETURNS TRIGGER AS $$
            DECLARE case_org_id uuid;
            BEGIN
                SELECT organization_id INTO case_org_id FROM cases WHERE id = NEW.case_id;
                IF case_org_id IS NULL THEN RAISE EXCEPTION 'case_id does not exist'; END IF;
                IF NEW.organization_id IS DISTINCT FROM case_org_id THEN RAISE EXCEPTION 'organization_id must match case'; END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION check_org_consistency_document_access_log()
            RETURNS TRIGGER AS $$
            DECLARE parent_org_id uuid;
            BEGIN
                SELECT cd.organization_id INTO parent_org_id FROM case_documents cd WHERE cd.id = NEW.document_id;
                IF parent_org_id IS NULL THEN RAISE EXCEPTION 'document_id not found'; END IF;
                IF NEW.organization_id IS DISTINCT FROM parent_org_id THEN RAISE EXCEPTION 'organization_id must match case_document'; END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )
    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION check_org_consistency_message()
            RETURNS TRIGGER AS $$
            DECLARE case_org_id uuid;
            BEGIN
                SELECT organization_id INTO case_org_id FROM cases WHERE id = NEW.case_id;
                IF case_org_id IS NULL THEN RAISE EXCEPTION 'case_id does not exist'; END IF;
                IF NEW.organization_id IS DISTINCT FROM case_org_id THEN RAISE EXCEPTION 'organization_id must match case'; END IF;
                RETURN NEW;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )
