"""add_jurisdiction_to_user_profiles

Revision ID: 76b6cea54557
Revises: e92b3ac1b42b
Create Date: 2026-03-14 22:33:03.677232

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '76b6cea54557'
down_revision: Union[str, Sequence[str], None] = 'e92b3ac1b42b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE user_profiles "
        "ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(100)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE user_profiles DROP COLUMN IF EXISTS jurisdiction"
    )
