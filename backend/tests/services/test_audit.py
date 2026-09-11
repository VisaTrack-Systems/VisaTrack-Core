from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

from app.services.audit import log_activity, log_document_access
from app.services import audit


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
    assert 'audit_outbox' in str(db.execute.call_args.args[0])


def test_log_document_access_executes_insert():
    db = MagicMock()
    document_id = uuid4()

    log_document_access(
        db,
        document_id=document_id,
        user_id=None,
        action='download',
        ip_address='127.0.0.1',
        user_agent='pytest',
    )

    assert db.execute.call_count == 1
    params = db.execute.call_args[0][1]
    assert params['document_id'] == str(document_id)
    assert params['action'] == 'download'
    assert params['ip_address'] == '127.0.0.1'


def test_audit_redaction_removes_nested_credentials():
    value = {
        'email': 'person@example.com',
        'token': 'plain-token',
        'nested': {'password': 'plain-password'},
        'items': [{'refresh_token': 'plain-refresh'}],
    }

    assert audit._redact(value) == {
        'email': 'person@example.com',
        'token': '[REDACTED]',
        'nested': {'password': '[REDACTED]'},
        'items': [{'refresh_token': '[REDACTED]'}],
    }
