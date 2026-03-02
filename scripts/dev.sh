#!/bin/bash

# exit on any error, undefined variable, or pipeline failure
set -euo pipefail

echo "Starting VisaTrack local development environment..."

# Resolve project root from this script's location so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/.logs"

find_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return
  fi

  if command -v python >/dev/null 2>&1; then
    command -v python
    return
  fi

  echo "Python is not installed or not on PATH."
  exit 1
}

activate_venv() {
  if [ -f ".venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/bin/activate
    return
  fi

  if [ -f ".venv/Scripts/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/Scripts/activate
    return
  fi

  echo "Could not locate the backend virtualenv activation script."
  exit 1
}

resolve_backend_python() {
  if [ -x ".venv/bin/python" ]; then
    printf '%s\n' ".venv/bin/python"
    return
  fi

  if [ -x ".venv/Scripts/python.exe" ]; then
    printf '%s\n' ".venv/Scripts/python.exe"
    return
  fi

  echo "Could not locate the backend Python executable."
  exit 1
}

extract_db_host() {
  local db_url="$1"
  printf '%s' "$db_url" | sed -E 's#^postgresql://[^@]+@\[?([^]/:]+)\]?:[0-9]+/.*#\1#'
}

ensure_local_postgres() {
  echo "Ensuring PostgreSQL is running..."

  if command -v brew >/dev/null 2>&1; then
    brew services start postgresql >/dev/null 2>&1 || true
    return
  fi

  if command -v psql >/dev/null 2>&1; then
    echo "Local PostgreSQL startup is not automated on this platform. Ensure the PostgreSQL service is already running."
    return
  fi

  echo "Local PostgreSQL tooling was not found. If you intend to use a local database, start PostgreSQL manually before continuing."
}

if [ ! -f "${PROJECT_ROOT}/.env" ] && [ -f "${PROJECT_ROOT}/.env.example" ]; then
  echo ".env not found; copying from .env.example."
  cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
fi

if [ -f "${PROJECT_ROOT}/.env" ]; then
  # shellcheck disable=SC1090
  set -a
  source "${PROJECT_ROOT}/.env"
  set +a
fi

mkdir -p "${LOG_DIR}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Copy .env.example to .env and fill in your credentials."
  exit 1
fi

if ! echo "$DATABASE_URL" | grep -qE '^postgresql://[^:]+:[^@]+@[^:]+:[0-9]+/.+'; then
  echo "DATABASE_URL appears to be malformed: $DATABASE_URL"
  echo "Expected format: postgresql://user:password@host:port/dbname"
  exit 1
fi

DB_HOST="$(extract_db_host "$DATABASE_URL")"
case "$DB_HOST" in
  localhost|127.0.0.1|::1)
    ensure_local_postgres
    ;;
  *)
    echo "Using remote PostgreSQL at ${DB_HOST}; skipping local PostgreSQL startup."
    ;;
esac

echo "Starting backend..."
cd "${PROJECT_ROOT}/backend" || exit

# 1. Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  PYTHON_BIN="$(find_python)"
  "$PYTHON_BIN" -m venv .venv
fi

# 2. Always activate the venv
activate_venv
BACKEND_PYTHON="$(resolve_backend_python)"

# 3. Always sync dependencies (even if venv existed)
echo "Syncing backend dependencies..."
"$BACKEND_PYTHON" -m pip install --upgrade pip --quiet
"$BACKEND_PYTHON" -m pip install --quiet -r requirements.txt

if [ -f requirements-dev.txt ]; then
  "$BACKEND_PYTHON" -m pip install --quiet -r requirements-dev.txt
fi

echo "Backend venv ready"
BACKEND_PYTHON="${BACKEND_PYTHON:-$(resolve_backend_python)}"
export PYTHONPATH="${PYTHONPATH:-}:."

if ! "$BACKEND_PYTHON" - <<'PYCODE'
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

repo_root = Path.cwd().parent
load_dotenv(repo_root / ".env")
url = os.getenv("DATABASE_URL")

try:
    engine = create_engine(url)
    with engine.connect():
        pass
except OperationalError as e:
    print("Failed to connect to database:", e.orig)
    sys.exit(1)
except Exception as e:
    print("Error validating DATABASE_URL:", e)
    sys.exit(1)
PYCODE
then
  exit 1
fi

"$BACKEND_PYTHON" -m alembic upgrade head
BACKEND_LOG="${LOG_DIR}/backend-dev.log"
FRONTEND_LOG="${LOG_DIR}/frontend-dev.log"

"$BACKEND_PYTHON" -m uvicorn app.main:app --reload >"${BACKEND_LOG}" 2>&1 &
BACKEND_PID=$!

echo "Waiting for backend to become healthy..."
if ! "$BACKEND_PYTHON" - <<'PYCODE'
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

deadline = time.time() + 30
url = "http://127.0.0.1:8000/health"

while time.time() < deadline:
    try:
        with urlopen(url, timeout=2) as response:
            if response.status == 200:
                sys.exit(0)
    except URLError:
        time.sleep(1)

print("Backend did not become healthy within 30 seconds.")
sys.exit(1)
PYCODE
then
  echo "Backend log:"
  tail -n 50 "${BACKEND_LOG}" || true
  kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  exit 1
fi

echo "Preparing frontend..."
cd "${PROJECT_ROOT}/frontend" || exit

# 1. Ensure node_modules exists and is up to date
echo "Syncing frontend dependencies..."
if [ -f "package-lock.json" ]; then
  # npm ci is faster and cleaner for dev environments with a lockfile
  npm install --silent
else
  npm install --silent
fi

# 2. Clean up previous build artifacts
echo "Cleaning build cache..."
rm -rf .next

echo "Frontend ready, launching..."
npm run dev >"${FRONTEND_LOG}" 2>&1 &
FRONTEND_PID=$!

echo "VisaTrack is running"
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press CTRL+C to stop all services"

trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT
wait
