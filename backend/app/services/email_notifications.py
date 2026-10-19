"""Email Notifications Service: organization and lawyer settings for case notification
emails, upload validation for templates and banners, and the send gate used by case routes.

Settings live in existing JSONB columns, so no migration is needed:
  Organization.settings["email_templates"][<key>]  custom body (same place as "invitation")
  Organization.settings["email_templates"]["subjects"][<key>]  custom subject line
  Organization.settings["support_email"]           support address for the {organization_support_email} variable
  Organization.settings["email_notifications"]     {"enabled": {<key>: bool}, "banner_position": "top",
                                                    "invitation_enabled": bool}
  UserProfile.custom_fields["communication"]       {"enabled_templates": {<key>: bool}, "banner": {...}}

An email is sent only when the admin has the type enabled for the organization AND the
case's lawyer has it enabled AND the client has not unsubscribed.
"""
from __future__ import annotations

import base64
import binascii
import io
import logging
from typing import Any
from uuid import UUID

from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.organization import Organization
from app.models.user import User
from app.models.user_profile import UserProfile
from app.services.email import (
    BANNER_POSITIONS,
    DEFAULT_BANNER_POSITION,
    DEFAULT_NOTIFICATION_TEMPLATES,
    portal_url,
    send_notification_email,
)
from app.services.storage import get_object_bytes

logger = logging.getLogger(__name__)

NOTIFICATION_KEYS = tuple(DEFAULT_NOTIFICATION_TEMPLATES.keys())

# Matches the max length of a saved template body (see the template request schemas).
MAX_TEMPLATE_BODY_CHARS = 5000
MAX_TEMPLATE_FILE_BYTES = 2 * 1024 * 1024
ALLOWED_TEMPLATE_EXTENSIONS = (".txt", ".pdf")

MAX_BANNER_BYTES = 1024 * 1024
# Extension -> content type for banner images.
ALLOWED_BANNER_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}

# Which of the client's own email preferences (cleared by the unsubscribe link) applies to each type.
_CLIENT_PREF_FOR_KEY = {
    "case_status_update": "email_case_updates",
    "document_request": "email_documents",
    "reminder": "email_case_updates",
}


class UploadValidationError(ValueError):
    """Raised when an uploaded template or banner file is rejected. The message is user-facing."""


# ── Settings readers ─────────────────────────────────────────────────────────


