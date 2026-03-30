"""Test Model: SQLAlchemy ORM model for testing purposes.
⚠️ DEVELOPMENT/TESTING FIXTURE: This model is used for development and smoke tests only.
May be removed in production or migrated to a proper testing structure.
"""

from sqlalchemy import Column, Integer, String

from app.db.base import Base


class Test(Base):
    __tablename__ = "test"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
