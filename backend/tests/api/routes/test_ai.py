from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.routes import ai
from app.schemas.ai import AiProviderConnectRequest
from tests.support import FakeResult


def test_connect_provider_requires_data_processing_approval(make_auth_context):
    with pytest.raises(HTTPException) as exc:
        ai.connect_provider(
            payload=AiProviderConnectRequest(
                provider="openai",
                api_key="sk-test-provider-key",
                data_processing_acknowledged=False,
                current_password="current-password",
            ),
            auth=make_auth_context(roles=["lawyer"]),
            db=MagicMock(),
        )
    assert exc.value.status_code == 400


def test_ai_access_requires_legal_role_and_explicit_permission(monkeypatch, make_auth_context):
    monkeypatch.setattr(ai.settings, "ai_enabled", True)
    with pytest.raises(HTTPException):
        ai.require_ai_access(make_auth_context(roles=["lawyer"], permissions=set()))
    with pytest.raises(HTTPException):
        ai.require_ai_access(
            make_auth_context(roles=["client"], permissions={"ai:use"})
        )

    allowed = make_auth_context(roles=["lawyer"], permissions={"ai:use"})
    assert ai.require_ai_access(allowed) is allowed


def test_ai_access_fails_closed_when_feature_is_disabled(monkeypatch, make_auth_context):
    monkeypatch.setattr(ai.settings, "ai_enabled", False)
    with pytest.raises(HTTPException) as exc:
        ai.require_ai_access(
            make_auth_context(roles=["lawyer"], permissions={"ai:use"})
        )
    assert exc.value.status_code == 503


def test_connect_provider_verifies_and_never_returns_key(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=["lawyer"])
    now = datetime.now(timezone.utc)
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "provider": "openai",
                    "key_hint": "…1234",
                    "selected_model": "gpt-test",
                    "last_verified_at": now,
                    "data_processing_acknowledged_at": now,
                }
            ]
        ),
        FakeResult(),
    ]
    monkeypatch.setattr(ai, "list_provider_models", lambda provider, key: ["gpt-test"])
    monkeypatch.setattr(ai, "encrypt_provider_key", lambda key: "ciphertext")
    monkeypatch.setattr(ai, "verify_password", lambda password, hashed: True)

    result = ai.connect_provider(
        payload=AiProviderConnectRequest(
            provider="openai",
            api_key="sk-secret-value-1234",
            selected_model="gpt-test",
            data_processing_acknowledged=True,
            current_password="current-password",
        ),
        auth=auth,
        db=db,
    )

    assert result.key_hint == "…1234"
    assert not hasattr(result, "api_key")
    insert_params = db.execute.call_args_list[0].args[1]
    assert insert_params["encrypted_api_key"] == "ciphertext"
    assert insert_params["selected_model"] == "gpt-test"
    assert "sk-secret-value-1234" not in str(result)


def test_connect_provider_defaults_to_unpinned_strongest_model(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=["lawyer"])
    now = datetime.now(timezone.utc)
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "provider": "openai",
                    "key_hint": "…1234",
                    "selected_model": None,
                    "last_verified_at": now,
                    "data_processing_acknowledged_at": now,
                }
            ]
        ),
        FakeResult(),
    ]
    monkeypatch.setattr(
        ai, "list_provider_models", lambda provider, key: ["gpt-5.4-pro", "gpt-5.4"]
    )
    monkeypatch.setattr(ai, "encrypt_provider_key", lambda key: "ciphertext")
    monkeypatch.setattr(ai, "verify_password", lambda password, hashed: True)

    ai.connect_provider(
        payload=AiProviderConnectRequest(
            provider="openai",
            api_key="sk-secret-value-1234",
            data_processing_acknowledged=True,
            current_password="current-password",
        ),
        auth=auth,
        db=db,
    )

    insert_params = db.execute.call_args_list[0].args[1]
    assert insert_params["selected_model"] is None
    assert insert_params["encrypted_api_key"] == "ciphertext"


