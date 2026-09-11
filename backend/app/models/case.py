"""Case Model: SQLAlchemy ORM model for the cases entity.
Represents visa case records with all associated metadata and relationships.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    case_number: Mapped[str] = mapped_column(String(100), nullable=False)
    ircc_file_number: Mapped[Optional[str]] = mapped_column(String(100))
    uci_number: Mapped[Optional[str]] = mapped_column(String(50))
    application_number: Mapped[Optional[str]] = mapped_column(String(50))
    client_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    primary_lawyer_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id")
    )
    case_type: Mapped[str] = mapped_column(String(100), nullable=False)
    case_subtype: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="intake")
    intake_date: Mapped[Optional[date]] = mapped_column(Date)
    target_filing_date: Mapped[Optional[date]] = mapped_column(Date)
    estimated_completion_from: Mapped[Optional[date]] = mapped_column(Date)
    estimated_completion_to: Mapped[Optional[date]] = mapped_column(Date)
    completion_confidence: Mapped[Optional[int]] = mapped_column(Integer)
    description: Mapped[Optional[str]] = mapped_column(Text)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), nullable=False, server_default="medium")
    complexity: Mapped[str] = mapped_column(String(20), nullable=False, server_default="standard")
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_filing_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_completion_date: Mapped[Optional[date]] = mapped_column(Date)
    fee_agreement: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)
    source: Mapped[Optional[str]] = mapped_column(String(50))
    tags: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text))
    custom_fields: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    organization = relationship("Organization", back_populates="cases")
    client = relationship("User", foreign_keys=[client_id], back_populates="client_cases")
    primary_lawyer = relationship("User", foreign_keys=[primary_lawyer_id], back_populates="lawyer_cases")
    milestones = relationship("Milestone", back_populates="case")
