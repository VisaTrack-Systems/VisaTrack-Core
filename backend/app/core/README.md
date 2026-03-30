# backend/app/core

This directory houses the application's foundational infrastructure for configuration management and security operations. It provides centralized settings management via environment variables, JWT token generation and validation for stateless authentication, and cryptographic password handling using industry-standard algorithms suitable for securing user credentials in a multi-tenant legal technology environment.

## ❓ Why "core"?

This directory contains the **core infrastructure that all other modules depend on**—configuration settings, security utilities, and foundational operations. Think of it as the "foundation" that the rest of the application is built upon.

## Overview

- **[config.py](config.py)** - Settings class managing all environment configuration (database URL, API keys, authentication parameters, AWS S3/KMS settings)
- **[security.py](security.py)** - Cryptographic utilities for password hashing (scrypt), JWT token creation/validation, and secret key generation

## Key Files

- [config.py](config.py) - Environment-driven configuration with sensible defaults; provides `settings` singleton for database URL, auth secrets, S3 credentials, and timeouts
- [security.py](security.py) - Password hashing with `hash_password()`, JWT operations with `create_access_token()` and `decode_token()`, secure `generate_token()` for invitations

## Getting Started

Define environment variables in a `.env` file at the repository root (referenced by [config.py](config.py)). Key variables include `DATABASE_URL`, `AUTH_SECRET_KEY`, `FRONTEND_ORIGIN`, and AWS credentials. The [security.py](security.py) module is leveraged throughout the application for password validation during login and JWT verification on protected endpoints.

## Related Documentation

- See [../](../) for how these settings integrate with the application
- See [../api/deps/](../api/deps/) for JWT authentication dependency injection
- See [../../Database/users.sql](../../Database/users.sql) for password storage schema
