# backend/app/api/deps

This directory contains FastAPI dependency injection functions that extract and validate request context, including authentication, database sessions, and authorization checks. Dependencies satisfy the FastAPI `Depends()` pattern, providing common parameters to route handlers while centralizing cross-cutting concerns like JWT validation and permission checking.

## ❓ Why "deps"?

Short for "dependencies"—FastAPI's term for injectable functions that provide values to route handlers. Think of it as a mini service locator that builds required objects (authenticated user, database session) before each request. This naming is standard FastAPI convention found in official documentation.

## Overview

- **[auth.py](auth.py)** - JWT token validation, user extraction, and authentication context building; defines `AuthContext` dataclass and `get_auth_context()` dependency
- **[__init__.py](__init__.py)** - Module exports for dependency functions

## Key Files

- [auth.py](auth.py) - `get_auth_context()` dependency function (validates JWT bearer token, loads user from database, builds AuthContext with roles and permissions), `AuthContext` dataclass (encapsulates authenticated user information), role/permission requirement decorators like `require_roles()` and `require_permissions()`

## Getting Started

Import dependency functions from this module in route handlers. Example:

```python
from fastapi import Depends
from app.api.deps.auth import get_auth_context

@router.get("/protected-endpoint")
def protected_route(auth: AuthContext = Depends(get_auth_context)):
    # auth.user_id, auth.roles, auth.permissions available
    return {"user_id": auth.user_id}
```

Apply role/permission checks to restrict access:

```python
@router.get("/admin-only")
def admin_route(auth: AuthContext = Depends(require_roles("super_admin"))):
    # Only super_admin users can access
    pass
```

## Related Documentation

- See [../router.py](../router.py) for central router mounting all endpoints
- See [../routes/](../routes/) for route handlers using these dependencies
- See [../../core/security.py](../../core/security.py) for JWT token operations and password hashing
- FastAPI Dependency Injection: https://fastapi.tiangolo.com/tutorial/dependencies/

