"""Feedback Schemas: Request models for bug and product feedback submissions."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BugReportContext(BaseModel):
    path: str = Field(min_length=1, max_length=2048)
    origin: str | None = Field(default=None, max_length=512)
    reported_at_utc: datetime
    user_agent: str | None = Field(default=None, max_length=2048)
    screenshot_captured_at: datetime | None = None


class BugReportScreenshot(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: Literal["image/png", "image/jpeg"]
    base64_content: str = Field(min_length=8, max_length=2_000_000)


class BugReportSubmitRequest(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    details: str = Field(min_length=5, max_length=10000)
    channel: Literal["email", "github"] = "email"
    context: BugReportContext
    screenshot: BugReportScreenshot | None = None
