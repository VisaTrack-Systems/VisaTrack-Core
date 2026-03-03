# VisaTrack Scripts

Simple setup instructions for running VisaTrack locally.

## Windows (PowerShell)

### 1) Prerequisites
- Install **Node.js (LTS)** (includes `npm`)
- Install **Python 3.11+** from python.org (full installer)

### 2) Configure environment
From the repo root:

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
```

Edit `.env` and set your `DATABASE_URL`.

### 3) Start everything
From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

The script will:
- prepare backend virtual environment + dependencies
- run database migrations
- start backend on http://localhost:8000
- start frontend on http://localhost:3000

Stop services with `Ctrl+C`.

## Unix / macOS (bash or zsh)

### 1) Prerequisites
- Install **Node.js (LTS)** (includes `npm`)
- Install **Python 3.11+**

### 2) Configure environment
From the repo root:

```bash
cp -n .env.example .env
```

Edit `.env` and set your `DATABASE_URL`.

### 3) Start everything
From the repo root:

```bash
chmod +x ./scripts/dev.sh
./scripts/dev.sh
```

The script prepares dependencies, runs migrations, and launches backend + frontend.
Stop services with `Ctrl+C`.
