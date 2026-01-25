#!/bin/bash

echo "🚀 Starting VisaTrack local development environment..."

# ---- Start PostgreSQL ----
echo "🗄️  Ensuring PostgreSQL is running..."
brew services start postgresql >/dev/null 2>&1 || true

# ---- Backend ----
echo "🐍 Starting backend..."
cd backend || exit

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
cd ../frontend || exit
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
