from __future__ import annotations

import html as html_lib
import logging

import resend

from app.core.config import settings

logger = logging.getLogger(__name__)

# The default invitation email body. Supports three placeholders:
#   {recipient_name}, {organization_name}, {invitation_url}
DEFAULT_INVITATION_TEMPLATE = (
    "Hi {recipient_name},\n\n"
    "You have been invited to join {organization_name} on VisaTrack. "
    "Click the link below to set your password and activate your account.\n\n"
    "{invitation_url}\n\n"
    "This link expires in 72 hours. If you did not expect this invitation, "
    "you can safely ignore this email.\n\n"
    "— The {organization_name} Team"
)


class EmailNotConfiguredError(Exception):
    pass


def _darken_hex(hex_color: str, factor: float = 0.8) -> str:
    """Return a slightly darker shade of a hex color for gradient use."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    try:
        r = int(int(hex_color[0:2], 16) * factor)
        g = int(int(hex_color[2:4], 16) * factor)
        b = int(int(hex_color[4:6], 16) * factor)
        return f"#{r:02x}{g:02x}{b:02x}"
    except (ValueError, IndexError):
        return f"#{hex_color}"


def send_invitation_email(
    to_email: str,
    recipient_name: str,
    invitation_url: str,
    organization_name: str = "VisaTrack",
    body_template: str | None = None,
    button_color: str = "#dc2626",
    button_label: str = "Activate my account",
    subject_template: str | None = None,
    bold_org_name: bool = True,
) -> None:
    """Send an invitation email via Resend.

    If body_template is provided it replaces the default message body.
    Supports {recipient_name}, {organization_name}, and {invitation_url} placeholders.

    Style parameters (button_color, button_label, subject_template, bold_org_name)
    apply to both custom and default templates.

    Raises EmailNotConfiguredError if RESEND_API_KEY is not set.
    Raises resend.exceptions.ResendError on API/delivery failure.
    """
    if not settings.resend_api_key:
        raise EmailNotConfiguredError(
            "Resend is not configured. Set RESEND_API_KEY in your environment."
        )

    resend.api_key = settings.resend_api_key

    from_address = f"{settings.resend_from_name} <{settings.resend_from_email}>"

    template = body_template if body_template else DEFAULT_INVITATION_TEMPLATE

    # Plain text version — explicit replacements to avoid KeyError on stray braces.
    plain = (
        template
        .replace("{recipient_name}", recipient_name)
        .replace("{organization_name}", organization_name)
        .replace("{invitation_url}", invitation_url)
    )

    # Resolved subject line.
    subject = (
        subject_template or "You have been invited to join {organization_name}"
    ).replace("{organization_name}", organization_name)

    # Pre-escape values shared across both HTML paths.
    darker = _darken_hex(button_color)
    escaped_url = html_lib.escape(invitation_url)
    escaped_org = html_lib.escape(organization_name)
    escaped_recipient = html_lib.escape(recipient_name)
    escaped_label = html_lib.escape(button_label)
    org_display = f"<strong>{escaped_org}</strong>" if bold_org_name else escaped_org

    # CTA button — inline-block anchor, widely supported.
    button_html = (
        f'<p style="margin:24px 0;text-align:center;">'
        f'<a href="{escaped_url}"'
        f' style="background:{button_color};color:#ffffff;padding:12px 28px;'
        f'border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">'
        f'{escaped_label}</a>'
        f'</p>'
    )

    # Banner — a full-width table row so the gradient stretches edge-to-edge inside the card.
    banner_html = (
        f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
        f'<tr><td style="background:linear-gradient(135deg,{button_color},{darker});'
        f'padding:24px 28px;">'
        f'<span style="color:#ffffff;font-size:20px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">'
        f'{escaped_org}</span>'
        f'</td></tr></table>'
    )

    if body_template:
        # Custom plain-text template: escape each segment around {invitation_url},
        # substituting variables, then join with the button.
        def escape_part(text: str) -> str:
            # Escape HTML-special characters first, then replace our placeholders.
            out = html_lib.escape(text)
            out = out.replace("{recipient_name}", escaped_recipient)
            out = out.replace("{organization_name}", org_display)
            return out.replace("\n", "<br>")

        parts = body_template.split("{invitation_url}")
        body_content = button_html.join(escape_part(p) for p in parts)

        body_html = f'<p style="color:#374151;line-height:1.65;margin:0;">{body_content}</p>'

    else:
        body_html = f"""
      <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">Hello, {escaped_recipient}!</h2>
      <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
        You have been invited to join {org_display} on VisaTrack.
        Click the button below to set your password and activate your account.
      </p>
      {button_html}
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px;line-height:1.6;">
        This link expires in 72 hours. If you did not expect this invitation,
        you can safely ignore this email.
      </p>
      <p style="margin:20px 0 4px;color:#374151;">Best regards,</p>
      <p style="margin:0;color:#111827;font-weight:600;">The {escaped_org} Team</p>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
    {banner_html}
    <div style="padding:28px 28px 32px;">
      {body_html}
    </div>
  </div>
</body>
</html>"""

    resend.Emails.send({
        "from": from_address,
        "to": [to_email],
        "subject": subject,
        "text": plain,
        "html": html,
        "click_tracking": False,
    })

    logger.info("Invitation email sent to %s via Resend", to_email)
