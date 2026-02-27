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
) -> None:
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
                metadata
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
                CAST(:metadata AS jsonb)
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
            "old_values": _json_or_none(old_values),
            "new_values": _json_or_none(new_values),
            "metadata": _json_or_none(metadata),
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
