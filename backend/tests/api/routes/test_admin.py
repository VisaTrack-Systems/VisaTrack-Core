from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes import admin
from app.schemas.admin import (
    AdminAssignRoleRequest,
    AdminCaseAssignmentRequest,
    AdminCreateOrganizationRequest,
    AdminCreateUserRequest,
    SendInvitationEmailRequest,
)
from tests.support import FakeResult, row


def test_admin_helpers_normalize_and_scope(make_auth_context):
    auth = make_auth_context(roles=['org_admin'])

    assert admin._slugify('Acme Law LLP') == 'acme-law-llp'
    assert admin._normalize_email(' USER@EXAMPLE.COM ') == 'user@example.com'

    with pytest.raises(HTTPException):
        admin._require_org_scope(auth, uuid4())


def test_get_admin_overview_returns_expected_payload(make_auth_context):
    auth = make_auth_context(roles=['org_admin'])
    now = datetime.now(timezone.utc)
    db = MagicMock()
    db.scalar.side_effect = [1, 2, 1, 3, 1]
    db.execute.side_effect = [
        FakeResult([row(id=uuid4(), name='Acme', slug='acme', contact_email='hello@acme.com', subscription_status='active', created_at=now)]),
        FakeResult([row(id=uuid4(), organization_id=auth.organization_id, email='user@example.com', first_name='User', last_name='One', status='active', created_at=now)]),
        FakeResult([row(id=uuid4(), case_number='C-1', case_type='Express Entry', status='intake', priority='medium', created_at=now, first_name='Client', last_name='One')]),
    ]

    result = admin.get_admin_overview(auth=auth, db=db)

    assert result.stats.active_cases == 3
    assert result.recent_cases[0].client_name == 'Client One'


def test_create_organization_rejects_duplicate_slug(make_auth_context):
    auth = make_auth_context(roles=['super_admin'], permissions={'*'})
    db = MagicMock()
    db.scalar.return_value = uuid4()
    payload = AdminCreateOrganizationRequest(
        name='Acme',
        contact_email='hello@acme.com',
        slug='acme',
        subscription_tier='basic',
        subscription_status='active',
    )

    with pytest.raises(HTTPException) as exc:
        admin.create_organization(payload=payload, auth=auth, db=db)

    assert exc.value.status_code == 409


def test_create_organization_requires_active_super_admin(make_auth_context):
    auth = make_auth_context(roles=['super_admin', 'org_admin'], permissions={'*'})
    auth.active_role = 'org_admin'
    db = MagicMock()
    payload = AdminCreateOrganizationRequest(
        name='Acme',
        contact_email='hello@acme.com',
        slug='acme',
        subscription_tier='basic',
        subscription_status='active',
    )

    with pytest.raises(HTTPException) as exc:
        admin.create_organization(payload=payload, auth=auth, db=db)

    assert exc.value.status_code == 403


def test_list_admin_organizations_returns_scoped_rows(make_auth_context):
    auth = make_auth_context(roles=['org_admin'], permissions={'settings:view'})
    now = datetime.now(timezone.utc)
    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        row(
            id=auth.organization_id,
            name='Acme Law',
            slug='acme-law',
            contact_email='hello@acme.com',
            subscription_tier='basic',
            subscription_status='active',
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )
    ]

    result = admin.list_admin_organizations(limit=25, offset=0, auth=auth, db=db)

    assert len(result) == 1
    assert result[0].slug == 'acme-law'


def test_list_roles_returns_available_roles(make_auth_context):
    auth = make_auth_context(roles=['org_admin'], permissions={'roles:manage'})
    db = MagicMock()
    db.scalars.return_value.all.return_value = [
        row(
            id=uuid4(),
            organization_id=None,
            name='Lawyer',
            slug='lawyer',
            description='Case lawyer',
            is_system=True,
            permissions=['cases:manage'],
        )
    ]

    result = admin.list_roles(auth=auth, db=db)

    assert result[0].slug == 'lawyer'
    assert result[0].permissions == ['cases:manage']


