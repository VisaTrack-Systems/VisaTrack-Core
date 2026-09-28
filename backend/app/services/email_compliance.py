"""Business identity and unsubscribe links appended to every outbound email."""

from __future__ import annotations

import hashlib
import hmac
from urllib.parse import quote

from app.core.config import settings

_UNSUBSCRIBE_PREFIX = "unsubscribe:"


def public_frontend_origin() -> str:
    raw = settings.frontend_origin.split(",")[0].strip().rstrip("/")
    return raw or "http://localhost:3000"


def unsubscribe_token(email: str) -> str:
    message = f"{_UNSUBSCRIBE_PREFIX}{email.strip().lower()}".encode()
    return hmac.new(
        settings.auth_secret_key.encode(),
        message,
        hashlib.sha256,
    ).hexdigest()


def verify_unsubscribe_token(email: str, token: str) -> bool:
    expected = unsubscribe_token(email)
    provided = token.strip().lower()
    if len(provided) != len(expected):
        return False
    return hmac.compare_digest(expected, provided)


def unsubscribe_url(email: str) -> str:
    origin = public_frontend_origin()
    normalized = quote(email.strip().lower())
    token = unsubscribe_token(email)
    return f"{origin}/unsubscribe?email={normalized}&token={token}"


def compliance_plain_footer(recipient_email: str) -> str:
    return (
        "\n\n---\n"
        f"{settings.business_legal_name}\n"
        f"{settings.business_address}\n"
        f"Privacy: {settings.business_contact_email}\n"
        f"Unsubscribe: {unsubscribe_url(recipient_email)}\n"
    )


def compliance_html_footer(recipient_email: str) -> str:
    import html as html_lib

    name = html_lib.escape(settings.business_legal_name)
    address = html_lib.escape(settings.business_address)
    contact = html_lib.escape(settings.business_contact_email)
    url = html_lib.escape(unsubscribe_url(recipient_email))
    return (
        '<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;'
        'color:#374151;font-size:12px;line-height:1.6;">'
        f"{name}<br>{address}<br>"
        f'<a href="mailto:{contact}" style="color:#1e3a8a;">{contact}</a><br>'
        f'<a href="{url}" style="color:#1e3a8a;">Unsubscribe</a>'
        "</p>"
    )
