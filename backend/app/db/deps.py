"""Database Dependencies: FastAPI dependency injection for database sessions.
Provides get_db() for route handlers.
"""

from collections.abc import Generator

from app.db.session import SessionLocal


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
