"""Database Base Configuration: SQLAlchemy declarative base and table registry
for all ORM models.
"""

from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import model modules so Alembic can discover metadata.
from app.models import (  # noqa: F401,E402
    background_job,
    case,
    case_client,
    mfa_recovery_code,
    milestone,
    organization,
    role,
    user,
    user_invitation,
    user_profile,
    user_role,
    user_session,
)
