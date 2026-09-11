"""add privacy rights request workflow

Revision ID: d94f13a8b6e5
Revises: c83e02f7a5d4
Create Date: 2026-09-11 16:40:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d94f13a8b6e5"
down_revision: Union[str, Sequence[str], None] = "c83e02f7a5d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "privacy_requests",
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
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("request_type", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="submitted"),
        sa.Column("details", sa.Text()),
        sa.Column("resolution_note", sa.Text()),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "request_type IN ('access', 'correction', 'deletion')",
            name="ck_privacy_requests_type",
        ),
        sa.CheckConstraint(
            "status IN ('submitted', 'in_review', 'blocked_legal_hold', 'completed', 'denied')",
            name="ck_privacy_requests_status",
        ),
    )
    op.create_index(
        "idx_privacy_requests_org_status_due",
        "privacy_requests",
        ["organization_id", "status", "due_at"],
    )
    op.create_index(
        "idx_privacy_requests_requester",
        "privacy_requests",
        ["requested_by", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("privacy_requests")
