# Backend - VisaTrack

This directory contains the backend API for VisaTrack, built using FastAPI and Python.

The backend is responsible for:
- Authentication and authorization
- Business logic
- Database interactions
- File metadata handling
- API endpoints consumed by the frontend

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
- `app/models/` - Database models
- `app/schemas/` - Pydantic request/response schemas
- `app/services/` - Business logic layer
- `app/db/` - Database session and base configuration
- `alembic/` - Database migrations

---

## Running the Backend Locally

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend will be available at:

```
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

## Notes

- The backend is the source of truth for all data
- All database schema changes must go through Alembic migrations
- Files themselves are not stored in the database (metadata only)
