"""User Model: SQLAlchemy ORM model for user accounts.
Stores authentication, profile, and organizational relationship data.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE")
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    phone_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    mfa_secret: Mapped[Optional[str]] = mapped_column(String(255))
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    login_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="active")
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, server_default="America/Toronto")
    locale: Mapped[str] = mapped_column(String(10), nullable=False, server_default="en-CA")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    organization = relationship("Organization", back_populates="users")
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    user_roles = relationship("UserRole", back_populates="user", foreign_keys="UserRole.user_id")
    client_cases = relationship("Case", foreign_keys="Case.client_id", back_populates="client")
    lawyer_cases = relationship(
        "Case", foreign_keys="Case.primary_lawyer_id", back_populates="primary_lawyer"
    )
