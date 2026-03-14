from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.api.routes import lawyer
from app.schemas.lawyer import (
    InviteClientRequest,
    LawyerCaseCreateRequest,
    LawyerClientCreateRequest,
    LawyerProfileUpsertRequest,
)
from tests.support import FakeResult, row


def test_lawyer_helpers_normalize_and_increment_case_numbers():
    db = MagicMock()
    db.execute.return_value = FakeResult(scalar_value=7)

    assert lawyer._normalize_email(' USER@EXAMPLE.COM ') == 'user@example.com'
    assert lawyer._case_number_next(db, uuid4()).endswith('008')


def test_get_lawyer_profile_returns_empty_state_without_profile(make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    db = MagicMock()
    db.scalar.return_value = None

    result = lawyer.get_lawyer_profile(auth=auth, db=db)

    assert result.onboarding_complete is False
    assert result.specialties == []


def test_list_lawyer_clients_formats_names(make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    user = row(
        id=uuid4(),
        email='client@example.com',
        first_name='Client',
        last_name='One',
        status='active',
        organization_id=auth.organization_id,
        created_at=datetime.now(timezone.utc),
    )
    db = MagicMock()
    db.scalars.return_value.all.return_value = [user]

    result = lawyer.list_lawyer_clients(search=None, limit=50, offset=0, auth=auth, db=db)

    assert result[0].full_name == 'Client One'


def test_create_lawyer_client_creates_invited_client(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    db = MagicMock()
    db.scalar.return_value = None

    created_objects = []

    def capture_add(obj):
        created_objects.append(obj)

    def flush_side_effect():
        for obj in created_objects:
            if getattr(obj, 'id', None) is None:
                obj.id = uuid4()

    db.add.side_effect = capture_add
    db.flush.side_effect = flush_side_effect
    monkeypatch.setattr(lawyer, 'hash_password', lambda value: f'hashed:{value}')
    monkeypatch.setattr(lawyer, 'generate_invitation_token', lambda: 'invite-token')
    monkeypatch.setattr(lawyer, 'hash_invitation_token', lambda token: f'hash:{token}')
    monkeypatch.setattr(lawyer, 'assign_role_to_user', lambda *args, **kwargs: None)
    monkeypatch.setattr(lawyer, 'log_activity', lambda *args, **kwargs: None)

    result = lawyer.create_lawyer_client(
        payload=LawyerClientCreateRequest(
            email='client@example.com',
            first_name='Client',
            last_name='One',
            send_invite=True,
        ),
        auth=auth,
        db=db,
    )

    assert result.status == 'invited'
    assert 'invite?token=invite-token' in result.invitation_url
    db.commit.assert_called_once()


def test_upsert_lawyer_profile_returns_completed_profile(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    db = MagicMock()
    db.scalar.return_value = None
    monkeypatch.setattr(lawyer, 'log_activity', lambda *args, **kwargs: None)

    result = lawyer.upsert_lawyer_profile(
        payload=LawyerProfileUpsertRequest(
            bar_number='BAR-123',
            specialties=['Express Entry', '  '],
            years_experience=5,
            bio='Immigration lawyer',
            hourly_rate=250.0,
        ),
        auth=auth,
        db=db,
    )

    assert result.onboarding_complete is True
    assert result.specialties == ['Express Entry']
    db.commit.assert_called_once()


def test_list_lawyer_cases_returns_case_rows(make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        case_number='C-2026-001',
        case_type='Express Entry',
        status='intake',
        priority='medium',
        primary_lawyer_id=auth.user_id,
        target_filing_date=None,
        created_at=datetime.now(timezone.utc),
    )
    db = MagicMock()
    db.execute.return_value.all.return_value = [(case, 'Client', 'One')]

    result = lawyer.list_lawyer_cases(limit=50, offset=0, auth=auth, db=db)

    assert result[0].case_number == 'C-2026-001'
    assert result[0].client_name == 'Client One'


def test_create_lawyer_case_creates_case_and_primary_case_client(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    client_user = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        first_name='Client',
        last_name='One',
    )
    db = MagicMock()
    db.scalar.return_value = client_user

    created_objects = []

    def capture_add(obj):
        created_objects.append(obj)

    def flush_side_effect():
        for obj in created_objects:
            if getattr(obj, 'id', None) is None:
                obj.id = uuid4()
            if getattr(obj, 'created_at', None) is None:
                obj.created_at = datetime.now(timezone.utc)

    db.add.side_effect = capture_add
    db.flush.side_effect = flush_side_effect
    db.refresh.side_effect = lambda obj: None
    monkeypatch.setattr(lawyer, '_case_number_next', lambda db, organization_id: 'C-2026-009')
    monkeypatch.setattr(lawyer, 'log_activity', lambda *args, **kwargs: None)

    result = lawyer.create_lawyer_case(
        payload=LawyerCaseCreateRequest(
            client_user_id=client_user.id,
            case_type='Express Entry',
            priority='medium',
            description='New matter',
        ),
        auth=auth,
        db=db,
    )

    assert result.case_number == 'C-2026-009'
    assert result.primary_lawyer_name == f'{auth.user.first_name} {auth.user.last_name}'


def test_invite_client_to_case_returns_invitation(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(
        id=uuid4(),
        case_number='C-2026-001',
        organization_id=auth.organization_id,
        primary_lawyer_id=auth.user_id,
        created_by=auth.user_id,
    )
    invited_user = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        email='client@example.com',
        first_name='Client',
        last_name='One',
        status='invited',
    )
    db = MagicMock()
    db.scalar.side_effect = [case, invited_user, None]
    monkeypatch.setattr(lawyer, 'assign_role_to_user', lambda *args, **kwargs: None)
    monkeypatch.setattr(lawyer, 'generate_invitation_token', lambda: 'invite-token')
    monkeypatch.setattr(lawyer, 'hash_invitation_token', lambda token: f'hash:{token}')
    monkeypatch.setattr(lawyer, 'log_activity', lambda *args, **kwargs: None)

    result = lawyer.invite_client_to_case(
        case_number='C-2026-001',
        payload=InviteClientRequest(
            email='client@example.com',
            first_name='Client',
            last_name='One',
            relationship_type='related',
        ),
        auth=auth,
        db=db,
    )

    assert result.case_number == 'C-2026-001'
    assert result.client_email == 'client@example.com'
    assert result.invitation_url.endswith('invite?token=invite-token')
