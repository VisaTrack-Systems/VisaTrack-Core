"""Correlation IDs and privacy-safe structured request logs."""

from __future__ import annotations

import contextvars
import json
import logging
import re
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

request_id_context: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)
logger = logging.getLogger("visatrack.request")
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        supplied = request.headers.get("x-request-id", "")
        request_id = supplied if _SAFE_REQUEST_ID.fullmatch(supplied) else str(uuid4())
        token = request_id_context.set(request_id)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            request_id_context.reset(token)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            json.dumps(
                {
                    "event": "http_request",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
                separators=(",", ":"),
            )
        )
        return response


def current_request_id() -> str | None:
    return request_id_context.get() or None
