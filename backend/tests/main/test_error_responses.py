"""Server errors must reach the browser as errors, not as failed requests."""

from __future__ import annotations

import asyncio
import json

from app.core.config import settings
from app.main import app

ORIGIN = "http://localhost:3000"


def _call(path: str, headers: dict[str, str]) -> tuple[int, dict[str, str], dict]:
    """Send one request through the full middleware stack."""
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [
            (key.lower().encode(), value.encode()) for key, value in headers.items()
        ],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
    }
    messages: list[dict] = []

    async def receive() -> dict:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict) -> None:
        messages.append(message)

    asyncio.run(app(scope, receive, send))

    start = next(m for m in messages if m["type"] == "http.response.start")
    body = b"".join(
        m.get("body", b"") for m in messages if m["type"] == "http.response.body"
    )
    response_headers = {
        key.decode().lower(): value.decode() for key, value in start["headers"]
    }
    return start["status"], response_headers, json.loads(body or b"{}")


def _register_failing_route(path: str) -> None:
    @app.get(path)
    def boom() -> None:
        raise RuntimeError("database column is missing")


def _remove_route(path: str) -> None:
    app.router.routes[:] = [
        route for route in app.router.routes if getattr(route, "path", None) != path
    ]


def test_unhandled_error_returns_500_with_cors_headers():
    _register_failing_route("/tests/boom")
    try:
        status, headers, body = _call("/tests/boom", {"origin": ORIGIN})
    finally:
        _remove_route("/tests/boom")

    assert status == 500
    assert body["detail"] == "Internal server error"
    assert headers["access-control-allow-origin"] == ORIGIN
    assert headers["access-control-allow-credentials"] == "true"


def test_error_response_carries_the_request_id():
    _register_failing_route("/tests/boom-id")
    try:
        status, headers, body = _call("/tests/boom-id", {"x-request-id": "abc-123"})
    finally:
        _remove_route("/tests/boom-id")

    assert status == 500
    assert body["request_id"] == "abc-123"
    assert headers["x-request-id"] == "abc-123"


def test_configured_origins_are_allowed():
    assert ORIGIN in settings.frontend_origins
