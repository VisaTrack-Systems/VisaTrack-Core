"""Feedback Routes: Public endpoint for submitting product bug reports."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps.auth import AuthContext, get_auth_context
from app.core.config import settings
from app.schemas.feedback import BugReportSubmitRequest
from app.services.email import EmailNotConfiguredError, send_bug_report_email

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/bug-report", status_code=status.HTTP_204_NO_CONTENT)
def submit_bug_report(
    payload: BugReportSubmitRequest,
    _auth: AuthContext = Depends(get_auth_context),
) -> None:
    try:
        send_bug_report_email(
            to_email=settings.bug_report_to_email,
            report_title=payload.title,
            report_details=payload.details,
            path=payload.context.path,
            origin=payload.context.origin,
            reported_at_utc=payload.context.reported_at_utc.isoformat(),
            screenshot_captured_at=(
                payload.context.screenshot_captured_at.isoformat()
                if payload.context.screenshot_captured_at
                else None
            ),
            screenshot_filename=payload.screenshot.filename if payload.screenshot else None,
            screenshot_content_type=payload.screenshot.content_type if payload.screenshot else None,
            screenshot_base64_content=payload.screenshot.base64_content if payload.screenshot else None,
            delivery_channel=payload.channel,
        )
    except EmailNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail="Bug reporting is unavailable") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to send bug report") from exc