def test_create_user_assigns_role_and_returns_item(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['org_admin'], permissions={'users:manage'})
    db = MagicMock()
    db.scalar.side_effect = [auth.organization_id, None]

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

    assigned = []
    monkeypatch.setattr(admin, 'hash_password', lambda value: f'hashed:{value}')
    monkeypatch.setattr(
        admin,
        'assign_role_to_user',
        lambda db, user_id, role_slug, assigned_by: assigned.append((user_id, role_slug, assigned_by)),
    )
    monkeypatch.setattr(admin, 'log_activity', lambda *args, **kwargs: None)

    payload = AdminCreateUserRequest(
        organization_id=auth.organization_id,
        email='client@example.com',
        first_name='Client',
        last_name='User',
        password='Password123',
        status='active',
        role_slug='client',
    )

    result = admin.create_user(payload=payload, auth=auth, db=db)

    assert result.email == 'client@example.com'
    assert result.full_name == 'Client User'
    assert assigned[0][1] == 'client'
    assert result.roles == ['client']


def test_assign_user_role_assigns_and_commits(monkeypatch, make_auth_context, make_user):
    auth = make_auth_context(roles=['org_admin'], permissions={'users:manage', 'roles:manage'})
    existing_user = make_user(organization_id=auth.organization_id)
    db = MagicMock()
    db.scalar.return_value = existing_user

    assigned = []
    monkeypatch.setattr(
        admin,
        'assign_role_to_user',
        lambda db, user_id, role_slug, assigned_by: assigned.append((user_id, role_slug, assigned_by)),
    )
    monkeypatch.setattr(admin, 'log_activity', lambda *args, **kwargs: None)

    admin.assign_user_role(
        user_id=existing_user.id,
        payload=AdminAssignRoleRequest(role_slug='lawyer'),
        auth=auth,
        db=db,
    )

    assert assigned == [(existing_user.id, 'lawyer', auth.user_id)]
    db.commit.assert_called_once()


def test_list_admin_users_includes_roles(make_auth_context, make_user):
    auth = make_auth_context(roles=['org_admin'], permissions={'users:manage'})
    existing_user = make_user(organization_id=auth.organization_id)
    db = MagicMock()
    db.scalars.return_value.all.return_value = [existing_user]
    db.execute.return_value = FakeResult([row(user_id=existing_user.id, slug='lawyer')])

    result = admin.list_admin_users(limit=25, offset=0, auth=auth, db=db)

    assert result[0].roles == ['lawyer']


def test_remove_user_role_revokes_and_commits(monkeypatch, make_auth_context, make_user):
    auth = make_auth_context(roles=['org_admin'], permissions={'users:manage', 'roles:manage'})
    existing_user = make_user(organization_id=auth.organization_id)
    db = MagicMock()
    db.scalar.return_value = existing_user

    monkeypatch.setattr(admin, 'revoke_role_from_user', lambda db, user_id, role_slug: True)
    monkeypatch.setattr(admin, 'log_activity', lambda *args, **kwargs: None)

    admin.remove_user_role(user_id=existing_user.id, role_slug='lawyer', auth=auth, db=db)

    db.commit.assert_called_once()


def test_get_admin_operations_returns_snapshot(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['org_admin'])
    now = datetime.now(timezone.utc)
    db = MagicMock()

    db.execute.side_effect = [
        FakeResult(
            [
                row(
                    id=uuid4(),
                    case_number='C-2026-001',
                    case_type='H1B',
                    status='intake',
                    priority='high',
                    created_at=now,
                    primary_lawyer_id=None,
                    first_name=None,
                    last_name=None,
                )
            ]
        ),
        FakeResult([row(id=uuid4(), first_name='Avery', last_name='Law')]),
        FakeResult(
            [
                row(
                    id=uuid4(),
                    user_id=uuid4(),
                    email='invite@example.com',
                    role_slug='client',
                    created_at=now,
                    expires_at=now,
                    accepted_at=None,
                    revoked_at=None,
                    first_name='Admin',
                    last_name='User',
                )
            ]
        ),
    ]

    result = admin.get_admin_operations(auth=auth, db=db)

    assert result.organization_id == auth.organization_id
    assert len(result.unassigned_cases) == 1
    assert len(result.lawyer_workload) == 1