def test_connect_provider_reauthenticates_mfa_user(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=["lawyer"])
    auth.user.mfa_enabled = True
    provider_call = MagicMock()
    monkeypatch.setattr(ai, "verify_password", lambda password, hashed: True)
    monkeypatch.setattr(ai, "verify_user_mfa", lambda db, user, code: False)
    monkeypatch.setattr(ai, "list_provider_models", provider_call)

    with pytest.raises(HTTPException) as exc:
        ai.connect_provider(
            payload=AiProviderConnectRequest(
                provider="anthropic",
                api_key="sk-ant-provider-secret",
                data_processing_acknowledged=True,
                current_password="current-password",
                mfa_code="000000",
            ),
            auth=auth,
            db=MagicMock(),
        )

    assert exc.value.status_code == 400
    provider_call.assert_not_called()


def test_case_access_hides_another_lawyers_case(make_auth_context):
    auth = make_auth_context(roles=["lawyer"])
    db = MagicMock()
    db.execute.return_value = FakeResult(
        rows=[
            {
                "id": uuid4(),
                "organization_id": auth.organization_id,
                "client_id": uuid4(),
                "primary_lawyer_id": uuid4(),
                "created_by": uuid4(),
                "case_number": "C-2026-001",
                "case_type": "Study Permit",
                "status": "intake",
                "description": None,
                "uci_number": None,
                "application_number": None,
                "first_name": "Client",
                "last_name": "One",
                "email": "client@example.com",
                "phone": None,
            }
        ]
    )

    with pytest.raises(HTTPException) as exc:
        ai._case_for_ai("C-2026-001", auth, db)
    assert exc.value.status_code == 404


def test_usage_limit_returns_retry_after(make_auth_context):
    db = MagicMock()
    db.execute.return_value = FakeResult(scalar_value=60)

    with pytest.raises(HTTPException) as exc:
        ai._enforce_usage_limit(make_auth_context(roles=["lawyer"]), db)

    assert exc.value.status_code == 429
    assert exc.value.headers == {"Retry-After": "3600"}


def test_chat_delete_is_blocked_by_cited_legal_hold(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=["lawyer"])
    chat_id = uuid4()
    monkeypatch.setattr(
        ai,
        "_owned_chat",
        lambda *args, **kwargs: {
            "case_id": uuid4(),
            "client_id": uuid4(),
        },
    )
    db = MagicMock()
    db.execute.return_value = FakeResult(scalar_value=1)

    with pytest.raises(HTTPException) as exc:
        ai.delete_chat(chat_id=chat_id, auth=auth, db=db)

    assert exc.value.status_code == 409


def test_case_context_has_bounded_source_citations():
    organization_id = uuid4()
    case_id = uuid4()
    document_id = uuid4()
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(
            rows=[
                {
                    "case_number": "C-2026-001",
                    "case_type": "Study Permit",
                    "status": "intake",
                    "description": "Application preparation",
                    "uci_number": "1234-5678",
                    "application_number": None,
                    "first_name": "Client",
                    "last_name": "One",
                    "email": "client@example.com",
                    "phone": None,
                }
            ]
        ),
        FakeResult(
            rows=[
                {
                    "case_document_id": document_id,
                    "page_number": 2,
                    "content": "Passport expires 2030-01-01.",
                    "document_name": "Passport",
                    "rank": 1,
                }
            ]
        ),
    ]

    context, citations = ai._build_case_context(
        db,
        organization_id=organization_id,
        case_id=case_id,
        query="passport expiry",
    )

    assert '<untrusted_document source="D1"' in context
    assert citations[0].case_document_id == document_id
    assert citations[0].page_number == 2


def test_form_json_parser_accepts_fenced_object_and_rejects_array():
    assert ai._parse_json_object('```json\n{"fields": {}}\n```') == {"fields": {}}
    with pytest.raises(ValueError):
        ai._parse_json_object("[]")


def test_grounded_answer_keeps_only_used_known_sources():
    citations = [
        ai.AiCitation(
            source_id="D1",
            case_document_id=uuid4(),
            document_name="Passport",
            page_number=1,
            excerpt="Client name",
        ),
        ai.AiCitation(
            source_id="D2",
            case_document_id=uuid4(),
            document_name="Letter",
            page_number=2,
            excerpt="Employment",
        ),
    ]

    content, used = ai._grounded_answer("The passport states this [D1] and [D99].", citations)

    assert [citation.source_id for citation in used] == ["D1"]
    assert "unknown source labels: D99" in content
