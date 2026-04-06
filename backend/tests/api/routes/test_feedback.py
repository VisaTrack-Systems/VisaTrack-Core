from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api.routes import feedback
from app.schemas.feedback import BugReportContext, BugReportScreenshot, BugReportSubmitRequest
from app.services.email import EmailNotConfiguredError
from tests.support import row


def test_submit_bug_report_sends_email_with_screenshot_attachment(monkeypatch):
    payload = BugReportSubmitRequest(
        title="Cannot submit payment",
        details="Clicking pay now does nothing and no toast appears.",
        channel="email",
        context=BugReportContext(
            path="/cases/C-2026-001",
            origin="https://visatrack.ca",
            reported_at_utc=datetime.now(timezone.utc),
            user_agent="pytest-agent",
            screenshot_captured_at=datetime.now(timezone.utc),
        ),
        screenshot=BugReportScreenshot(
            filename="visatrack-bug-123.png",
            content_type="image/png",
            base64_content="iVBORw0KGgoAAAANSUhEUgAAAAUA",
        ),
    )
    request = row(
        client=row(host="127.0.0.1"),
        headers={
            "referer": "https://visatrack.ca/cases/C-2026-001",
            "accept-language": "en-CA,en;q=0.9",
        },
    )

    fake_send = MagicMock()
    monkeypatch.setattr(feedback, "send_bug_report_email", fake_send)
    monkeypatch.setattr(feedback.settings, "bug_report_to_email", "visatrack.support@gmail.com")

    feedback.submit_bug_report(payload=payload, request=request)

    kwargs = fake_send.call_args.kwargs
    assert kwargs["to_email"] == "visatrack.support@gmail.com"
    assert kwargs["report_title"] == payload.title
    assert kwargs["report_details"] == payload.details
    assert kwargs["screenshot_filename"] == "visatrack-bug-123.png"
    assert kwargs["screenshot_content_type"] == "image/png"
    assert kwargs["screenshot_base64_content"] == "iVBORw0KGgoAAAANSUhEUgAAAAUA"
    assert kwargs["sender_ip"] == "127.0.0.1"


def test_submit_bug_report_returns_503_when_email_not_configured(monkeypatch):
    payload = BugReportSubmitRequest(
        title="Cannot open dashboard",
        details="Screen stays blank after login.",
        channel="email",
        context=BugReportContext(
            path="/",
            origin="http://localhost:3000",
            reported_at_utc=datetime.now(timezone.utc),
            user_agent="pytest-agent",
            screenshot_captured_at=None,
        ),
        screenshot=None,
    )
    request = row(client=row(host="127.0.0.1"), headers={})

    def _raise_not_configured(**_kwargs):
        raise EmailNotConfiguredError("Resend is not configured")

    monkeypatch.setattr(feedback, "send_bug_report_email", _raise_not_configured)

    with pytest.raises(HTTPException) as exc:
        feedback.submit_bug_report(payload=payload, request=request)

    assert exc.value.status_code == 503
    assert "Resend is not configured" in str(exc.value.detail)


def test_submit_bug_report_returns_502_on_delivery_failure(monkeypatch):
    payload = BugReportSubmitRequest(
        title="Cannot open dashboard",
        details="Screen stays blank after login.",
        channel="email",
        context=BugReportContext(
            path="/",
            origin="http://localhost:3000",
            reported_at_utc=datetime.now(timezone.utc),
            user_agent="pytest-agent",
            screenshot_captured_at=None,
        ),
        screenshot=None,
    )
    request = row(client=row(host="127.0.0.1"), headers={})

    def _raise_delivery_error(**_kwargs):
        raise RuntimeError("SMTP unavailable")

    monkeypatch.setattr(feedback, "send_bug_report_email", _raise_delivery_error)

    with pytest.raises(HTTPException) as exc:
        feedback.submit_bug_report(payload=payload, request=request)

    assert exc.value.status_code == 502
    assert "Failed to send bug report email" in str(exc.value.detail)
