"""add Stripe Checkout reconciliation and idempotency controls

Revision ID: e15f8a2c7b91
Revises: d94f13a8b6e5
Create Date: 2026-09-15 22:55:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e15f8a2c7b91"
down_revision: Union[str, Sequence[str], None] = "d94f13a8b6e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("idempotency_key", sa.String(length=255)))
    op.add_column(
        "payments",
        sa.Column("provider_checkout_session_id", sa.String(length=255)),
    )
    op.add_column("payments", sa.Column("checkout_url", sa.Text()))
    op.add_column("payments", sa.Column("checkout_expires_at", sa.DateTime(timezone=True)))
    op.add_column("payments", sa.Column("failure_code", sa.String(length=100)))
    op.create_unique_constraint(
        "uq_payments_invoice_idempotency",
        "payments",
        ["invoice_id", "idempotency_key"],
    )
    op.create_unique_constraint(
        "uq_payments_checkout_session",
        "payments",
        ["provider_checkout_session_id"],
    )
    op.create_index(
        "uq_payments_provider_payment",
        "payments",
        ["provider", "provider_payment_id"],
        unique=True,
        postgresql_where=sa.text("provider_payment_id IS NOT NULL"),
    )

    op.create_table(
        "stripe_webhook_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("stripe_event_id", sa.String(length=255), nullable=False, unique=True),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("livemode", sa.Boolean(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("stripe_webhook_events")
    op.drop_index("uq_payments_provider_payment", table_name="payments")
    op.drop_constraint("uq_payments_checkout_session", "payments", type_="unique")
    op.drop_constraint("uq_payments_invoice_idempotency", "payments", type_="unique")
    op.drop_column("payments", "failure_code")
    op.drop_column("payments", "checkout_expires_at")
    op.drop_column("payments", "checkout_url")
    op.drop_column("payments", "provider_checkout_session_id")
    op.drop_column("payments", "idempotency_key")
