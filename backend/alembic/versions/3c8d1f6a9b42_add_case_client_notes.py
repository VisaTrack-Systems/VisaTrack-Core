"""add one-way client-facing notes to cases

Revision ID: 3c8d1f6a9b42
Revises: 07b5e0ad9c21
Create Date: 2026-10-19 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "3c8d1f6a9b42"
down_revision: Union[str, Sequence[str], None] = "07b5e0ad9c21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cases", sa.Column("client_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("cases", "client_notes")
