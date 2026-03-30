# backend/app/schemas

This directory contains Pydantic model classes for request and response validation in the FastAPI application. Each schema defines the shape of data entering or leaving endpoints, providing runtime validation, serialization/deserialization, and automatic OpenAPI documentation for API consumers.

## Overview

- **[admin.py](admin.py)** - Admin panel request/response schemas
- **[auth.py](auth.py)** - Authentication request/response schemas (login, token response)
- **[case.py](case.py)** - Case creation, update, and detail response schemas
- **[client.py](client.py)** - Client profile schemas
- **[dashboard.py](dashboard.py)** - Dashboard endpoint response schemas (statistics, summaries)
- **[lawyer.py](lawyer.py)** - Lawyer-specific request/response schemas
- **[organization.py](organization.py)** - Organization creation and detail schemas
- **[user.py](user.py)** - User creation, update, and response schemas

## Key Files

- [auth.py](auth.py) - LoginRequest, TokenResponse, RefreshTokenRequest for authentication flow
- [case.py](case.py) - CaseCreate, CaseUpdate, CaseResponse for case management endpoints
- [user.py](user.py) - UserCreate, UserUpdate, UserResponse with role/permission details
- [dashboard.py](dashboard.py) - DashboardOverview, CaseListItem, StatsResponse for dashboard endpoints

## Getting Started

Use Pydantic schemas as type hints in FastAPI route handlers to automatically validate incoming JSON and serialize outgoing responses. For example, a POST endpoint for case creation would accept a CaseCreate schema and return a CaseResponse. Leverage BaseModel features like field validators and computed fields for complex validation logic beyond pure type checking.

## Related Documentation

- See [../api/routes/](../api/routes/) for schema usage in endpoint definitions
- See [../models/](../models/) for corresponding SQLAlchemy ORM classes
- FastAPI documentation: https://fastapi.tiangolo.com/tutorial/body/
