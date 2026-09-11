from __future__ import annotations

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


VERSIONS_DIR = Path(__file__).resolve().parents[2] / "alembic" / "versions"


def _load_revision(file_name: str):
    spec = spec_from_file_location(file_name, VERSIONS_DIR / file_name)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_baseline_references_existing_schema_files():
    baseline = _load_revision("e92b3ac1b42b_baseline.py")

    assert baseline.SCHEMA_FILES
    assert len(baseline.SCHEMA_FILES) == len(
        set(baseline.SCHEMA_FILES)
    )
    assert all(
        (baseline.SCHEMA_DIRECTORY / file_name).is_file()
        for file_name in baseline.SCHEMA_FILES
    )


def test_reconciliation_revision_follows_existing_head():
    revision = _load_revision(
        "a41f0c9d2e77_reconcile_deprecated_columns.py"
    )

    assert revision.down_revision == "76b6cea54557"
