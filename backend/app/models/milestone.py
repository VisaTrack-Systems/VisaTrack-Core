from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    case_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    milestone_type: Mapped[Optional[str]] = mapped_column(String(100))
    planned_date: Mapped[Optional[date]] = mapped_column(Date)
    actual_date: Mapped[Optional[date]] = mapped_column(Date)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="not_started")
    completion_percentage: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    depends_on: Mapped[Optional[list[UUID]]] = mapped_column(ARRAY(PGUUID(as_uuid=True)))
    assigned_to: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    reminder_days: Mapped[Optional[list[int]]] = mapped_column(ARRAY(Integer))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    completed_by: Mapped[Optional[UUID]] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    case = relationship("Case", back_populates="milestones")
