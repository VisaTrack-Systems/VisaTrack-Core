import pytest

from app.services import ai_providers
from app.services.ai_providers import (
    AiModelUnavailableError,
    _model_score,
    _parse_anthropic,
    _parse_openai,
)


def test_parse_openai_stateless_response():
    result = _parse_openai(
        {
            "output_text": "Grounded answer [D1]",
            "usage": {"input_tokens": 20, "output_tokens": 8},
        }
    )
    assert result.content == "Grounded answer [D1]"
    assert result.input_tokens == 20
    assert result.output_tokens == 8


def test_parse_anthropic_text_blocks():
    result = _parse_anthropic(
        {
            "content": [
                {"type": "text", "text": "First"},
                {"type": "tool_use", "name": "ignored"},
                {"type": "text", "text": "Second"},
            ],
            "usage": {"input_tokens": 10, "output_tokens": 4},
        }
    )
    assert result.content == "First\nSecond"


@pytest.mark.parametrize(
    "parser",
    [_parse_openai, _parse_anthropic],
)
def test_provider_parsers_reject_non_object_payloads(parser):
    with pytest.raises(ai_providers.AiProviderError, match="invalid response"):
        parser([])  # type: ignore[arg-type]


def test_model_ranking_prefers_strong_tier_before_recency():
    assert _model_score("anthropic", "claude-opus-old", 100) > _model_score(
        "anthropic", "claude-sonnet-new", 200
    )
    assert _model_score("openai", "gpt-pro", 100) > _model_score(
        "openai", "gpt-mini", 200
    )
    assert _model_score("openai", "gpt-5.6", 100) > _model_score(
        "openai", "gpt-4-pro", 200
    )
    assert _model_score("anthropic", "claude-5-sonnet", 100) > _model_score(
        "anthropic", "claude-4-opus", 200
    )


def test_model_ranking_ignores_date_stamps_and_prefers_flagship():
    assert _model_score("openai", "gpt-5.4-pro", 10) > _model_score(
        "openai", "gpt-4-0125-preview", 999
    )
    assert _model_score("openai", "gpt-5.4", 10) > _model_score(
        "openai", "gpt-5.4-mini", 999
    )
    assert _model_score("anthropic", "claude-opus-4-1", 10) > _model_score(
        "anthropic", "claude-sonnet-4-5-20250929", 999
    )
    assert _model_score("openai", "gpt-5.4", 50) > _model_score(
        "openai", "gpt-5.4-2025-01-01", 90
    )


def test_model_discovery_recommends_strong_general_model(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "data": [
                    {"id": "gpt-4-0125-preview", "created": 400},
                    {"id": "gpt-5.4-mini", "created": 500},
                    {"id": "gpt-5.4-pro", "created": 90},
                    {"id": "gpt-5.4", "created": 80},
                    {"id": "gpt-audio", "created": 600},
                    {"id": "o3-deep-research", "created": 650},
                    {"id": "text-embedding-3-large", "created": 700},
                ]
            }

    class Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def get(self, *args, **kwargs):
            return Response()

    monkeypatch.setattr(ai_providers.httpx, "Client", Client)

    models = ai_providers.list_provider_models("openai", "sk-test")

    assert models[0] == "gpt-5.4-pro"
    assert models[1] == "gpt-5.4"
    assert "gpt-audio" not in models
    assert "o3-deep-research" not in models
    assert "text-embedding-3-large" not in models

    monkeypatch.setattr(
        ai_providers.settings,
        "ai_allowed_models",
        {"openai:gpt-5.4"},
    )
    assert ai_providers.list_provider_models("openai", "sk-test") == ["gpt-5.4"]


def test_resolve_completion_model_requires_available_pin(monkeypatch):
    monkeypatch.setattr(
        ai_providers,
        "list_provider_models",
        lambda provider, key: ["gpt-5.4-pro", "gpt-5.4", "gpt-5.4-mini"],
    )

    _, pinned = ai_providers.resolve_completion_model(
        "openai", "sk-test", "gpt-5.4-mini"
    )

    assert pinned == "gpt-5.4-mini"
    with pytest.raises(AiModelUnavailableError, match="Select an approved model"):
        ai_providers.resolve_completion_model("openai", "sk-test", None)
    with pytest.raises(AiModelUnavailableError, match="no longer available"):
        ai_providers.resolve_completion_model(
            "openai", "sk-test", "gpt-retired"
        )


def test_openai_completion_forces_stateless_request(monkeypatch):
    captured = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"output_text": "Answer"}

    class Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url, **kwargs):
            captured.update(kwargs["json"])
            return Response()

    monkeypatch.setattr(ai_providers.httpx, "Client", Client)

    ai_providers.complete(
        provider="openai",
        api_key="sk-test",
        model="gpt-test",
        system="System",
        messages=[{"role": "user", "content": "Question"}],
    )

    assert captured["store"] is False


def test_completion_maps_retired_model_to_fail_closed_error(monkeypatch):
    class Client:
        def __init__(self, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return None

        def post(self, url, **kwargs):
            request = ai_providers.httpx.Request("POST", url)
            return ai_providers.httpx.Response(
                404,
                request=request,
                json={"error": {"message": "model was not found"}},
            )

    monkeypatch.setattr(ai_providers.httpx, "Client", Client)

    with pytest.raises(AiModelUnavailableError, match="selected model"):
        ai_providers.complete(
            provider="openai",
            api_key="sk-test",
            model="gpt-retired",
            system="System",
            messages=[{"role": "user", "content": "Question"}],
        )
