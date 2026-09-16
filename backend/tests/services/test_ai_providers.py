from app.services import ai_providers
from app.services.ai_providers import _model_score, _parse_anthropic, _parse_openai


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


def test_model_discovery_recommends_strong_general_model(monkeypatch):
    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "data": [
                    {"id": "gpt-main", "created": 100},
                    {"id": "gpt-mini-new", "created": 300},
                    {"id": "gpt-pro", "created": 90},
                    {"id": "gpt-audio", "created": 400},
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

    assert models[0] == "gpt-pro"
    assert "gpt-audio" not in models


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
