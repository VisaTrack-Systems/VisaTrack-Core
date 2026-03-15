from __future__ import annotations

import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailNotConfiguredError(Exception):
    pass


def send_invitation_email(
    to_email: str,
    recipient_name: str,
    invitation_url: str,
    organization_name: str = "VisaTrack",
) -> None:
    """Send an invitation email via Resend.

    Raises EmailNotConfiguredError if RESEND_API_KEY is not set.
    Raises resend.exceptions.ResendError on API/delivery failure.
    """
    if not settings.resend_api_key:
        raise EmailNotConfiguredError(
            "Resend is not configured. Set RESEND_API_KEY in your environment."
        )

    resend.api_key = settings.resend_api_key

    from_address = f"{settings.resend_from_name} <{settings.resend_from_email}>"

    plain = (
        f"Hi {recipient_name},\n\n"
        f"You have been invited to join {organization_name} on VisaTrack. "
        f"Click the link below to set your password and activate your account.\n\n"
        f"{invitation_url}\n\n"
        f"This link expires in 72 hours. If you did not expect this invitation, "
        f"you can safely ignore this email.\n\n"
        f"— The {organization_name} Team"
    )

    html = f"""<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; color: #111; max-width: 520px; margin: 0 auto; padding: 24px;">
  <h2 style="margin-bottom: 8px;">You have been invited to join {organization_name}</h2>
  <p>Hi {recipient_name},</p>
  <p>
    You have been invited to join <strong>{organization_name}</strong> on VisaTrack.
    Click the button below to set your password and activate your account.
  </p>
  <p style="margin: 28px 0;">
    <a href="{invitation_url}"
       style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;
              text-decoration:none;font-weight:600;display:inline-block;">
      Activate my account
    </a>
  </p>
  <p style="font-size:12px;color:#6b7280;">
    This link expires in 72 hours. If you did not expect this invitation you can
    safely ignore this email.
  </p>
  <p>
   — The {organization_name} Team
  </p>
</body>
</html>"""

    resend.Emails.send({
        "from": from_address,
        "to": [to_email],
        "subject": f"You have been invited to join {organization_name}",
        "text": plain,
        "html": html,
    })

    logger.info("Invitation email sent to %s via Resend", to_email)
