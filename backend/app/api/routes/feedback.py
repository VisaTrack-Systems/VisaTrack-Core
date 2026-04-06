"""Feedback Routes: Public endpoint for submitting product bug reports."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.schemas.feedback import BugReportSubmitRequest
from app.services.email import EmailNotConfiguredError, send_bug_report_email

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/bug-report", status_code=status.HTTP_204_NO_CONTENT)
def submit_bug_report(payload: BugReportSubmitRequest, request: Request) -> None:
    client_host = request.client.host if request.client and request.client.host else None
    try:
        send_bug_report_email(
            to_email=settings.bug_report_to_email,
            report_title=payload.title,
            report_details=payload.details,
            path=payload.context.path,
            origin=payload.context.origin,
            reported_at_utc=payload.context.reported_at_utc.isoformat(),
            user_agent=payload.context.user_agent,
            screenshot_captured_at=(
                payload.context.screenshot_captured_at.isoformat()
                if payload.context.screenshot_captured_at
                else None
            ),
            screenshot_filename=payload.screenshot.filename if payload.screenshot else None,
            screenshot_content_type=payload.screenshot.content_type if payload.screenshot else None,
            screenshot_base64_content=payload.screenshot.base64_content if payload.screenshot else None,
            delivery_channel=payload.channel,
            sender_ip=client_host,
            referrer=request.headers.get("referer"),
            browser_language=request.headers.get("accept-language"),
        )
    except EmailNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to send bug report email: {exc}") from exc
