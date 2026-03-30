"""User Profile Model: SQLAlchemy ORM model extending user information
with role-specific profile data and preferences.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    user_type: Mapped[str] = mapped_column(String(50), nullable=False)
    bar_number: Mapped[Optional[str]] = mapped_column(String(100))
    specialties: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String))
    years_experience: Mapped[Optional[int]] = mapped_column(Integer)
    bio: Mapped[Optional[str]] = mapped_column(Text)
    hourly_rate: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    nationality: Mapped[Optional[str]] = mapped_column(String(100))
    current_status: Mapped[Optional[str]] = mapped_column(String(100))
    uci_number: Mapped[Optional[str]] = mapped_column(String(50))
    application_number: Mapped[Optional[str]] = mapped_column(String(50))
    emergency_contact: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)
    address: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)
    notification_prefs: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text(
            "'{\"email_case_updates\": true, \"email_documents\": true, \"email_payments\": true, \"sms_urgent\": false}'::jsonb"
        ),
    )
    custom_fields: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    user = relationship("User", back_populates="profile")
