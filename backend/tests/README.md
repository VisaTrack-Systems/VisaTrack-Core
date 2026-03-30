# backend/tests

This directory contains the pytest test suite for the VisaTrack backend API, organized to mirror the source code structure under `app/`. Tests verify API endpoints, business logic, database models, and service layer functionality using fixtures for database setup, mocked dependencies, and authentication context.

## Overview

Test organization mirrors source structure:

- **[api/](api/)** - Endpoint route handler tests
  - `routes/` - Tests for each route module (auth, cases, users, admin, dashboard, etc.)
  - `deps/` - Tests for dependency injection functions
  - `test_router.py` - Main router configuration tests
- **[services/](services/)** - Business logic tests
  - `test_audit.py` - Activity logging service tests
  - `test_rbac.py` - Role-based access control tests
  - `test_storage.py` - Document storage integration tests
- **[models/](models/)** - ORM model tests
  - `test_models_smoke.py` - Basic model instantiation and relationship tests
- **[db/](db/)** - Database layer tests
  - `test_deps.py` - Database session dependency tests
- **[schemas/](schemas/)** - Pydantic validation tests
  - `test_schema_smoke.py` - Schema serialization/deserialization tests
- **[main/](main/)** - Application initialization tests
  - `test_main.py` - FastAPI app setup and middleware tests

## Key Files

- [conftest.py](conftest.py) - pytest fixtures for users, auth contexts, database sessions, and mock data generation
- [support.py](support.py) - Test utilities (fake database result classes, mock object builders)
- Each test file follows naming convention `test_*.py` and lives in a subdirectory matching the source structure

## Getting Started

Run all tests:
```bash
cd backend/
pytest
```

Run specific test file:
```bash
pytest tests/api/routes/test_cases.py
```

Run with coverage:
```bash
pytest --cov=app --cov-report=html
```

Write a new test using fixtures:
```python
from tests.conftest import make_user

def test_create_case(make_user):
    user = make_user(email="lawyer@example.com")
    # Test code here
```

## Testing Patterns

- **Database Isolation**: Each test gets a fresh transaction rolled back after execution (via fixtures)
- **Authentication**: `make_auth_context()` fixture creates authenticated requests
- **Mocking**: External services (S3, email) use mock implementations
- **Assertions**: Use pytest assertions for clarity

## Related Documentation

- See [../../app/](../../app/) for source code being tested
- Pytest documentation: https://docs.pytest.org/
- FastAPI testing: https://fastapi.tiangolo.com/tutorial/testing/

