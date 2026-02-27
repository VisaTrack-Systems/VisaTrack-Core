# Scripts - VisaTrack

This directory contains helper scripts for local development and maintenance.

---

## Available Scripts

### `dev.sh`

Bootstraps and runs the full local development environment.  The
script runs in strict mode (`set -euo pipefail`), so any failure in the
setup steps will cause it to abort before starting services.  It will
automatically perform any one‑time setup steps before
starting services:

1. copy `.env.example` to `.env` if needed
2. create & populate a Python virtualenv for the backend and install
   both production and development requirements
3. install Node dependencies for the frontend if `node_modules` is
   missing

Once the environment is prepared it launches:

- PostgreSQL (via `brew services`)
- Backend API (FastAPI/uvicorn)
- Frontend web app (Next.js)

```bash
./scripts/dev.sh
```

---

## Notes

- Scripts are intended for developer convenience
- They assume required dependencies are already installed
- Scripts should not contain secrets or environment-specific credentials