def test_assign_case_lawyer_updates_primary(monkeypatch, make_auth_context, make_user):
    auth = make_auth_context(roles=['org_admin'])
    existing_case = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        case_number='C-2026-002',
        primary_lawyer_id=None,
    )
    lawyer = make_user(organization_id=auth.organization_id)
    db = MagicMock()
    db.scalar.side_effect = [existing_case, lawyer]
    monkeypatch.setattr(admin, 'log_activity', lambda *args, **kwargs: None)

    result = admin.assign_case_lawyer(
        case_number='C-2026-002',
        payload=AdminCaseAssignmentRequest(lawyer_user_id=lawyer.id),
        auth=auth,
        db=db,
    )

    assert result.primary_lawyer_id == lawyer.id
    db.commit.assert_called_once()


def test_revoke_invitation_marks_revoked(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['org_admin'])
    invitation = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        accepted_at=None,
        revoked_at=None,
        email='invite@example.com',
        role_slug='client',
    )
    db = MagicMock()
    db.scalar.return_value = invitation
    monkeypatch.setattr(admin, 'log_activity', lambda *args, **kwargs: None)

    admin.revoke_invitation(invitation_id=invitation.id, auth=auth, db=db)

    assert invitation.revoked_at is not None
    db.commit.assert_called_once()


def test_send_invitation_email_requires_server_issued_invitation(
    monkeypatch,
    make_auth_context,
    make_user,
):
    auth = make_auth_context(roles=['org_admin'])
    token = 'valid-invitation-token'
    invitation = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        user_id=uuid4(),
        email='invite@example.com',
        token_hash=admin.hash_invitation_token(token),
        expires_at=datetime.now(timezone.utc),
        accepted_at=None,
        revoked_at=None,
    )
    invited_user = make_user(
        id=invitation.user_id,
        organization_id=auth.organization_id,
        first_name='Invited',
        last_name='User',
    )
    organization = row(
        id=auth.organization_id,
        name='Acme Law',
        settings={},
    )
    db = MagicMock()
    db.scalar.side_effect = [invitation, invited_user, organization]
    fake_send = MagicMock()
    monkeypatch.setattr(admin, 'send_invitation_email', fake_send)
    monkeypatch.setattr(
        admin.settings,
        'frontend_origin',
        'http://localhost:3000',
    )

    admin.send_invitation_email_endpoint(
        payload=SendInvitationEmailRequest(
            to_email='invite@example.com',
            recipient_name='Attacker supplied',
            invitation_url=f'http://localhost:3000/invite?token={token}',
        ),
        auth=auth,
        db=db,
    )

    assert fake_send.call_args.kwargs['recipient_name'] == 'Invited User'
    assert fake_send.call_args.kwargs['organization_name'] == 'Acme Law'


def test_send_invitation_email_rejects_untrusted_origin(make_auth_context):
    auth = make_auth_context(roles=['org_admin'])

    with pytest.raises(HTTPException) as exc:
        admin.send_invitation_email_endpoint(
            payload=SendInvitationEmailRequest(
                to_email='invite@example.com',
                recipient_name='Invitee',
                invitation_url='https://evil.example/invite?token=secret',
            ),
            auth=auth,
            db=MagicMock(),
        )

    assert exc.value.status_code == 400


def test_delete_user_soft_deletes_user(monkeypatch, make_auth_context, make_user):
    auth = make_auth_context(roles=['org_admin'], permissions={'users:manage'})
    target_user = make_user(organization_id=auth.organization_id)
    db = MagicMock()
    db.scalar.return_value = target_user
    monkeypatch.setattr(admin, 'log_activity', lambda *args, **kwargs: None)

    admin.delete_user(user_id=target_user.id, auth=auth, db=db)

    assert target_user.deleted_at is not None
    assert target_user.status == 'disabled'
    db.commit.assert_called_once()


def test_delete_organization_soft_deletes_org(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['super_admin'])
    db = MagicMock()
    organization = row(
        id=uuid4(),
        name='Org',
        slug='org',
        deleted_at=None,
    )
    db.scalar.return_value = organization
    monkeypatch.setattr(admin, 'log_activity', lambda *args, **kwargs: None)

    admin.delete_organization(organization_id=organization.id, auth=auth, db=db)

    assert organization.deleted_at is not None
    db.commit.assert_called_once()
