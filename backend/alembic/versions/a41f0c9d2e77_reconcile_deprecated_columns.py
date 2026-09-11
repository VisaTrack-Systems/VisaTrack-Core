"""reconcile deprecated jurisdiction and visa office columns

Revision ID: a41f0c9d2e77
Revises: 76b6cea54557
Create Date: 2026-09-11 14:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a41f0c9d2e77"
down_revision: Union[str, Sequence[str], None] = "76b6cea54557"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS jurisdiction")
    op.execute("ALTER TABLE cases DROP COLUMN IF EXISTS visa_office")
    op.execute("DROP INDEX IF EXISTS idx_cases_priority")
    op.execute(
        "CREATE INDEX idx_cases_priority ON cases(priority) "
        "WHERE status <> 'closed'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_cases_priority")
    op.execute(
        "CREATE INDEX idx_cases_priority ON cases(priority) "
        "WHERE status NOT IN "
        "('approved', 'refused', 'withdrawn', 'closed')"
    )
    op.add_column(
        "user_profiles",
        sa.Column("jurisdiction", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "cases",
        sa.Column("visa_office", sa.String(length=100), nullable=True),
    )
