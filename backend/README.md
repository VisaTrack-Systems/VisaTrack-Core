# Backend - VisaTrack

This directory contains the backend API for VisaTrack, built using FastAPI and Python.

The backend is responsible for:

- Authentication and authorization
- Business logic
- Database interactions
- File metadata handling
- API endpoints consumed by the frontend

---

## Reading the Code (Where to Start)

**New to the codebase?** Read these files in order (~20 minutes):

1. **[app/main.py](app/main.py)** (~20 lines) - Application entry point and middleware
2. **[app/api/router.py](app/api/router.py)** (~15 lines) - All endpoints aggregated here
3. **[app/core/security.py](app/core/security.py)** (~130 lines) - JWT tokens and password hashing
4. **[app/api/routes/auth.py](app/api/routes/auth.py)** (~350 lines, skim) - Login/token endpoints
5. **[app/services/rbac.py](app/services/rbac.py)** (~175 lines) - Role-based access control
6. **[tests/conftest.py](tests/conftest.py)** (~60 lines) - Test fixtures and patterns

Then explore by feature:
- **Case Management**: `app/api/routes/cases.py` + `app/models/case.py`
- **Document Storage**: `app/services/storage.py`
- **Audit Trail**: `app/services/audit.py`
- **Permissions**: `app/api/deps/auth.py`

📖 **Full guide with diagrams**: See [../CODEBASE_TOUR.md](../CODEBASE_TOUR.md)

---

## Project Structure at a Glance

```
app/
├── main.py              → FastAPI app initialization
├── api/
│   ├── router.py       → Central endpoint aggregation point
│   ├── routes/         → Domain-specific endpoints (auth, cases, users, admin, etc.)
│   │   ├── auth.py     → Login, token refresh, signup
│   │   ├── cases.py    → Case CRUD, documents, milestones
│   │   ├── users.py    → User management
│   │   ├── admin.py    → System administration
│   │   └── ...
│   └── deps/           → Dependency injection (auth, database)
├── core/
│   ├── config.py       → Environment variables and settings
│   └── security.py     → JWT, password hashing, cryptography
├── db/
│   ├── session.py      → Database engine and session factory
│   ├── base.py         → SQLAlchemy ORM declarative base
│   └── deps.py         → Database dependency injection
├── models/             → ORM models (users, cases, orgs, etc.)
├── schemas/            → Pydantic validation schemas
├── services/           → Business logic (RBAC, audit, storage)
└── tests/              → Pytest test suite

alembic/                → Database migration scripts
```

---

## Tech Stack

- Python
- FastAPI
- SQLAlchemy (ORM)
- PostgreSQL
- Alembic (migrations)

---

## Structure Overview

- `app/main.py` - FastAPI application entry point
- `app/api/` - API route definitions
- `app/models/` - Database models (place your `SQLAlchemy` models
  here; a simple `Test` model is included as a starting point)
- `app/schemas/` - Pydantic request/response schemas
- `app/services/` - Business logic layer
- `app/db/` - Database session and base configuration
- `alembic/` - Database migrations

---

## Running the Backend Locally

```bash
cd backend/
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# configure your database URL (copy example and edit credentials)
# e.g. from project root: `cp ../.env.example ../.env`
# the dev script and Alembic will load this file automatically.  The
# script will also verify that the URL is well-formed and attempt a
# quick connection before running migrations, so errors are raised
# early with a concise message.

uvicorn app.main:app --reload
```

Backend will be available at:

```text
http://localhost:8000
```

---

## Database Migrations

Apply migrations:

```bash
alembic upgrade head
```

Create a new migration:

```bash
alembic revision --autogenerate -m "migration message"
```

---

## Tests

Install dev dependencies and run tests:

```bash
pip install -r requirements-dev.txt
pytest
```

---

## Notes

- The backend is the source of truth for all data
- All database schema changes must go through Alembic migrations
- Files themselves are not stored in the database (metadata only)
