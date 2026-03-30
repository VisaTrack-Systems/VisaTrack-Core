"""Test Support Utilities: Mock database result classes and fake objects for unit testing
without real database connections. Implements SQLAlchemy-compatible result interfaces.
"""

from __future__ import annotations

from types import SimpleNamespace


class FakeScalarResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class FakeResult:
    def __init__(self, rows=None, scalar_value=None):
        self._rows = rows or []
        self._scalar_value = scalar_value

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None

    def one(self):
        if len(self._rows) != 1:
            raise AssertionError(f"Expected exactly one row, found {len(self._rows)}")
        return self._rows[0]

    def mappings(self):
        return self

    def scalars(self):
        return FakeScalarResult(self._rows)

    def scalar_one(self):
        if self._scalar_value is not None:
            return self._scalar_value
        if not self._rows:
            raise AssertionError('No rows available for scalar_one()')
        return self._rows[0]


def row(**values):
    return SimpleNamespace(**values)
