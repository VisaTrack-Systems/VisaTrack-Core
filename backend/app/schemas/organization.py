"""Organization Schemas: Pydantic models for organization management and tenant configuration API requests."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    contact_email: str
    subscription_status: str
    created_at: datetime
