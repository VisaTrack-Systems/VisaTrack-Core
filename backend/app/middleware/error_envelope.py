"""JSON error responses for failures that escape the route handlers.

Starlette's fallback error response is produced outside the CORS middleware,
so a browser reports it as a failed request rather than a server error and the
real status never reaches the caller. Catching inside the CORS layer keeps the
response cross-origin readable.
"""

from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.middleware.request_context import current_request_id

logger = logging.getLogger("visatrack.error")


class ErrorEnvelopeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception(
                "unhandled_error path=%s method=%s request_id=%s",
                request.url.path,
                request.method,
                current_request_id(),
            )
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Internal server error",
                    "request_id": current_request_id(),
                },
            )
