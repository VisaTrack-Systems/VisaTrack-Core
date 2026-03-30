"""API Dependencies Package: Exports dependency injection utilities for authentication and database access."""
from app.api.deps.auth import AuthContext, get_auth_context, require_permissions, require_roles

__all__ = ["AuthContext", "get_auth_context", "require_roles", "require_permissions"]
