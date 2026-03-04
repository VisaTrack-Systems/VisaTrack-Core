from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes.client import get_client_case, list_client_cases
from tests.support import FakeResult, row


def test_list_client_cases_returns_joined_case_rows(make_auth_context):
    auth = make_auth_context(roles=['client'])
    case = row(id=uuid4(), case_number='C-2026-001', case_type='Express Entry', status='intake', priority='medium', target_filing_date=None, created_at=datetime.now(timezone.utc))
    db = MagicMock()
    db.execute.return_value = FakeResult([(case, 'Ava', 'Lawyer')])

    result = list_client_cases(auth=auth, db=db)

    assert len(result) == 1
    assert result[0].primary_lawyer_name == 'Ava Lawyer'


def test_get_client_case_raises_when_missing(make_auth_context):
    auth = make_auth_context(roles=['client'])
    db = MagicMock()
    db.execute.return_value = FakeResult([])

    with pytest.raises(HTTPException) as exc:
        get_client_case('C-2026-001', auth=auth, db=db)

    assert exc.value.status_code == 404
