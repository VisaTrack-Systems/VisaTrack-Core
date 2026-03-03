from __future__ import annotations

import copy
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

# Keys whose values must not be stored in activity_log (PII / immigration-sensitive).
# Logs never store raw identifiers like UCI/application numbers unless explicitly allowed.
# Values are replaced with [REDACTED]; key names are kept for audit (which fields changed).
SENSITIVE_KEYS = frozenset({
    "date_of_birth", "dob", "birth_date",
    "uci", "sin", "social_insurance_number",
    "passport_number", "passport_no",
    "application_number", "file_number", "application_id", "file_id",
    "address", "street", "street_address", "city", "postal_code", "zip_code",
    "province", "state", "country",
    "phone", "phone_number", "mobile",
    "email",
    "password", "password_hash", "mfa_secret",
})

REDACTED_PLACEHOLDER = "[REDACTED]"


def _is_sensitive_key(key: str) -> bool:
    if not key or not isinstance(key, str):
        return False
    return key.strip().lower() in SENSITIVE_KEYS


def _redact_sensitive(obj: Any) -> Any:
    """Return a copy of obj with values for sensitive keys replaced by REDACTED_PLACEHOLDER."""
    if obj is None:
        return None
    if isinstance(obj, dict):
        return {
            k: REDACTED_PLACEHOLDER if _is_sensitive_key(k) else _redact_sensitive(v)
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [_redact_sensitive(item) for item in obj]
    return obj


# Sensitivity levels for activity_log (SOC 2: avoid storing raw identifiers unless allowed).
SENSITIVITY_LOW = "low"       # No PII; safe to retain in full.
SENSITIVITY_HIGH = "high"     # May contain identifiers; redaction applied, structured fields preferred.
SENSITIVITY_RESTRICTED = "restricted"  # Never store raw UCI/application numbers etc.; redact all.


def _changed_fields_from_values(
    old_values: Optional[dict[str, Any]],
    new_values: Optional[dict[str, Any]],
) -> Optional[list[str]]:
    """Derive sorted list of changed field names from old/new dicts."""
    if old_values is None and new_values is None:
        return None
    keys = set()
    if old_values:
        keys.update(old_values)
    if new_values:
        keys.update(new_values)
    return sorted(keys) if keys else None


def log_activity(
    db: Session,
    *,
    organization_id: Optional[UUID],
    user_id: Optional[UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[UUID],
    case_id: Optional[UUID] = None,
    client_id: Optional[UUID] = None,
    old_values: Optional[dict[str, Any]] = None,
    new_values: Optional[dict[str, Any]] = None,
    metadata: Optional[dict[str, Any]] = None,
    changed_fields: Optional[list[str]] = None,
    sensitivity_level: Optional[str] = None,
) -> None:
    # Redact PII/sensitive values so activity_log does not persist DOB, UCI, addresses, etc.
    safe_old = _redact_sensitive(copy.deepcopy(old_values)) if old_values else None
    safe_new = _redact_sensitive(copy.deepcopy(new_values)) if new_values else None
    safe_metadata = _redact_sensitive(copy.deepcopy(metadata)) if metadata else None
    fields_list = changed_fields if changed_fields is not None else _changed_fields_from_values(
        old_values, new_values
    )

    db.execute(
        text(
            """
            INSERT INTO activity_log (
                organization_id,
                user_id,
                user_type,
                action,
                entity_type,
                entity_id,
                case_id,
                client_id,
                old_values,
                new_values,
                metadata,
                changed_fields,
                sensitivity_level
            ) VALUES (
                :organization_id,
                :user_id,
                :user_type,
                :action,
                :entity_type,
                :entity_id,
                :case_id,
                :client_id,
                CAST(:old_values AS jsonb),
                CAST(:new_values AS jsonb),
                CAST(:metadata AS jsonb),
                CAST(:changed_fields AS text[]),
                :sensitivity_level
            )
            """
        ),
        {
            "organization_id": str(organization_id) if organization_id else None,
            "user_id": str(user_id) if user_id else None,
            "user_type": "user" if user_id else "system",
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "case_id": str(case_id) if case_id else None,
            "client_id": str(client_id) if client_id else None,
            "old_values": _json_or_none(safe_old),
            "new_values": _json_or_none(safe_new),
            "metadata": _json_or_none(safe_metadata),
            "changed_fields": _array_to_pg(fields_list),
            "sensitivity_level": sensitivity_level,
        },
    )


def log_document_access(
    db: Session,
    *,
    organization_id: UUID,
    document_id: UUID,
    user_id: Optional[UUID],
    action: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO document_access_log (
                organization_id,
                document_id,
                user_id,
                action,
                ip_address,
                user_agent
            ) VALUES (
                :organization_id,
                :document_id,
                :user_id,
                :action,
                CAST(:ip_address AS inet),
                :user_agent
            )
            """
        ),
        {
            "organization_id": str(organization_id),
            "document_id": str(document_id),
            "user_id": str(user_id) if user_id else None,
            "action": action,
            "ip_address": ip_address,
            "user_agent": user_agent,
        },
    )


def _json_or_none(value: Optional[dict[str, Any]]) -> Optional[str]:
    if value is None:
        return None

    import json

    return json.dumps(value)


def _array_to_pg(arr: Optional[list[str]]) -> Optional[str]:
    """Format list of strings for PostgreSQL text[] literal (for CAST(:param AS text[]))."""
    if not arr:
        return None
    escaped = [str(s).replace("\\", "\\\\").replace('"', '\\"') for s in arr]
    return "{" + ",".join(f'"{e}"' for e in escaped) + "}"
