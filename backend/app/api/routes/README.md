# backend/app/api/routes

This directory contains FastAPI router modules that define HTTP API endpoints for specific domains. Each module (auth.py, users.py, cases.py, etc.) implements a collection of related endpoints and is aggregated by the parent `router.py` to form the complete API surface. All endpoints use FastAPI dependency injection for authentication, database sessions, and request validation, converting HTTP requests into service layer operations and serializing Pydantic-validated responses.

## Overview

Each route module defines a `router: APIRouter` that groups related endpoints:

- **[auth.py](auth.py)** - Authentication endpoints: login, token refresh, logout, invitation acceptance, password changes, role switching
- **[users.py](users.py)** - User management endpoints: list users, create user profiles, manage user settings
- **[cases.py](cases.py)** - Case management endpoints: CRUD operations, status transitions, document handling, milestone tracking, appointment scheduling
- **[dashboard.py](dashboard.py)** - Dashboard data endpoints: statistics, recent activity, overview summaries for consultants
- **[admin.py](admin.py)** - Administration endpoints: organization management, user invitations, system-level operations
- **[lawyer.py](lawyer.py)** - Lawyer-specific endpoints: case workload, client management, case creation
- **[client.py](client.py)** - Client portal endpoints: case viewing, document submission, milestone tracking
- **[organizations.py](organizations.py)** - Organization endpoints: tenant management, settings
- **[health.py](health.py)** - Health check endpoints for service readiness and liveness probes

## Key Files

- [auth.py](auth.py) - `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/accept-invitation`
- [cases.py](cases.py) - `GET/POST /api/v1/cases`, `GET/PATCH /api/v1/cases/{id}`, `POST /api/v1/cases/{id}/documents`, `PATCH /api/v1/cases/{id}/status`
- [admin.py](admin.py) - `GET /api/v1/admin/overview`, `POST /api/v1/admin/users`, `POST /api/v1/admin/invitations`
- [dashboard.py](dashboard.py) - `GET /api/v1/dashboard/overview`
- [health.py](health.py) - `GET /health`, `GET /` (liveness probes)

## Getting Started

To add a new endpoint:

1. Create a new route module or add to existing one (e.g., `documents.py`)
2. Create an `APIRouter` with appropriate prefix and tags:
   ```python
   router = APIRouter(prefix="/documents", tags=["documents"])
   ```
3. Define route handlers using FastAPI decorators:
   ```python
   @router.get("/{id}")
   def get_document(id: UUID, auth: AuthContext = Depends(get_auth_context)):
       pass
   ```
4. Include the router in [../router.py](../router.py):
   ```python
   api_router.include_router(documents.router, prefix="/api/v1")
   ```

All endpoints are prefixed with `/api/v1` and automatically documented by FastAPI's Swagger UI at `/docs`.

## Related Documentation

- See [../router.py](../router.py) for main router configuration
- See [../deps/](../deps/) for authentication and dependency injection
- See [../../schemas/](../../schemas/) for request/response validation models
- See [../../services/](../../services/) for business logic
- FastAPI routing: https://fastapi.tiangolo.com/tutorial/bigger-applications/

