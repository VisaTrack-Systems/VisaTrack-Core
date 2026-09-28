from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes import privacy
from app.schemas.privacy import PrivacyRequestCreate, PrivacyRequestReview, PublicDeletionRequest, UnsubscribeRequest
from app.services.email_compliance import unsubscribe_token
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


def test_public_deletion_request_does_not_reveal_unknown_accounts(monkeypatch):
    db = MagicMock()
    db.scalar.return_value = None
    monkeypatch.setattr(privacy, "log_activity", lambda *args, **kwargs: None)

    result = privacy.request_account_deletion(
        payload=PublicDeletionRequest(
            organization_slug="acme-law",
            email="missing@example.com",
            confirm_deletion=True,
        ),
        db=db,
    )

    assert result.status == "accepted"
    db.commit.assert_not_called()


def test_unsubscribe_rejects_a_bad_token():
    with pytest.raises(HTTPException) as exc:
        privacy.unsubscribe_from_emails(
            payload=UnsubscribeRequest(email="person@example.com", token="a" * 64),
            db=MagicMock(),
        )

    assert exc.value.status_code == 400


def test_unsubscribe_clears_email_preferences():
    email = "person@example.com"
    user = row(id=uuid4(), email=email)
    profile = row(
        user_id=user.id,
        notification_prefs={"email_case_updates": True, "email_documents": True},
    )
    db = MagicMock()
    db.scalars.return_value.all.return_value = [user]
    db.scalar.return_value = profile

    result = privacy.unsubscribe_from_emails(
        payload=UnsubscribeRequest(email=email, token=unsubscribe_token(email)),
        db=db,
    )

    assert result.status == "unsubscribed"
    assert profile.notification_prefs["email_case_updates"] is False
    assert profile.notification_prefs["email_documents"] is False
    assert profile.notification_prefs["email_payments"] is False
    db.commit.assert_called_once()
