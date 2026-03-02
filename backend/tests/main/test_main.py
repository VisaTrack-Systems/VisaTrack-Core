from __future__ import annotations

from fastapi.middleware.cors import CORSMiddleware

from app.main import app


def test_main_app_has_cors_and_metadata():
    assert app.title == 'VisaTrack API'
    assert any(m.cls is CORSMiddleware for m in app.user_middleware)
