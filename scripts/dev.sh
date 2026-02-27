#!/bin/bash

# exit on any error, undefined variable, or pipeline failure
set -euo pipefail

echo "🚀 Starting VisaTrack local development environment..."

# Resolve project root from this script's location so it works from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---- Start PostgreSQL ----
echo "🗄️  Ensuring PostgreSQL is running..."
brew services start postgresql >/dev/null 2>&1 || true

# ---- Backend ----
echo "🐍 Starting backend..."
cd "${PROJECT_ROOT}/backend" || exit

# create virtual environment and install dependencies if needed
if [ ! -d ".venv" ]; then
  echo "⚙️  Creating Python virtual environment and installing dependencies..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
  # install dev requirements too so tests/migrations work
  if [ -f requirements-dev.txt ]; then
    pip install -r requirements-dev.txt
  fi
else
  source .venv/bin/activate
fi

echo "🐍 Backend venv ready"
# extend PYTHONPATH safely (empty if unset)
export PYTHONPATH="${PYTHONPATH:-}:."

# ensure there is an .env file (copy example automatically)
if [ ! -f "../.env" ] && [ -f "../.env.example" ]; then
  echo "⚠️  .env not found; copying from .env.example."
  echo "    Please review and update credentials before running again."
  cp ../.env.example ../.env
fi
if [ -f "../.env" ]; then
  # shellcheck disable=SC1090
  set -a
  source ../.env
  set +a
fi

# ensure DATABASE_URL is configured so alembic can connect
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set. Copy .env.example to .env and fill in your credentials."
  exit 1
fi

# basic validation: require user, password, host, port, and database name
# a valid example is postgresql://user:password@host:5432/dbname
if ! echo "$DATABASE_URL" | grep -qE '^postgresql://[^:]+:[^@]+@[^:]+:[0-9]+/.+'; then
  echo "❌ DATABASE_URL appears to be malformed: $DATABASE_URL"
  echo "   Expected format: postgresql://user:password@host:port/dbname"
  exit 1
fi

# try to make a quick connection and report a clean error if it fails
if ! python - <<'PYCODE'
import os, sys
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

url = os.getenv("DATABASE_URL")
try:
    engine = create_engine(url)
    with engine.connect():
        pass
except OperationalError as e:
    print("❌ Failed to connect to database:", e.orig)
    sys.exit(1)
except Exception as e:
    print("❌ Error validating DATABASE_URL:", e)
    sys.exit(1)
PYCODE
then
  exit 1
fi

alembic upgrade head
uvicorn app.main:app --reload &

BACKEND_PID=$!

# ---- Frontend ----
echo "🌐 Preparing frontend..."
cd "${PROJECT_ROOT}/frontend" || exit

# install node dependencies if necessary
if [ ! -d "node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  npm install
fi

# Avoid stale Next.js/Turbopack artifacts on first load in local dev.
rm -rf .next

echo "🌐 Frontend ready, launching..."
npm run dev &

FRONTEND_PID=$!

# ---- Info ----
echo "✅ VisaTrack is running"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press CTRL+C to stop all services"

# ---- Graceful shutdown ----
trap "kill $BACKEND_PID $FRONTEND_PID" SIGINT
wait
