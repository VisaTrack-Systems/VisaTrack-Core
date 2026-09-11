"""Audit Logging Service: Logs user activities and system events for compliance and audit trail purposes."""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


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
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    request_id: Optional[str] = None,
    result: str = "success",
) -> None:
    db.execute(
        text(
            """
            WITH inserted_event AS (
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
                ip_address,
                user_agent
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
                CAST(:ip_address AS inet),
                :user_agent
            )
            RETURNING id, organization_id, user_id, action, entity_type,
                      entity_id, case_id, client_id, created_at
            )
            INSERT INTO audit_outbox (event_id, event_type, payload)
            SELECT id, 'activity',
                   jsonb_build_object(
                       'event_id', id,
                       'organization_id', organization_id,
                       'user_id', user_id,
                       'action', action,
                       'entity_type', entity_type,
                       'entity_id', entity_id,
                       'case_id', case_id,
                       'client_id', client_id,
                       'request_id', :request_id,
                       'result', :result,
                       'created_at', created_at
                   )
            FROM inserted_event
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
            "old_values": _json_or_none(_redact(old_values)),
            "new_values": _json_or_none(_redact(new_values)),
            "metadata": _json_or_none(_redact(metadata)),
            "ip_address": ip_address,
            "user_agent": (user_agent or "")[:1000] or None,
            "request_id": (request_id or "")[:255] or None,
            "result": result[:50],
        },
    )


def log_document_access(
    db: Session,
    *,
    document_id: UUID,
    user_id: Optional[UUID],
    action: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    db.execute(
        text(
            """
            WITH inserted_event AS (
            INSERT INTO document_access_log (
                document_id,
                user_id,
                action,
                ip_address,
                user_agent
            ) VALUES (
                :document_id,
                :user_id,
                :action,
                CAST(:ip_address AS inet),
                :user_agent
            )
            RETURNING id, document_id, user_id, action, created_at
            )
            INSERT INTO audit_outbox (event_id, event_type, payload)
            SELECT id, 'document_access',
                   jsonb_build_object(
                       'event_id', id,
                       'document_id', document_id,
                       'user_id', user_id,
                       'action', action,
                       'created_at', created_at
                   )
            FROM inserted_event
            """
        ),
        {
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


_SENSITIVE_KEYS = {
    "access_token",
    "authorization",
    "cookie",
    "invitation_token",
    "password",
    "refresh_token",
    "secret",
    "token",
}


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): (
                "[REDACTED]"
                if str(key).lower() in _SENSITIVE_KEYS
                else _redact(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value
