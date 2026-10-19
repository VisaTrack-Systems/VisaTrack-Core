"""Private case flags belonging to an individual lawyer."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserCaseFlag(Base):
    __tablename__ = "user_case_flags"
    __table_args__ = (Index("idx_user_case_flags_case", "case_id"),)

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    case_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
