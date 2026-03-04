from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.api.routes.users import list_users
from tests.support import row


def test_list_users_uses_org_scope_for_org_admin(make_auth_context):
    auth = make_auth_context(roles=['org_admin'])
    db = MagicMock()
    user = row(id=auth.user_id, email='user@example.com', first_name='Test', last_name='User', status='active', organization_id=auth.organization_id, created_at=datetime.now(timezone.utc))
    db.scalars.return_value.all.return_value = [user]

    result = list_users(limit=25, offset=0, auth=auth, db=db)

    stmt = db.scalars.call_args[0][0]
    assert 'users.organization_id = :organization_id_1' in str(stmt)
    assert result[0].email == 'user@example.com'


def test_list_users_allows_super_admin_org_filter(make_auth_context):
    auth = make_auth_context(roles=['super_admin'])
    db = MagicMock()
    db.scalars.return_value.all.return_value = []

    list_users(organization_id=auth.organization_id, limit=25, offset=0, auth=auth, db=db)

    stmt = db.scalars.call_args[0][0]
    assert 'users.organization_id = :organization_id_1' in str(stmt)
