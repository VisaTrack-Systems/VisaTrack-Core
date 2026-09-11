"""Health Check Routes: separate process liveness and dependency readiness."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.deps import get_db

router = APIRouter(tags=["health"])


@router.get("/")
def root_health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/live")
def liveness() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ready")
def readiness(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
    return {"status": "ready", "database": "ok"}
