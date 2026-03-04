from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.api.routes.organizations import list_organizations
from tests.support import row


def test_list_organizations_limits_to_auth_org(make_auth_context):
    auth = make_auth_context(roles=['org_admin'])
    db = MagicMock()
    db.scalars.return_value.all.return_value = [row(id=auth.organization_id, name='Firm', slug='firm', contact_email='a@b.com', subscription_status='active', created_at=datetime.now(timezone.utc))]

    result = list_organizations(limit=25, offset=0, auth=auth, db=db)

    stmt = db.scalars.call_args[0][0]
    assert 'organizations.id = :id_1' in str(stmt)
    assert len(result) == 1
