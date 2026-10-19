from __future__ import annotations

import base64
from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes import lawyer
from app.schemas.lawyer import (
    InviteClientRequest,
    LawyerCaseCreateRequest,
    LawyerClientCreateRequest,
    LawyerCommunicationSettingsUpdateRequest,
    LawyerEmailBannerUploadRequest,
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
    assert 'invite#token=invite-token' in result.invitation_url
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
    db.execute.return_value.all.return_value = [(case, 'Client', 'One', 'Lawyer', 'Smith', True)]

    result = lawyer.list_lawyer_cases(limit=50, offset=0, auth=auth, db=db)

    assert result[0].case_number == 'C-2026-001'
    assert result[0].client_name == 'Client One'
    assert result[0].is_flagged is True


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
    assert result.invitation_url.endswith('invite#token=invite-token')


def test_update_communication_settings_saves_opt_ins(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    profile = row(custom_fields={'other': 1}, updated_at=None)
    organization = row(settings={'email_notifications': {'enabled': {'reminder': False}}})
    db = MagicMock()
    # Profile lookup for the update, then organization + profile for the response.
    db.scalar.side_effect = [profile, organization, profile]
    monkeypatch.setattr(lawyer, 'log_activity', lambda *args, **kwargs: None)

    result = lawyer.update_communication_settings(
        payload=LawyerCommunicationSettingsUpdateRequest(enabled_templates={'case_status_update': False}),
        auth=auth,
        db=db,
    )

    assert profile.custom_fields['other'] == 1
    assert profile.custom_fields['communication']['enabled_templates'] == {
        'case_status_update': False,
        'document_request': True,
        'reminder': True,
    }
    by_key = {item.key: item for item in result.templates}
    assert by_key['case_status_update'].enabled is False
    # The admin turned reminders off; the lawyer's own choice is still reported separately.
    assert by_key['reminder'].org_enabled is False
    assert by_key['reminder'].enabled is True
    db.commit.assert_called_once()


def test_update_communication_settings_rejects_unknown_template(make_auth_context):
    with pytest.raises(HTTPException) as exc:
        lawyer.update_communication_settings(
            payload=LawyerCommunicationSettingsUpdateRequest(enabled_templates={'invoice': True}),
            auth=make_auth_context(roles=['lawyer']),
            db=MagicMock(),
        )

    assert exc.value.status_code == 400


def test_upload_email_banner_stores_image_and_reference(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    profile = row(custom_fields={}, updated_at=None)
    db = MagicMock()
    db.scalar.side_effect = [profile, row(settings={}), profile]
    stored = {}
    monkeypatch.setattr(lawyer, 'put_object_bytes', lambda **kwargs: stored.update(kwargs))
    monkeypatch.setattr(lawyer, 'create_presigned_download', lambda **kwargs: 'https://storage.example/banner')
    monkeypatch.setattr(lawyer, 'log_activity', lambda *args, **kwargs: None)
    png = b'\x89PNG\r\n\x1a\n' + b'\x00' * 16

    result = lawyer.upload_email_banner(
        payload=LawyerEmailBannerUploadRequest(
            file_name='logo.png', content_base64=base64.b64encode(png).decode()
        ),
        auth=auth,
        db=db,
    )

    assert stored['payload'] == png
    assert stored['content_type'] == 'image/png'
    assert stored['object_key'].endswith(f'/users/{auth.user_id}/email-banner.png')
    assert profile.custom_fields['communication']['banner']['object_key'] == stored['object_key']
    assert result.banner.url == 'https://storage.example/banner'


def test_upload_email_banner_returns_503_when_storage_credentials_are_bad(monkeypatch, make_auth_context):
    from app.services.storage import StorageConfigurationError

    profile = row(custom_fields={}, updated_at=None)
    db = MagicMock()
    db.scalar.return_value = profile

    def reject(**kwargs):
        raise StorageConfigurationError('AWS credentials were rejected by S3')

    monkeypatch.setattr(lawyer, 'put_object_bytes', reject)
    png = b'\x89PNG\r\n\x1a\n' + b'\x00' * 16

    with pytest.raises(HTTPException) as exc:
        lawyer.upload_email_banner(
            payload=LawyerEmailBannerUploadRequest(file_name='logo.png', content_base64=base64.b64encode(png).decode()),
            auth=make_auth_context(roles=['lawyer']),
            db=db,
        )

    assert exc.value.status_code == 503
    assert 'AWS credentials' in exc.value.detail
    db.commit.assert_not_called()


def test_upload_email_banner_rejects_non_image(make_auth_context):
    with pytest.raises(HTTPException) as exc:
        lawyer.upload_email_banner(
            payload=LawyerEmailBannerUploadRequest(
                file_name='logo.png', content_base64=base64.b64encode(b'<svg/>').decode()
            ),
            auth=make_auth_context(roles=['lawyer']),
            db=MagicMock(),
        )

    assert exc.value.status_code == 400
