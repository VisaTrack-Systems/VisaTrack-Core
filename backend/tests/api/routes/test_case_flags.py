"""Authorization and request-contract checks for personal case flags."""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

from app.api.deps.auth import get_auth_context
from app.api.routes import lawyer
from app.db.deps import get_db
from tests.support import row


@pytest.fixture
def flag_api(make_auth_context):
    auth = make_auth_context(roles=["lawyer"])
    db = MagicMock()
    case = row(id=uuid4(), case_number="C-FLAG-001", priority="medium", custom_fields={})
    db.scalar.return_value = case
    app = FastAPI()
    app.include_router(lawyer.router, prefix="/api/v1")
    app.dependency_overrides[get_auth_context] = lambda: auth
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as client:
        yield client, auth, db, case


@pytest.mark.parametrize("active_role", ["client", "org_admin", "super_admin"])
def test_only_active_lawyer_can_change_flags(flag_api, active_role):
    client, auth, db, _ = flag_api
    auth.roles = ["lawyer", active_role]
    auth.active_role = active_role

    response = client.put("/api/v1/lawyer/cases/C-FLAG-001/flag", json={"is_flagged": True})

    assert response.status_code == 403
    db.scalar.assert_not_called()
    db.execute.assert_not_called()


@pytest.mark.parametrize(
    "payload",
    [{}, {"is_flagged": "true"}, {"is_flagged": 1}, {"is_flagged": True, "user_id": "someone-else"}],
)
def test_flag_request_requires_boolean_and_rejects_owner_override(flag_api, payload):
    client, _, db, _ = flag_api

    response = client.put("/api/v1/lawyer/cases/C-FLAG-001/flag", json=payload)

    assert response.status_code == 422
    db.execute.assert_not_called()
    db.commit.assert_not_called()


def test_missing_or_inaccessible_case_does_not_write_flag(flag_api):
    client, _, db, _ = flag_api
    db.scalar.return_value = None

    response = client.put("/api/v1/lawyer/cases/C-FLAG-001/flag", json={"is_flagged": True})

    assert response.status_code == 404
    assert response.json()["detail"] == "Case not found"
    db.execute.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.parametrize("is_flagged", [True, False])
def test_flag_write_scopes_the_case_and_flag_to_authenticated_user(flag_api, is_flagged):
    client, auth, db, case = flag_api

    response = client.put(
        "/api/v1/lawyer/cases/C-FLAG-001/flag", json={"is_flagged": is_flagged}
    )

    assert response.status_code == 200
    assert response.json() == {"case_number": case.case_number, "is_flagged": is_flagged}
    lookup = db.scalar.call_args.args[0].compile(dialect=postgresql.dialect())
    lookup_sql = str(lookup)
    assert "cases.organization_id =" in lookup_sql
    assert "cases.deleted_at IS NULL" in lookup_sql
    assert "cases.primary_lawyer_id =" in lookup_sql and "cases.created_by =" in lookup_sql
    assert "FOR UPDATE" in lookup_sql
    assert auth.organization_id in lookup.params.values()
    assert auth.user_id in lookup.params.values()
    write = db.execute.call_args.args[0].compile(dialect=postgresql.dialect())
    assert auth.user_id in write.params.values()
    assert case.id in write.params.values()
    assert case.priority == "medium" and case.custom_fields == {}
    db.commit.assert_called_once()


def test_list_orders_private_flags_before_pagination(make_auth_context):
    auth = make_auth_context(roles=["lawyer"])
    db = MagicMock()
    db.execute.return_value.all.return_value = []

    lawyer.list_lawyer_cases(limit=2, offset=3, auth=auth, db=db)

    statement = db.execute.call_args.args[0].compile(dialect=postgresql.dialect())
    sql = str(statement)
    assert "user_case_flags.user_id =" in sql
    assert auth.user_id in statement.params.values()
    assert "ORDER BY is_flagged DESC, cases.created_at DESC, cases.id DESC" in sql
    assert sql.index("ORDER BY") < sql.index("LIMIT") < sql.index("OFFSET")


@pytest.mark.parametrize("active_role", ["org_admin", "super_admin"])
def test_admin_list_does_not_read_private_flags(make_auth_context, active_role):
    auth = make_auth_context(roles=[active_role, "lawyer"])
    db = MagicMock()
    db.execute.return_value.all.return_value = []

    lawyer.list_lawyer_cases(limit=50, offset=0, auth=auth, db=db)

    statement = db.execute.call_args.args[0].compile(dialect=postgresql.dialect())
    assert "user_case_flags" not in str(statement)
