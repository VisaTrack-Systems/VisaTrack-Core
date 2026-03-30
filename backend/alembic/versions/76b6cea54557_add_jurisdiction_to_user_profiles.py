"""add_jurisdiction_to_user_profiles

Revision ID: 76b6cea54557
Revises: e92b3ac1b42b
Create Date: 2026-03-14 22:33:03.677232

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '76b6cea54557'
down_revision: Union[str, Sequence[str], None] = 'e92b3ac1b42b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if column already exists to handle cases where migration was partially applied
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('user_profiles')]
    
    if 'jurisdiction' not in columns:
        op.add_column('user_profiles', sa.Column('jurisdiction', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('user_profiles', 'jurisdiction')
