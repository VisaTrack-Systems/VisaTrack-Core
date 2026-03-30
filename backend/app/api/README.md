# backend/app/api

This directory defines the HTTP API layer, organizing all endpoints into logical route modules (auth, users, cases, organizations, etc.) aggregated through a central router. It implements FastAPI dependency injection for authentication, database session management, and request validation, providing RESTful endpoints that convert HTTP requests into service layer operations and return Pydantic-validated responses.

## Overview

- **[router.py](router.py)** - Central APIRouter aggregating all endpoint modules with `/api/v1` prefix
- **routes/** - Endpoint implementations organized by domain (auth.py, users.py, cases.py, organizations.py, admin.py, dashboard.py, lawyer.py, client.py, health.py)
- **deps/** - Dependency injection functions for authentication, database sessions, and request validation

## Key Files

- [router.py](router.py) - Main router configuration including all endpoint modules and prefix mounting
- [routes/auth.py](routes/auth.py) - Authentication endpoints (login, logout, token refresh)
- [routes/cases.py](routes/cases.py) - Case management endpoints (CRUD operations, status transitions)
- [routes/users.py](routes/users.py) - User account endpoints (profile, permissions management)
- [routes/organizations.py](routes/organizations.py) - Organization endpoints (multi-tenant operations)
- [routes/dashboard.py](routes/dashboard.py) - Dashboard data endpoints (statistics, recent activity)
- [deps/auth.py](deps/auth.py) - JWT token validation dependency for protected routes

## Getting Started

Endpoints are prefixed with `/api/v1` and are documented automatically by FastAPI's Swagger UI at `/docs`. Add new endpoints by creating route modules in [routes/](routes/) and including them in [router.py](router.py). Use dependency injection (see [deps/](deps/)) for authentication and database sessions on protected endpoints.

## Related Documentation

- See [../schemas/](../schemas/) for request/response validation models
- See [../services/](../services/) for business logic referenced by route handlers
- See [../core/security.py](../core/security.py) for JWT token operations
