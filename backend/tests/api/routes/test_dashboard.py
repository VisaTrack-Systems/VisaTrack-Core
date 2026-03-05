from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from app.api.routes.dashboard import get_dashboard_overview
from tests.support import FakeResult, row


def test_dashboard_overview_aggregates_counts(make_auth_context):
    auth = make_auth_context(roles=['org_admin'])
    db = MagicMock()
    db.scalar.side_effect = [2, 5, 3, 1]
    db.execute.side_effect = [
        FakeResult([row(id=uuid4(), case_number='C-1', case_type='Express Entry', status='intake', priority='high', first_name='Client', last_name='One')]),
        FakeResult([row(id=uuid4(), case_id=uuid4(), case_number='C-1', name='Review', due_date=None, status='not_started')]),
    ]

    result = get_dashboard_overview(auth=auth, db=db)

    assert result.stats.organizations == 2
    assert result.stats.users == 5
    assert result.recent_cases[0].client_name == 'Client One'
    assert result.upcoming_milestones[0].name == 'Review'
