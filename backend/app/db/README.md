# backend/app/db

This directory manages all database infrastructure for the FastAPI application, including session lifecycle management, dependency injection configuration, and SQLAlchemy ORM base class setup. It provides database connectivity and transactional session management while abstracting database details from business logic layers.

## ❓ Why "db"?

Short for "database"—this directory contains everything related to **database connectivity and setup**. It's the single point where the application connects to PostgreSQL and provides sessions to all routes and services.

## Overview

- **[session.py](session.py)** - SQLAlchemy engine and session factory configuration for PostgreSQL connection pooling
- **[base.py](base.py)** - SQLAlchemy declarative base class that ORM models inherit from
- **[deps.py](deps.py)** - FastAPI dependency injection functions providing database sessions to route handlers

## Key Files

- [session.py](session.py) - Engine configuration with connection pooling parameters (pool_size, max_overflow), session factory setup
- [base.py](base.py) - DeclarativeBase instance for SQLAlchemy ORM metadata; provides `__tablename__`, column mapping to all models
- [deps.py](deps.py) - `get_db()` dependency function yielding session instances to FastAPI routes, ensuring proper connection teardown

## Getting Started

The [deps.py](deps.py) module provides the `get_db()` dependency used throughout route handlers to access database sessions. For example: `def list_cases(db: Session = Depends(get_db))` injects a database session. The session is automatically committed or rolled back based on endpoint success/failure. Connection pooling is configured in [session.py](session.py) and managed transparently based on environment settings.

## Related Documentation

- See [../core/config.py](../core/config.py) for `DATABASE_URL` configuration
- See [../models/](../models/) for ORM models using the base class
- SQLAlchemy documentation: https://docs.sqlalchemy.org/
