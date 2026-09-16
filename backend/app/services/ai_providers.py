"""Fixed-host, stateless adapters for supported BYOK model providers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings

OPENAI_BASE_URL = "https://api.openai.com/v1"
ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01"


class AiProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class AiCompletion:
    content: str
    input_tokens: int | None = None
    output_tokens: int | None = None


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
                )
            )
        ]
    elif normalized == "anthropic":
        models = [
            (model_id, created)
            for model_id, created in models
            if model_id.startswith("claude-")
        ]
    return [
        model_id
        for model_id, _ in sorted(
            ((model_id, created) for model_id, created in models if model_id),
            key=lambda item: _model_score(normalized, item[0], item[1]),
            reverse=True,
        )
    ]


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
                response.raise_for_status()
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
                response.raise_for_status()
                return _parse_anthropic(response.json())
            raise AiProviderError("Unsupported AI provider")
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise AiProviderError("AI provider request failed") from exc


def _parse_openai(payload: dict[str, Any]) -> AiCompletion:
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
    )


def _parse_anthropic(payload: dict[str, Any]) -> AiCompletion:
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
    )


def _optional_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _model_score(provider: str, model_id: str, created: int) -> tuple[int, int, str]:
    import re

    normalized = model_id.lower()
    version_match = re.search(r"(?<!\d)(\d+)(?:[.-](\d+))?", normalized)
    generation = (
        int(version_match.group(1)) * 1000
        + int(version_match.group(2) or 0) * 10
        if version_match
        else 0
    )
    if provider == "anthropic":
        tier = generation + (
            300 if "opus" in normalized else 200 if "sonnet" in normalized else 100
        )
        if "haiku" in normalized:
            tier = generation
    else:
        tier = generation + 300
        if "pro" in normalized:
            tier += 100
        if "mini" in normalized:
            tier -= 150
        if "nano" in normalized:
            tier -= 250
    return tier, created, normalized


def _created_rank(value: Any) -> int:
    integer = _optional_int(value)
    if integer is not None:
        return integer
    if isinstance(value, str):
        from datetime import datetime

        try:
            return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())
        except ValueError:
            return 0
    return 0
