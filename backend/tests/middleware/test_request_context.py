import asyncio

from starlette.requests import Request
from starlette.responses import JSONResponse

from app.middleware.request_context import RequestContextMiddleware, current_request_id


def test_request_id_is_propagated_and_available_to_handlers():
    observed = {}

    async def call_next(_request):
        observed["request_id"] = current_request_id()
        return JSONResponse({})

    middleware = RequestContextMiddleware(app=lambda scope, receive, send: None)
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/context",
            "query_string": b"",
            "headers": [(b"x-request-id", b"trace-123")],
            "server": ("test", 80),
            "scheme": "http",
        }
    )
    response = asyncio.run(middleware.dispatch(request, call_next))

    assert response.headers["X-Request-ID"] == "trace-123"
    assert observed["request_id"] == "trace-123"


def test_invalid_request_id_is_replaced():
    async def call_next(_request):
        return JSONResponse({})

    middleware = RequestContextMiddleware(app=lambda scope, receive, send: None)
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "query_string": b"",
            "headers": [(b"x-request-id", b"bad request id")],
            "server": ("test", 80),
            "scheme": "http",
        }
    )
    response = asyncio.run(middleware.dispatch(request, call_next))

    assert response.headers["X-Request-ID"] != "bad request id"
