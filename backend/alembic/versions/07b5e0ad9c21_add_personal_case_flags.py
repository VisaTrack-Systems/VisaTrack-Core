"""add private per-user case flags

Revision ID: 07b5e0ad9c21
Revises: f26a4d9c8e10
Create Date: 2026-10-16 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "07b5e0ad9c21"
down_revision: Union[str, Sequence[str], None] = "f26a4d9c8e10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_case_flags",
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "case_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("user_id", "case_id", name="pk_user_case_flags"),
    )
    op.create_index("idx_user_case_flags_case", "user_case_flags", ["case_id"])


def downgrade() -> None:
    op.drop_table("user_case_flags")
