from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ClientCaseListItem(BaseModel):
    id: UUID
    case_number: str
    case_type: str
    status: str
    priority: str
    primary_lawyer_name: Optional[str]
    target_filing_date: Optional[date]
    created_at: datetime
