"""Guards the container start contract that hosted platforms depend on."""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
START_SCRIPT = BACKEND_ROOT / "scripts" / "start.sh"
DOCKERFILE = BACKEND_ROOT / "Dockerfile"
RAILWAY_CONFIG = BACKEND_ROOT / "railway.json"


def test_start_script_is_executable():
    mode = START_SCRIPT.stat().st_mode

    assert mode & stat.S_IXUSR
    assert os.access(START_SCRIPT, os.X_OK)


def test_start_script_binds_assigned_port():
    script = START_SCRIPT.read_text(encoding="utf-8")

    assert 'cd "$(dirname "$0")/.."' in script
    assert 'port="${PORT:-8000}"' in script
    assert '--port "${port}"' in script
    assert "exec uvicorn" in script


def test_start_script_serves_ipv4_unless_overridden():
    script = START_SCRIPT.read_text(encoding="utf-8")

    assert '--host "${host}"' in script
    assert 'host="${HOST:-0.0.0.0}"' in script


def test_start_script_applies_migrations_before_serving():
    script = START_SCRIPT.read_text(encoding="utf-8")

    assert script.index("alembic upgrade head") < script.index("exec uvicorn")


def test_migrations_are_opt_in():
    script = START_SCRIPT.read_text(encoding="utf-8")

    assert '"${RUN_MIGRATIONS:-false}" = "true"' in script


def test_dockerfile_runs_start_script():
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")

    assert 'CMD ["/app/scripts/start.sh"]' in dockerfile
    assert "--port" not in dockerfile


def test_railway_config_gates_rollout_on_process_liveness():
    config = json.loads(RAILWAY_CONFIG.read_text(encoding="utf-8"))

    assert config["build"]["builder"] == "DOCKERFILE"
    assert config["build"]["dockerfilePath"] == "Dockerfile"
    assert config["deploy"]["healthcheckPath"] == "/health/live"
    assert config["deploy"]["healthcheckTimeout"] >= 60


def test_configured_health_check_path_is_served():
    from app.main import app

    config = json.loads(RAILWAY_CONFIG.read_text(encoding="utf-8"))

    assert config["deploy"]["healthcheckPath"] in app.openapi()["paths"]


def test_procfile_uses_start_script():
    procfile = (BACKEND_ROOT / "Procfile").read_text(encoding="utf-8")

    assert "scripts/start.sh" in procfile
