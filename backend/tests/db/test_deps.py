from __future__ import annotations

from app.db import deps


class DummySession:
    def __init__(self):
        self.closed = False
        self.rolled_back = False

    def close(self):
        self.closed = True

    def rollback(self):
        self.rolled_back = True


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


def test_get_db_rolls_back_failed_request(monkeypatch):
    session = DummySession()
    monkeypatch.setattr(deps, 'SessionLocal', lambda: session)

    generator = deps.get_db()
    next(generator)

    try:
        generator.throw(RuntimeError('request failed'))
    except RuntimeError:
        pass

    assert session.rolled_back is True
    assert session.closed is True
