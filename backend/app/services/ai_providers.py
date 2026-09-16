"""Fixed-host, stateless adapters for supported BYOK model providers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

from app.core.config import settings

OPENAI_BASE_URL = "https://api.openai.com/v1"
ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01"


class AiProviderError(RuntimeError):
    pass


class AiModelUnavailableError(AiProviderError):
    pass


class AiIncompleteResponseError(AiProviderError):
    pass


class AiProviderRateLimitError(AiProviderError):
    def __init__(self, retry_after_seconds: int | None = None):
        super().__init__("AI provider rate limit reached; try again later")
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class AiCompletion:
    content: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    actual_model: str | None = None
    provider_request_id: str | None = None
    finish_reason: str | None = None


def list_provider_models(provider: str, api_key: str) -> list[str]:
    normalized = provider.strip().lower()
    try:
        with httpx.Client(timeout=settings.ai_request_timeout_seconds) as client:
            if normalized == "openai":
                response = client.get(
                    f"{OPENAI_BASE_URL}/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
            elif normalized == "anthropic":
                response = client.get(
                    f"{ANTHROPIC_BASE_URL}/models",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": ANTHROPIC_VERSION,
                    },
                    params={"limit": 100},
                )
            else:
                raise AiProviderError("Unsupported AI provider")
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Provider model response was not an object")
    except (httpx.HTTPError, ValueError) as exc:
        raise AiProviderError("AI provider rejected the connection or could not be reached") from exc

    models = [
        (
            str(item.get("id") or "").strip(),
            _created_rank(item.get("created") or item.get("created_at")),
        )
        for item in payload.get("data", [])
        if isinstance(item, dict)
    ]
    if normalized == "openai":
        models = [
            (model_id, created)
            for model_id, created in models
            if model_id.startswith(("gpt-", "chatgpt-", "o1", "o3", "o4", "o5"))
            and not any(
                excluded in model_id
                for excluded in (
                    "audio",
                    "image",
                    "realtime",
                    "search",
                    "transcribe",
                    "tts",
                    "codex",
                    "computer-use",
                    "deep-research",
                    "embed",
                    "guard",
                    "moderation",
                    "instruct",
                    "safety",
                    "whisper",
                    "dall-e",
                    "davinci",
                    "babbage",
                    "chatgpt-",
                )
            )
        ]
    elif normalized == "anthropic":
        models = [
            (model_id, created)
            for model_id, created in models
            if model_id.startswith("claude-")
        ]
    if settings.ai_allowed_models:
        allowed_models = settings.allowed_ai_models_for(normalized)
        models = [
            (model_id, created)
            for model_id, created in models
            if model_id in allowed_models
        ]
    return [
        model_id
        for model_id, _ in sorted(
            ((model_id, created) for model_id, created in models if model_id),
            key=lambda item: _model_score(normalized, item[0], item[1]),
            reverse=True,
        )
    ]


def resolve_completion_model(
    provider: str,
    api_key: str,
    selected_model: str | None,
) -> tuple[list[str], str]:
    models = list_provider_models(provider, api_key)
    if not models:
        raise AiProviderError("Provider returned no available models")
    pinned = (selected_model or "").strip()
    if not pinned:
        raise AiModelUnavailableError("Select an approved model before sending case data")
    if pinned in models:
        return models, pinned
    raise AiModelUnavailableError(
        "The selected model is no longer available; review and select an approved model"
    )


def complete(
    *,
    provider: str,
    api_key: str,
    model: str,
    system: str,
    messages: list[dict[str, str]],
    max_output_tokens: int = 2000,
) -> AiCompletion:
    normalized = provider.strip().lower()
    try:
        with httpx.Client(timeout=settings.ai_request_timeout_seconds) as client:
            if normalized == "openai":
                response = client.post(
                    f"{OPENAI_BASE_URL}/responses",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": model,
                        "instructions": system,
                        "input": messages,
                        "max_output_tokens": max_output_tokens,
                        "store": False,
                    },
                )
                _raise_completion_status(response)
                return _parse_openai(response.json())
            if normalized == "anthropic":
                response = client.post(
                    f"{ANTHROPIC_BASE_URL}/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": ANTHROPIC_VERSION,
                    },
                    json={
                        "model": model,
                        "system": system,
                        "messages": messages,
                        "max_tokens": max_output_tokens,
                    },
                )
                _raise_completion_status(response)
                return _parse_anthropic(response.json())
            raise AiProviderError("Unsupported AI provider")
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise AiProviderError("AI provider request failed") from exc


def _raise_completion_status(response: httpx.Response) -> None:
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if response.status_code == 429:
            retry_after = _optional_int(response.headers.get("Retry-After"))
            raise AiProviderRateLimitError(retry_after) from exc
        detail = response.text.casefold()
        if response.status_code in {400, 403, 404} and "model" in detail:
            raise AiModelUnavailableError(
                "The selected model is unavailable or no longer permitted; "
                "review and select an approved model"
            ) from exc
        raise


def _parse_openai(payload: dict[str, Any]) -> AiCompletion:
    if not isinstance(payload, dict):
        raise AiProviderError("AI provider returned an invalid response")
    status_value = str(payload.get("status") or "").strip().lower()
    if status_value and status_value != "completed":
        raise AiIncompleteResponseError("AI provider returned an incomplete response")
    content = str(payload.get("output_text") or "").strip()
    if not content:
        parts: list[str] = []
        for output in payload.get("output", []):
            if not isinstance(output, dict):
                continue
            for item in output.get("content", []):
                if isinstance(item, dict) and item.get("type") == "output_text":
                    parts.append(str(item.get("text") or ""))
        content = "\n".join(parts).strip()
    if not content:
        raise AiProviderError("AI provider returned no text")
    usage = payload.get("usage") or {}
    return AiCompletion(
        content=content,
        input_tokens=_optional_int(usage.get("input_tokens")),
        output_tokens=_optional_int(usage.get("output_tokens")),
        actual_model=str(payload.get("model") or "").strip() or None,
        provider_request_id=str(payload.get("id") or "").strip() or None,
        finish_reason=status_value or None,
    )


def _parse_anthropic(payload: dict[str, Any]) -> AiCompletion:
    if not isinstance(payload, dict):
        raise AiProviderError("AI provider returned an invalid response")
    stop_reason = str(payload.get("stop_reason") or "").strip().lower()
    if stop_reason == "max_tokens":
        raise AiIncompleteResponseError("AI provider output reached its token limit")
    content = "\n".join(
        str(item.get("text") or "")
        for item in payload.get("content", [])
        if isinstance(item, dict) and item.get("type") == "text"
    ).strip()
    if not content:
        raise AiProviderError("AI provider returned no text")
    usage = payload.get("usage") or {}
    return AiCompletion(
        content=content,
        input_tokens=_optional_int(usage.get("input_tokens")),
        output_tokens=_optional_int(usage.get("output_tokens")),
        actual_model=str(payload.get("model") or "").strip() or None,
        provider_request_id=str(payload.get("id") or "").strip() or None,
        finish_reason=stop_reason or None,
    )


def _optional_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _model_score(
    provider: str, model_id: str, created: int
) -> tuple[int, int, int, int, int, str]:
    normalized = model_id.lower()
    generation = _generation(normalized)
    major = generation // 1000
    family = _family_tier(provider, normalized)
    canonical = 1 if _is_canonical_alias(normalized) else 0
    return major, family, generation, canonical, created, normalized


def _generation(model_id: str) -> int:
    for match in re.finditer(r"(?<!\d)(\d{1,2})(?:[.-](\d{1,2}))?(?!\d)", model_id):
        major = int(match.group(1))
        minor = int(match.group(2) or 0)
        if major >= 20:
            continue
        return major * 1000 + minor * 10
    return 0


def _family_tier(provider: str, model_id: str) -> int:
    if provider == "anthropic":
        if "opus" in model_id:
            return 500
        if "sonnet" in model_id:
            return 300
        if "haiku" in model_id or "instant" in model_id:
            return 50
        return 100
    if "nano" in model_id:
        return 40
    if "mini" in model_id:
        return 80
    if "max" in model_id:
        return 480
    if "pro" in model_id:
        return 450
    if re.search(r"(?:^|/)o[1-9]", model_id):
        return 420
    if "4o" in model_id:
        return 360
    return 300


def _is_canonical_alias(model_id: str) -> bool:
    if "latest" in model_id:
        return True
    return not re.search(r"\d{4}-\d{2}-\d{2}", model_id) and not re.search(
        r"(?:^|[-_])\d{8}(?:[-_]|$)", model_id
    )


def _created_rank(value: Any) -> int:
    integer = _optional_int(value)
    if integer is not None:
        return integer
    if isinstance(value, str):
        try:
            return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())
        except ValueError:
            return 0
    return 0
