#!/bin/bash

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

if [ ! -d "venv" ]; then
  echo "❌ Python venv not found. Run backend setup first."
  exit 1
fi

source venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload &

BACKEND_PID=$!

# ---- Frontend ----
echo "🌐 Starting frontend..."
cd "${PROJECT_ROOT}/frontend" || exit
# Avoid stale Next.js/Turbopack artifacts on first load in local dev.
rm -rf .next
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