def _as_dict(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def org_notification_settings(org_settings: Any) -> dict[str, Any]:
    """Return {"enabled": {key: bool}, "banner_position": str, "invitation_enabled": bool}
    with defaults filled in."""
    stored = _as_dict(_as_dict(org_settings).get("email_notifications"))
    stored_enabled = _as_dict(stored.get("enabled"))
    position = stored.get("banner_position")
    return {
        "enabled": {key: bool(stored_enabled.get(key, True)) for key in NOTIFICATION_KEYS},
        "banner_position": position if position in BANNER_POSITIONS else DEFAULT_BANNER_POSITION,
        # Invitations are not a case notification, so lawyers cannot opt out of them; only the admin toggle applies.
        "invitation_enabled": bool(stored.get("invitation_enabled", True)),
    }


def org_template_body(org_settings: Any, key: str) -> str | None:
    """Return the organization's custom body for a notification type, or None if it uses the default."""
    body = _as_dict(_as_dict(org_settings).get("email_templates")).get(key)
    return body if isinstance(body, str) and body.strip() else None


def org_template_subject(org_settings: Any, key: str) -> str | None:
    """Return the organization's custom subject line for a notification type, or None for the default."""
    subjects = _as_dict(_as_dict(_as_dict(org_settings).get("email_templates")).get("subjects"))
    subject = subjects.get(key)
    return subject if isinstance(subject, str) and subject.strip() else None


def org_support_email(org_settings: Any) -> str:
    """The organization's support email, or "" if none is set (callers fall back to the main contact email)."""
    value = _as_dict(org_settings).get("support_email")
    return value if isinstance(value, str) else ""


def org_license_number(org_settings: Any) -> str:
    """The firm's RCIC / Law Society license number for {license_number}, or "" if none is set."""
    value = _as_dict(org_settings).get("license_number")
    return value if isinstance(value, str) else ""


def lawyer_communication_settings(custom_fields: Any) -> dict[str, Any]:
    """Return {"enabled_templates": {key: bool}, "banner": dict | None} with defaults filled in."""
    stored = _as_dict(_as_dict(custom_fields).get("communication"))
    stored_enabled = _as_dict(stored.get("enabled_templates"))
    banner = stored.get("banner")
    return {
        "enabled_templates": {key: bool(stored_enabled.get(key, True)) for key in NOTIFICATION_KEYS},
        "banner": banner if isinstance(banner, dict) and banner.get("object_key") else None,
    }


def unknown_notification_keys(keys: Any) -> list[str]:
    return sorted(key for key in keys if key not in NOTIFICATION_KEYS)


def is_notification_enabled(*, org_enabled: dict[str, bool], lawyer_enabled: dict[str, bool], key: str) -> bool:
    """Admin settings override lawyers: both must be on for the email to go out."""
    return bool(org_enabled.get(key)) and bool(lawyer_enabled.get(key))


# ── Upload validation ────────────────────────────────────────────────────────


def decode_upload(content_base64: str) -> bytes:
    """Decode a base64 file upload sent in a JSON body."""
    try:
        return base64.b64decode(content_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise UploadValidationError("The uploaded file could not be read.") from exc


def _extension(file_name: str) -> str:
    dot = file_name.rfind(".")
    return file_name[dot:].lower() if dot != -1 else ""


def extract_template_text(file_name: str, data: bytes) -> str:
    """Read the text of an uploaded .txt or .pdf file so it can be used as a template body.

    Placeholders such as {status} are kept as written in the file.
    """
    extension = _extension(file_name)
    if extension not in ALLOWED_TEMPLATE_EXTENSIONS:
        raise UploadValidationError("Only .txt and .pdf files can be used as email templates.")
    if not data:
        raise UploadValidationError("The uploaded file is empty.")
    if len(data) > MAX_TEMPLATE_FILE_BYTES:
        raise UploadValidationError("Template files must be 2 MB or smaller.")

    if extension == ".txt":
        try:
            # utf-8-sig also strips the byte-order mark some editors add.
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise UploadValidationError("Text files must be saved with UTF-8 encoding.") from exc
    else:
        try:
            reader = PdfReader(io.BytesIO(data))
            is_encrypted = reader.is_encrypted
            text = "" if is_encrypted else "\n\n".join(
                (page.extract_text() or "").strip() for page in reader.pages
            )
        except (PdfReadError, ValueError, KeyError, TypeError) as exc:
            raise UploadValidationError("The PDF could not be read. It may be damaged.") from exc
        if is_encrypted:
            raise UploadValidationError("Password-protected PDFs are not supported.")

    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        raise UploadValidationError(
            "No text was found in the file. Scanned PDFs (images of text) are not supported."
        )
    if len(text) > MAX_TEMPLATE_BODY_CHARS:
        raise UploadValidationError(
            f"The extracted text is {len(text)} characters; templates are limited to {MAX_TEMPLATE_BODY_CHARS}."
        )
    return text


def _looks_like_image(data: bytes, content_type: str) -> bool:
    if content_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if content_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


def validate_banner_image(file_name: str, data: bytes) -> str:
    """Check an uploaded banner image and return its content type."""
    content_type = ALLOWED_BANNER_TYPES.get(_extension(file_name))
    if content_type is None:
        raise UploadValidationError("Banner images must be .png, .jpg, .jpeg, or .webp files.")
    if not data:
        raise UploadValidationError("The uploaded file is empty.")
    if len(data) > MAX_BANNER_BYTES:
        raise UploadValidationError("Banner images must be 1 MB or smaller.")
    # Check the file's actual bytes, not just its name, so a renamed file is rejected.
    if not _looks_like_image(data, content_type):
        raise UploadValidationError("The file content does not match its image type.")
    return content_type


def banner_object_key(*, organization_id: UUID, user_id: UUID, file_name: str) -> str:
    return f"organizations/{organization_id}/users/{user_id}/email-banner{_extension(file_name)}"


# ── Sending ──────────────────────────────────────────────────────────────────


def case_status_label(status: str) -> str:
    """Readable status for client emails, e.g. "awaiting_client" -> "Awaiting Client"."""
    return status.replace("_", " ").title()


def mask_case_number(case_number: str) -> str:
    """Hide all but the last 4 characters, e.g. "C-2026-00123" -> "***0123".

    Used for {redacted_case_number} so a case can be referenced in a subject line,
    which mail servers and lock screens show without signing in.
    """
    if len(case_number) <= 4:
        return "*" * len(case_number)
    return "***" + case_number[-4:]


def document_list_text(document_names: list[str]) -> str:
    """The {document_name} value: the name itself, or one "- name" line per document."""
    if len(document_names) == 1:
        return document_names[0]
    return "\n".join(f"- {name}" for name in document_names)


def notify_case_client(
    db: Session,
    *,
    case: Any,
    template_key: str,
    values: dict[str, str],
    fallback_lawyer_id: UUID | None = None,
) -> bool:
    """Email the case's client using the organization's template, if every setting allows it.

    The lawyer whose settings and banner apply is the case's primary lawyer, or
    fallback_lawyer_id (usually the acting user) when the case has none.

    Returns True if an email was sent. Never raises: a failed notification must not
    undo or fail the case change that triggered it, so errors are logged instead.
    """
    if not settings.resend_api_key:
        return False

    try:
        org = db.scalar(select(Organization).where(Organization.id == case.organization_id))
        org_settings = org.settings if org is not None else {}
        org_config = org_notification_settings(org_settings)

        lawyer_id = getattr(case, "primary_lawyer_id", None) or fallback_lawyer_id
        lawyer = db.scalar(select(User).where(User.id == lawyer_id)) if lawyer_id else None
        lawyer_profile = (
            db.scalar(select(UserProfile).where(UserProfile.user_id == lawyer_id)) if lawyer_id else None
        )
        lawyer_config = lawyer_communication_settings(
            lawyer_profile.custom_fields if lawyer_profile is not None else {}
        )

        if not is_notification_enabled(
            org_enabled=org_config["enabled"],
            lawyer_enabled=lawyer_config["enabled_templates"],
            key=template_key,
        ):
            return False

        client = db.scalar(select(User).where(User.id == case.client_id, User.deleted_at.is_(None)))
        if client is None or not client.email:
            return False
        client_profile = db.scalar(select(UserProfile).where(UserProfile.user_id == client.id))
        client_prefs = _as_dict(client_profile.notification_prefs if client_profile is not None else {})
        if client_prefs.get(_CLIENT_PREF_FOR_KEY[template_key]) is False:
            return False

        lawyer_name = f"{lawyer.first_name} {lawyer.last_name}".strip() if lawyer is not None else ""
        main_email = (getattr(org, "contact_email", None) or "") if org is not None else ""
        client_name = f"{client.first_name} {client.last_name}".strip()
        all_values = {
            "client_name": client_name,
            "client_given_name": (client.first_name or "").strip() or client_name,
            "organization_name": org.name if org is not None else "VisaTrack",
            "case_number": case.case_number,
            "redacted_case_number": mask_case_number(case.case_number or ""),
            "case_status": case_status_label(case.status or ""),
            "lawyer_name": lawyer_name or "Your legal team",
            "lawyer_phone_number": (getattr(lawyer, "phone", None) or "") if lawyer is not None else "",
            "organization_phone_number": (getattr(org, "contact_phone", None) or "") if org is not None else "",
            "organization_main_email": main_email,
            "organization_support_email": org_support_email(org_settings) or main_email,
            "license_number": org_license_number(org_settings),
            "portal_url": portal_url(),
            "document_name": "",
            **values,
        }
        # Names used by templates saved before {client_name} and {case_status} existed.
        all_values["recipient_name"] = all_values["client_name"]
        all_values["status"] = all_values["case_status"]
        all_values["case_number_masked"] = all_values["redacted_case_number"]

        banner_bytes = None
        banner = lawyer_config["banner"]
        if banner is not None:
            try:
                banner_bytes = get_object_bytes(object_key=banner["object_key"])
            except Exception:  # noqa: BLE001 - send the email without the banner rather than not at all
                logger.warning("Could not load email banner for lawyer %s", lawyer_id, exc_info=True)

        default = DEFAULT_NOTIFICATION_TEMPLATES[template_key]
        custom_body = org_template_body(org_settings, template_key)
        send_notification_email(
            to_email=str(client.email),
            subject_template=org_template_subject(org_settings, template_key) or default["subject"],
            body_template=custom_body or default["body"],
            values=all_values,
            banner_bytes=banner_bytes,
            banner_content_type=banner.get("content_type") if banner else None,
            banner_position=org_config["banner_position"],
            # An uploaded/custom template replaces the whole email, not just the text inside the layout.
            use_default_layout=custom_body is None,
        )
        return True
    except Exception:  # noqa: BLE001 - see docstring
        logger.exception("Failed to send '%s' notification for case %s", template_key, getattr(case, "id", None))
        return False
