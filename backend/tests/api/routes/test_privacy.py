from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes import privacy
from app.schemas.privacy import PrivacyRequestCreate, PrivacyRequestReview
from tests.support import row


def test_create_privacy_request_is_tenant_scoped(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=["client"])
    db = MagicMock()
    db.scalar.return_value = None
    monkeypatch.setattr(privacy, "log_activity", lambda *args, **kwargs: None)

    result = privacy.create_privacy_request(
        payload=PrivacyRequestCreate(request_type="access", details="Please export my data"),
        auth=auth,
        db=db,
    )

    assert result.request_type == "access"
    created = db.add.call_args.args[0]
    assert created.organization_id == auth.organization_id
    assert created.requested_by == auth.user_id
    db.commit.assert_called_once()


def test_duplicate_active_privacy_request_is_rejected(make_auth_context):
    db = MagicMock()
    db.scalar.return_value = object()

    with pytest.raises(HTTPException) as exc:
        privacy.create_privacy_request(
            payload=PrivacyRequestCreate(request_type="deletion"),
            auth=make_auth_context(roles=["client"]),
            db=db,
        )

    assert exc.value.status_code == 409


def test_deletion_completion_is_blocked_by_legal_hold(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=["org_admin"])
    auth.active_role = "org_admin"
    item = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        requested_by=uuid4(),
        request_type="deletion",
        status="in_review",
        details=None,
        resolution_note=None,
        assigned_to=None,
        due_at=datetime.now(timezone.utc),
        completed_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db = MagicMock()
    db.scalar.side_effect = [item, 1]
    monkeypatch.setattr(privacy, "log_activity", lambda *args, **kwargs: None)

    with pytest.raises(HTTPException) as exc:
        privacy.review_privacy_request(
            request_id=item.id,
            payload=PrivacyRequestReview(
                status="completed",
                resolution_note="Approved after review",
            ),
            auth=auth,
            db=db,
        )

    assert exc.value.status_code == 409
    db.commit.assert_not_called()
