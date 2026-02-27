from __future__ import annotations

from app.db import deps


class DummySession:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


def test_get_db_yields_and_closes_session(monkeypatch):
    session = DummySession()
    monkeypatch.setattr(deps, 'SessionLocal', lambda: session)

    generator = deps.get_db()
    yielded = next(generator)
    assert yielded is session

    try:
        next(generator)
    except StopIteration:
        pass

    assert session.closed is True
