"""Dashboard Schemas: Pydantic models for dashboard overview, analytics, and summary data API responses."""
from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DashboardStats(BaseModel):
    organizations: int
    users: int
    active_cases: int
    completed_cases: int


class DashboardCase(BaseModel):
    id: UUID
    case_number: str
    case_type: str
    status: str
    priority: str
    client_name: str


class DashboardMilestone(BaseModel):
    id: UUID
    case_id: UUID
    case_number: str
    name: str
    due_date: Optional[date]
    status: str


class DashboardOverview(BaseModel):
    stats: DashboardStats
    recent_cases: list[DashboardCase]
    upcoming_milestones: list[DashboardMilestone]
