# Exit on any error
$ErrorActionPreference = "Stop"

Write-Host "Starting VisaTrack local development environment..." -ForegroundColor Cyan

# Resolve project root
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$LOG_DIR = Join-Path $PROJECT_ROOT ".logs"

function Find-Python {
    $pythonCommands = @("python3", "python", "py")
    foreach ($cmd in $pythonCommands) {
        $pythonPath = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($pythonPath) {
            return $pythonPath.Source
        }
    }
    Write-Host "Python is not installed or not on PATH." -ForegroundColor Red
    exit 1
}

function Test-PythonInstall {
    param([string]$pythonExe)

    $pythonDir = Split-Path -Parent $pythonExe
    $libDir = Join-Path $pythonDir "Lib"

    if (-not (Test-Path $libDir)) {
        Write-Host "Detected an incomplete Python installation at $pythonExe" -ForegroundColor Red
        Write-Host "Missing standard library folder: $libDir" -ForegroundColor Red
        Write-Host "Install the full CPython distribution from python.org and ensure it is first on PATH, then rerun this script." -ForegroundColor Yellow
        return $false
    }

    return $true
}

function Test-DatabaseUrl {
    param([string]$url)
    return $url -match '^postgresql://[^:]+:[^@]+@[^:]+:[0-9]+/.+'
}

# Load .env file
$envFile = Join-Path $PROJECT_ROOT ".env"
$envExample = Join-Path $PROJECT_ROOT ".env.example"

if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Write-Host ".env not found; copying from .env.example."
    Copy-Item $envExample $envFile
}

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Create log directory
New-Item -ItemType Directory -Force -Path $LOG_DIR | Out-Null

# Validate DATABASE_URL
$DATABASE_URL = $env:DATABASE_URL
if (-not $DATABASE_URL) {
    Write-Host "DATABASE_URL is not set. Copy .env.example to .env and fill in your credentials." -ForegroundColor Red
    exit 1
}

if (-not (Test-DatabaseUrl $DATABASE_URL)) {
    Write-Host "DATABASE_URL appears to be malformed: $DATABASE_URL" -ForegroundColor Red
    Write-Host "Expected format: postgresql://user:password@host:port/dbname"
    exit 1
}

# Extract DB host
if ($DATABASE_URL -match '@([^:]+):') {
    $DB_HOST = $matches[1]
    Write-Host "Using remote PostgreSQL at ${DB_HOST}; skipping local PostgreSQL startup."
}

Write-Host "Starting backend..." -ForegroundColor Cyan
$backendDir = Join-Path $PROJECT_ROOT "backend"
Set-Location $backendDir

# Create venv if it doesn't exist
$venvDir = Join-Path $backendDir ".venv"
if (-not (Test-Path $venvDir)) {
    Write-Host "Creating Python virtual environment..."
    $PYTHON_BIN = Find-Python
    if (-not (Test-PythonInstall $PYTHON_BIN)) {
        exit 1
    }
    & $PYTHON_BIN -m venv .venv
}

# Activate venv and find Python
$venvPython = Join-Path $venvDir "Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Could not locate the backend Python executable." -ForegroundColor Red
    exit 1
}

$venvProbe = & $venvPython -c "import sys; print(sys.version)" 2>&1 | Out-String
if ($venvProbe -match "Could not find platform independent libraries <prefix>") {
    Write-Host "The backend virtual environment is based on an incomplete Python installation." -ForegroundColor Red
    Write-Host "Install full CPython from python.org, remove backend/.venv, and rerun scripts/dev.ps1." -ForegroundColor Yellow
    exit 1
}

# Sync dependencies
Write-Host "Syncing backend dependencies..."
& $venvPython -m pip install --upgrade pip --quiet
& $venvPython -m pip install --quiet -r requirements.txt

$reqDev = Join-Path $backendDir "requirements-dev.txt"
if (Test-Path $reqDev) {
    & $venvPython -m pip install --quiet -r requirements-dev.txt
}

Write-Host "Backend venv ready" -ForegroundColor Green
$env:PYTHONPATH = "."

# Test database connection
Write-Host "Testing database connection..."
$dbTestScript = @"
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
"@

$dbTestScript | & $venvPython -
if ($LASTEXITCODE -ne 0) { exit 1 }

# Run migrations
Write-Host "Running database migrations..."
& $venvPython -m alembic upgrade head

# Start backend server
$BACKEND_LOG = Join-Path $LOG_DIR "backend-dev.log"
$FRONTEND_LOG = Join-Path $LOG_DIR "frontend-dev.log"
$FRONTEND_ERR_LOG = Join-Path $LOG_DIR "frontend-dev.err.log"

Write-Host "Starting backend server..." -ForegroundColor Cyan
$backendCmd = "& '$venvPython' -m uvicorn app.main:app --reload > '$BACKEND_LOG' 2>&1"
$backendJob = Start-Process -FilePath powershell -ArgumentList "-NoProfile", "-Command", $backendCmd -NoNewWindow -PassThru

# Wait for backend to become healthy
Write-Host "Waiting for backend to become healthy..."
$deadline = (Get-Date).AddSeconds(30)
$healthy = $false

while ((Get-Date) -lt $deadline) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $healthy) {
    Write-Host "Backend did not become healthy within 30 seconds." -ForegroundColor Red
    Write-Host "Backend log:"
    Get-Content $BACKEND_LOG -Tail 50
    Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "Backend is healthy!" -ForegroundColor Green

# Prepare frontend
Write-Host "Preparing frontend..." -ForegroundColor Cyan
$frontendDir = Join-Path $PROJECT_ROOT "frontend"
Set-Location $frontendDir

$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Host "npm.cmd was not found on PATH. Ensure Node.js is installed and restart your terminal." -ForegroundColor Red
    Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# Install dependencies
Write-Host "Syncing frontend dependencies..."
& $npmCmd.Source install --silent

# Clean build cache
Write-Host "Cleaning build cache..."
$nextDir = Join-Path $frontendDir ".next"
if (Test-Path $nextDir) {
    Remove-Item -Recurse -Force $nextDir
}

# Start frontend server
Write-Host "Frontend ready, launching..." -ForegroundColor Cyan
$frontendJob = Start-Process -FilePath $npmCmd.Source -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -RedirectStandardOutput $FRONTEND_LOG -RedirectStandardError $FRONTEND_ERR_LOG -NoNewWindow -PassThru

Write-Host "`nVisaTrack is running" -ForegroundColor Green
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "`nPress CTRL+C to stop all services" -ForegroundColor Yellow

# Wait and handle cleanup
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`nStopping services..." -ForegroundColor Yellow
    Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Services stopped." -ForegroundColor Green
}
