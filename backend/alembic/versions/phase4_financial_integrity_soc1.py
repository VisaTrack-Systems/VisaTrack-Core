"""Phase 4: Financial integrity hardening (SOC 1)

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-02

4.1 Invoice immutability + adjustments
  - invoice_events table (append-only): invoice_created, sent, viewed,
    line_item_added, adjusted, voided, paid, refunded
  - Trigger: invoice editable only in draft; after sent/viewed no edits to
    totals, tax, currency, line items (raise instead; use adjustments)

4.2 Payment idempotency and reconciliation
  - UNIQUE(provider, provider_payment_id) on payments
  - Optional idempotency_key column on payments
  - Trigger: invoices.amount_paid updated only when payment status -> completed/refunded

4.3 Trust ledger event history
  - trust_entry_events table (append-only) for void/reconcile actions
  - Optional: no negative balance check
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INVOICE_EVENT_TYPES = (
    "invoice_created",
    "sent",
    "viewed",
    "line_item_added",
    "adjusted",
    "voided",
    "paid",
    "refunded",
)


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

    # ---- 4.1 invoice_events (append-only) ----
    if _table_exists(conn, "invoices") and not _table_exists(conn, "invoice_events"):
        op.create_table(
            "invoice_events",
            sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("invoice_id", uuid_type, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
            sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("event_type", sa.String(50), nullable=False),
            sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("actor_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("metadata", JSONB, nullable=True),
        )
        op.create_index("ix_invoice_events_invoice_id", "invoice_events", ["invoice_id"], unique=False)
        op.create_index("ix_invoice_events_occurred_at", "invoice_events", ["occurred_at"], unique=False)
        # Append-only: no UPDATE/DELETE
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION invoice_events_append_only()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF TG_OP IN ('UPDATE', 'DELETE') THEN
                        RAISE EXCEPTION 'invoice_events is append-only: % not allowed', TG_OP;
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute(
            """
            CREATE TRIGGER trg_invoice_events_append_only
                BEFORE UPDATE OR DELETE ON invoice_events
                FOR EACH ROW EXECUTE PROCEDURE invoice_events_append_only();
            """
        )

    # ---- 4.1 Invoice immutability: editable only in draft; after sent/viewed no edits to totals/tax/currency ----
    if _table_exists(conn, "invoices"):
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION invoices_immutable_after_sent()
                RETURNS TRIGGER AS $$
                BEGIN
                    -- Allow internal payment reconciliation updates (amount_paid) to bypass immutability checks.
                    IF current_setting('app.allow_amount_paid_update', true) = 'true' THEN
                        RETURN NEW;
                    END IF;
                    IF TG_OP = 'DELETE' THEN
                        RAISE EXCEPTION 'invoices: delete not allowed; use void instead';
                    END IF;
                    IF OLD.status IS DISTINCT FROM 'draft' AND NEW.status IS DISTINCT FROM 'voided' THEN
                        IF (OLD.total_amount IS DISTINCT FROM NEW.total_amount)
                           OR (OLD.amount_due IS DISTINCT FROM NEW.amount_due) THEN
                            RAISE EXCEPTION 'invoices: totals editable only in draft; use adjustments';
                        END IF;
                        IF (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='tax') IS NOT NULL THEN
                            IF OLD.tax IS DISTINCT FROM NEW.tax THEN
                                RAISE EXCEPTION 'invoices: tax editable only in draft';
                            END IF;
                        END IF;
                        IF (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' AND column_name='currency') IS NOT NULL THEN
                            IF OLD.currency IS DISTINCT FROM NEW.currency THEN
                                RAISE EXCEPTION 'invoices: currency editable only in draft';
                            END IF;
                        END IF;
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute("DROP TRIGGER IF EXISTS trg_invoices_immutable_after_sent ON invoices;")
        op.execute(
            """
            CREATE TRIGGER trg_invoices_immutable_after_sent
                BEFORE UPDATE OR DELETE ON invoices
                FOR EACH ROW EXECUTE PROCEDURE invoices_immutable_after_sent();
            """
        )

    # Prevent invoice_items changes when invoice is not draft
    if _table_exists(conn, "invoice_items") and _table_exists(conn, "invoices"):
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION invoice_items_immutable_after_sent()
                RETURNS TRIGGER AS $$
                DECLARE inv_status text;
                BEGIN
                    IF TG_OP = 'DELETE' THEN
                        SELECT status INTO inv_status FROM invoices WHERE id = OLD.invoice_id;
                        IF inv_status IS NOT NULL AND inv_status != 'draft' THEN
                            RAISE EXCEPTION 'invoice_items: cannot delete line items after invoice sent; use adjustments';
                        END IF;
                        RETURN OLD;
                    END IF;
                    IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
                        SELECT status INTO inv_status FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
                        IF inv_status IS NOT NULL AND inv_status != 'draft' THEN
                            RAISE EXCEPTION 'invoice_items: cannot add/update line items after invoice sent; use adjustments';
                        END IF;
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute("DROP TRIGGER IF EXISTS trg_invoice_items_immutable_after_sent ON invoice_items;")
        op.execute(
            """
            CREATE TRIGGER trg_invoice_items_immutable_after_sent
                BEFORE INSERT OR UPDATE OR DELETE ON invoice_items
                FOR EACH ROW EXECUTE PROCEDURE invoice_items_immutable_after_sent();
            """
        )

    # ---- 4.2 Payment idempotency ----
    if _table_exists(conn, "payments"):
        if _column_exists(conn, "payments", "idempotency_key") is False:
            op.add_column(
                "payments",
                sa.Column("idempotency_key", sa.String(255), nullable=True),
            )
        if _column_exists(conn, "payments", "provider") and _column_exists(conn, "payments", "provider_payment_id"):
            op.create_index(
                "ix_payments_provider_provider_payment_id",
                "payments",
                ["provider", "provider_payment_id"],
                unique=True,
                postgresql_where=sa.text("provider_payment_id IS NOT NULL AND provider_payment_id != ''"),
            )

    # ---- 4.2 invoices.amount_paid only from payment status completed/refunded ----
    if _table_exists(conn, "payments") and _table_exists(conn, "invoices"):
        if _column_exists(conn, "payments", "invoice_id") and _column_exists(conn, "invoices", "amount_paid"):
            conn.execute(
                sa.text(
                    """
                    CREATE OR REPLACE FUNCTION payments_sync_invoice_amount_paid()
                    RETURNS TRIGGER AS $$
                    DECLARE
                        delta numeric := 0;
                    BEGIN
                        IF TG_OP = 'INSERT' AND NEW.status IN ('completed', 'paid') THEN
                            delta := COALESCE(NEW.amount, 0);
                        ELSIF TG_OP = 'INSERT' AND NEW.status = 'refunded' THEN
                            delta := -COALESCE(NEW.amount, 0);
                        ELSIF TG_OP = 'UPDATE' THEN
                            IF OLD.status NOT IN ('completed', 'paid', 'refunded') AND NEW.status IN ('completed', 'paid') THEN
                                delta := COALESCE(NEW.amount, 0);
                            ELSIF OLD.status IN ('completed', 'paid') AND NEW.status = 'refunded' THEN
                                delta := -COALESCE(OLD.amount, 0);
                            ELSIF OLD.status IN ('completed', 'paid', 'refunded') AND NEW.status NOT IN ('completed', 'paid', 'refunded') THEN
                                delta := -COALESCE(OLD.amount, 0);
                            END IF;
                        END IF;
                        IF delta != 0 AND NEW.invoice_id IS NOT NULL THEN
                            PERFORM set_config('app.allow_amount_paid_update', 'true', true);
                            UPDATE invoices
                            SET amount_paid = GREATEST(0, COALESCE(amount_paid, 0) + delta)
                            WHERE id = NEW.invoice_id;
                        END IF;
                        RETURN NEW;
                    END; $$ LANGUAGE plpgsql;
                    """
                )
            )
            op.execute("DROP TRIGGER IF EXISTS trg_payments_sync_invoice_amount_paid ON payments;")
            op.execute(
                """
                CREATE TRIGGER trg_payments_sync_invoice_amount_paid
                    AFTER INSERT OR UPDATE OF status, amount ON payments
                    FOR EACH ROW EXECUTE PROCEDURE payments_sync_invoice_amount_paid();
                """
            )
        # Block direct UPDATE of invoices.amount_paid so it only changes via payment trigger
        if _column_exists(conn, "invoices", "amount_paid"):
            conn.execute(
                sa.text(
                    """
                    CREATE OR REPLACE FUNCTION invoices_amount_paid_readonly()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF current_setting('app.allow_amount_paid_update', true) = 'true' THEN
                            PERFORM set_config('app.allow_amount_paid_update', '', true);
                            RETURN NEW;
                        END IF;
                        IF OLD.amount_paid IS DISTINCT FROM NEW.amount_paid THEN
                            RAISE EXCEPTION 'invoices.amount_paid is updated only from payment status changes (completed/refunded)';
                        END IF;
                        RETURN NEW;
                    END; $$ LANGUAGE plpgsql;
                    """
                )
            )
            op.execute("DROP TRIGGER IF EXISTS trg_invoices_amount_paid_readonly ON invoices;")
            op.execute(
                """
                CREATE TRIGGER trg_invoices_amount_paid_readonly
                    BEFORE UPDATE ON invoices
                    FOR EACH ROW EXECUTE PROCEDURE invoices_amount_paid_readonly();
                """
            )

    # ---- 4.3 trust_entry_events (append-only) ----
    if _table_exists(conn, "trust_account_entries") and not _table_exists(conn, "trust_entry_events"):
        op.create_table(
            "trust_entry_events",
            sa.Column("id", uuid_type, primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("trust_entry_id", uuid_type, nullable=False),
            sa.Column("organization_id", uuid_type, sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
            sa.Column("event_type", sa.String(50), nullable=False),
            sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("actor_user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("metadata", JSONB, nullable=True),
        )
        op.create_index("ix_trust_entry_events_trust_entry_id", "trust_entry_events", ["trust_entry_id"], unique=False)
        conn.execute(
            sa.text(
                """
                CREATE OR REPLACE FUNCTION trust_entry_events_append_only()
                RETURNS TRIGGER AS $$
                BEGIN
                    IF TG_OP IN ('UPDATE', 'DELETE') THEN
                        RAISE EXCEPTION 'trust_entry_events is append-only: % not allowed', TG_OP;
                    END IF;
                    RETURN NEW;
                END; $$ LANGUAGE plpgsql;
                """
            )
        )
        op.execute(
            """
            CREATE TRIGGER trg_trust_entry_events_append_only
                BEFORE UPDATE OR DELETE ON trust_entry_events
                FOR EACH ROW EXECUTE PROCEDURE trust_entry_events_append_only();
            """
        )


def downgrade() -> None:
    conn = op.get_bind()

    if _table_exists(conn, "trust_entry_events"):
        op.execute("DROP TRIGGER IF EXISTS trg_trust_entry_events_append_only ON trust_entry_events;")
        op.execute("DROP FUNCTION IF EXISTS trust_entry_events_append_only();")
        op.drop_table("trust_entry_events")

    if _table_exists(conn, "invoices"):
        op.execute("DROP TRIGGER IF EXISTS trg_invoices_amount_paid_readonly ON invoices;")
        op.execute("DROP FUNCTION IF EXISTS invoices_amount_paid_readonly();")
    if _table_exists(conn, "payments"):
        op.execute("DROP TRIGGER IF EXISTS trg_payments_sync_invoice_amount_paid ON payments;")
        op.execute("DROP FUNCTION IF EXISTS payments_sync_invoice_amount_paid();")

    if _table_exists(conn, "invoice_items"):
        op.execute("DROP TRIGGER IF EXISTS trg_invoice_items_immutable_after_sent ON invoice_items;")
        op.execute("DROP FUNCTION IF EXISTS invoice_items_immutable_after_sent();")

    if _table_exists(conn, "invoices"):
        op.execute("DROP TRIGGER IF EXISTS trg_invoices_immutable_after_sent ON invoices;")
        op.execute("DROP FUNCTION IF EXISTS invoices_immutable_after_sent();")

    if _table_exists(conn, "payments"):
        op.drop_index("ix_payments_provider_provider_payment_id", table_name="payments", if_exists=True)
        if _column_exists(conn, "payments", "idempotency_key"):
            op.drop_column("payments", "idempotency_key")

    if _table_exists(conn, "invoice_events"):
        op.execute("DROP TRIGGER IF EXISTS trg_invoice_events_append_only ON invoice_events;")
        op.execute("DROP FUNCTION IF EXISTS invoice_events_append_only();")
        op.drop_table("invoice_events")
