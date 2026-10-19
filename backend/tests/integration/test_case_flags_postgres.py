"""Real PostgreSQL checks; opt in with an empty, disposable test database.

CASE_FLAGS_TEST_DATABASE_URL must name visatrack_case_flags_test. These tests
never use the application's DATABASE_URL and refuse a populated database.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, func, inspect, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.api.deps.auth import get_auth_context
from app.api.routes import lawyer
from app.db.deps import get_db
from app.models.case import Case
from app.models.organization import Organization
from app.models.user import User
from app.models.user_case_flag import UserCaseFlag
from app.schemas.lawyer import LawyerCaseFlagRequest


@pytest.fixture(scope="module")
def flag_database():
    test_url = os.getenv("CASE_FLAGS_TEST_DATABASE_URL")
    if not test_url:
        pytest.skip("CASE_FLAGS_TEST_DATABASE_URL not set; disposable PostgreSQL required")
    url = make_url(test_url)
    if url.get_backend_name() != "postgresql" or url.database != "visatrack_case_flags_test":
        pytest.fail("Case-flag integration tests require database visatrack_case_flags_test")
    engine = create_engine(test_url)
    if inspect(engine).get_table_names():
        engine.dispose()
        pytest.fail("Refusing to migrate a populated integration-test database")
    backend_root = Path(__file__).resolve().parents[2]
    migration = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(backend_root / "alembic.ini"), "upgrade", "head"],
        cwd=backend_root,
        env={**os.environ, "APP_ENV": "test", "DATABASE_URL": test_url},
        text=True, capture_output=True, check=False,
    )
    assert migration.returncode == 0, migration.stdout + migration.stderr
    assert "user_case_flags" in inspect(engine).get_table_names()
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    yield SimpleNamespace(engine=engine, factory=factory)
    engine.dispose()


@pytest.fixture
def flag_store(flag_database, make_auth_context):
    factory = flag_database.factory
    with factory() as db:
        org = Organization(name="Flag test", slug=f"flag-{uuid4().hex}", contact_email="flags@example.test")
        foreign_org = Organization(name="Other tenant", slug=f"foreign-{uuid4().hex}", contact_email="other@example.test")
        db.add_all([org, foreign_org])
        db.flush()

        def user(first_name, organization_id=org.id):
            value = User(
                organization_id=organization_id, email=f"{uuid4().hex}@example.test",
                password_hash="unused-by-auth-override", first_name=first_name, last_name="Test",
                status="active",
            )
            db.add(value)
            db.flush()
            return value

        first, second, client = user("First lawyer"), user("Second lawyer"), user("Client")
        foreign_client = user("Foreign client", foreign_org.id)
        db.commit()
    auth = make_auth_context(user=first, roles=["lawyer"])

    def make_case(**overrides):
        values = dict(
            organization_id=org.id, case_number=f"FLAG-{uuid4().hex}", client_id=client.id,
            primary_lawyer_id=first.id, created_by=first.id, case_type="Express Entry",
            priority="medium", custom_fields={"shared_note": "unchanged"},
            created_at=datetime.now(timezone.utc),
        )
        values.update(overrides)
        with factory() as db:
            value = Case(**values)
            db.add(value)
            db.commit()
            return value

    app = FastAPI()
    app.include_router(lawyer.router, prefix="/api/v1")
    app.dependency_overrides[get_auth_context] = lambda: auth

    def database_session():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = database_session
    with TestClient(app) as api:
        yield SimpleNamespace(
            api=api, auth=auth, first=first, second=second,
            org=org, foreign_org=foreign_org, foreign_client=foreign_client,
            make_case=make_case, factory=factory,
        )


def _put(store, case, enabled):
    return store.api.put(
        f"/api/v1/lawyer/cases/{case.case_number}/flag", json={"is_flagged": enabled}
    )


def _list(store, **params):
    response = store.api.get("/api/v1/lawyer/cases", params=params)
    assert response.status_code == 200
    return response.json()


def test_flags_are_persistent_idempotent_and_private(flag_store):
    store = flag_store
    shared = store.make_case(primary_lawyer_id=store.second.id)
    assert _put(store, shared, True).json() == {"case_number": shared.case_number, "is_flagged": True}
    assert _put(store, shared, True).status_code == 200
    assert _list(store)[0]["is_flagged"] is True
    with store.factory() as db:
        assert db.scalar(select(func.count()).select_from(UserCaseFlag).where(UserCaseFlag.case_id == shared.id)) == 1
        persisted = db.get(Case, shared.id)
        assert persisted.priority == "medium"
        assert persisted.custom_fields == {"shared_note": "unchanged"}
    # The assigned lawyer's flag is independent of the case creator's flag.
    store.auth.user = store.second
    assert _list(store)[0]["is_flagged"] is False
    assert _put(store, shared, True).status_code == 200
    assert _put(store, shared, False).status_code == 200
    assert _put(store, shared, False).status_code == 200
    assert _list(store)[0]["is_flagged"] is False
    store.auth.user = store.first
    assert _list(store)[0]["is_flagged"] is True


def test_flag_order_applies_before_pagination_and_removal_restores_date_order(flag_store):
    store = flag_store
    now = datetime.now(timezone.utc)
    first = store.make_case(created_at=now - timedelta(days=3))
    second = store.make_case(created_at=now - timedelta(days=2))
    newest = store.make_case(created_at=now)
    assert _put(store, first, True).status_code == 200
    assert _put(store, second, True).status_code == 200
    assert _list(store, limit=1, offset=0)[0]["id"] == str(second.id)
    assert _list(store, limit=1, offset=1)[0]["id"] == str(first.id)
    assert _list(store, limit=1, offset=2)[0]["id"] == str(newest.id)
    assert _put(store, second, False).status_code == 200
    assert [item["id"] for item in _list(store)] == [str(first.id), str(newest.id), str(second.id)]


def test_equal_dates_have_stable_case_id_order(flag_store):
    store = flag_store
    instant = datetime.now(timezone.utc)
    cases = [store.make_case(created_at=instant) for _ in range(3)]
    expected = sorted((str(case.id) for case in cases), reverse=True)
    assert [item["id"] for item in _list(store)] == expected
    assert _list(store, limit=1, offset=1)[0]["id"] == expected[1]


def test_missing_foreign_unassigned_and_deleted_cases_cannot_be_flagged(flag_store):
    store = flag_store
    inaccessible = [
        SimpleNamespace(case_number="FLAG-missing"),
        store.make_case(organization_id=store.foreign_org.id, client_id=store.foreign_client.id),
        store.make_case(primary_lawyer_id=store.second.id, created_by=store.second.id),
        store.make_case(deleted_at=datetime.now(timezone.utc)),
    ]
    for case in inaccessible:
        response = _put(store, case, True)
        assert response.status_code == 404
        assert response.json()["detail"] == "Case not found"
    with store.factory() as db:
        assert db.scalar(select(func.count()).select_from(UserCaseFlag).where(UserCaseFlag.user_id == store.first.id)) == 0


@pytest.mark.parametrize("active_role", ["client", "org_admin", "super_admin"])
def test_other_active_roles_cannot_mutate_or_observe_flags(flag_store, active_role):
    store = flag_store
    case = store.make_case()
    assert _put(store, case, True).status_code == 200
    store.auth.roles = ["lawyer", active_role]
    store.auth.active_role = active_role
    assert _put(store, case, False).status_code == 403
    if active_role == "client":
        assert store.api.get("/api/v1/lawyer/cases").status_code == 403
    else:
        assert _list(store)[0]["is_flagged"] is False


def test_concurrent_repeated_sets_and_removals_are_idempotent(flag_store):
    store = flag_store
    case = store.make_case()

    def update(enabled):
        with store.factory() as db:
            return lawyer.set_lawyer_case_flag(
                case_number=case.case_number, payload=LawyerCaseFlagRequest(is_flagged=enabled),
                auth=store.auth, db=db,
            ).is_flagged

    with ThreadPoolExecutor(max_workers=4) as executor:
        assert all(executor.map(update, [True] * 8))
    with store.factory() as db:
        assert db.scalar(select(func.count()).select_from(UserCaseFlag).where(UserCaseFlag.case_id == case.id)) == 1
    with ThreadPoolExecutor(max_workers=4) as executor:
        assert not any(executor.map(update, [False] * 8))
    assert _list(store)[0]["is_flagged"] is False


def test_flags_cascade_when_case_or_user_is_deleted(flag_store):
    store = flag_store
    first, second = store.make_case(), store.make_case()
    assert _put(store, first, True).status_code == 200
    assert _put(store, second, True).status_code == 200
    with store.factory() as db:
        db.execute(delete(Case).where(Case.id == first.id))
        # An unrelated lawyer's flag verifies the separate user cascade.
        db.add(UserCaseFlag(user_id=store.second.id, case_id=second.id))
        db.commit()
        assert db.scalar(select(func.count()).select_from(UserCaseFlag).where(UserCaseFlag.case_id == first.id)) == 0
        db.execute(delete(User).where(User.id == store.second.id))
        db.commit()
        assert db.scalar(select(func.count()).select_from(UserCaseFlag).where(UserCaseFlag.user_id == store.second.id)) == 0
        assert db.get(UserCaseFlag, (store.first.id, second.id)) is not None
