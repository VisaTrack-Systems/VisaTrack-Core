from __future__ import annotations

import json
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.audit import (
    REDACTED_PLACEHOLDER,
    log_activity,
    log_document_access,
)


def test_log_activity_redacts_sensitive_keys():
    """Sensitive fields (DOB, UCI, address, email, etc.) are stored as [REDACTED] in activity_log."""
    db = MagicMock()
    org_id = uuid4()
    user_id = uuid4()

    log_activity(
        db,
        organization_id=org_id,
        user_id=user_id,
        action="updated",
        entity_type="case",
        entity_id=uuid4(),
        old_values={
            "status": "intake",
            "date_of_birth": "1990-01-15",
            "uci": "1234-5678",
            "email": "client@example.com",
        },
        new_values={
            "status": "active",
            "date_of_birth": "1990-01-15",
            "uci": "1234-5678",
            "address": {"street": "123 Main St", "city": "Toronto", "postal_code": "M5V 1A1"},
        },
    )

    params = db.execute.call_args[0][1]
    old = json.loads(params["old_values"])
    new = json.loads(params["new_values"])

    assert old["status"] == "intake"
    assert old["date_of_birth"] == REDACTED_PLACEHOLDER
    assert old["uci"] == REDACTED_PLACEHOLDER
    assert old["email"] == REDACTED_PLACEHOLDER

    assert new["status"] == "active"
    assert new["date_of_birth"] == REDACTED_PLACEHOLDER
    assert new["uci"] == REDACTED_PLACEHOLDER
    assert new["address"] == REDACTED_PLACEHOLDER


def test_log_activity_executes_insert():
    db = MagicMock()
    organization_id = uuid4()
    user_id = uuid4()

    log_activity(
        db,
        organization_id=organization_id,
        user_id=user_id,
        action='created',
        entity_type='case',
        entity_id=uuid4(),
        new_values={'status': 'created'},
    )

    assert db.execute.call_count == 1
    params = db.execute.call_args[0][1]
    assert params['organization_id'] == str(organization_id)
    assert params['user_id'] == str(user_id)
    assert params['action'] == 'created'


def test_log_document_access_executes_insert():
    db = MagicMock()
    organization_id = uuid4()
    document_id = uuid4()

    log_document_access(
        db,
        organization_id=organization_id,
        document_id=document_id,
        user_id=None,
        action='download',
        ip_address='127.0.0.1',
        user_agent='pytest',
    )

    assert db.execute.call_count == 1
    params = db.execute.call_args[0][1]
    assert params['organization_id'] == str(organization_id)
    assert params['document_id'] == str(document_id)
    assert params['action'] == 'download'
    assert params['ip_address'] == '127.0.0.1'
