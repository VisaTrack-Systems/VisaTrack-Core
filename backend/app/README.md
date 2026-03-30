# backend/app

This is the core FastAPI application server implementing the VisaTrack case management system. It organizes all business logic into layered modules: API endpoint definitions, SQLAlchemy ORM models, Pydantic validation schemas, database infrastructure, and business services, providing a clean separation of concerns and testable architecture for the immigration case management backend.

## Overview

- **[main.py](main.py)** - FastAPI application entry point with middleware and router initialization
- **core/** - Configuration, security infrastructure, and application settings
- **api/** - HTTP request routing, endpoint definitions, and dependency injection
- **models/** - SQLAlchemy ORM classes representing database entities
- **schemas/** - Pydantic request/response validation schemas
- **db/** - Database session management, connection pooling, and ORM configuration
- **services/** - Business logic layer including audit logging, RBAC, and document storage
- **requirements.txt** - Python package dependencies for the application

## Key Files

- [main.py](main.py) - FastAPI instance configuration, middleware setup, and router mounting
- [core/config.py](core/config.py) - Settings management and environment configuration
- [core/security.py](core/security.py) - Password hashing, JWT token generation/validation
- [api/router.py](api/router.py) - Central router aggregating all endpoint modules
- [db/session.py](db/session.py) - Database session factory and connection management

## Getting Started

Install dependencies with `pip install -r backend/requirements.txt`, configure environment variables in `.env`, then run the application with `uvicorn app.main:app`. The application structure follows FastAPI best practices: request routing through [api/router.py](api/router.py), business logic in [services/](services/), and data validation through [schemas/](schemas/).

## Related Documentation

- See [../README.md](../README.md) for backend setup and testing instructions
- See [core/](core/) for security and configuration details
- See [api/](api/) for endpoint structure and routing
