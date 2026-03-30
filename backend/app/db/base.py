"""Database Base Configuration: SQLAlchemy declarative base and table registry
for all ORM models.
"""

from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import model modules so Alembic can discover metadata.
from app.models import (  # noqa: F401,E402
    case,
    case_client,
    milestone,
    organization,
    role,
    user,
    user_invitation,
    user_profile,
    user_role,
)
