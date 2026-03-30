# backend/app/services

This directory implements the business logic layer, encapsulating domain-specific operations away from API endpoints and database models. It provides reusable service functions for critical operations like activity auditing, role-based access control enforcement, and document storage management, promoting code reuse and consistent application behavior.

## Overview

- **[audit.py](audit.py)** - Activity logging service for comprehensive audit trail; functions track user actions, entity changes, and system events in the activity_log table
- **[rbac.py](rbac.py)** - Role-based access control enforcement; functions verify user permissions and role assignments based on organization membership
- **[storage.py](storage.py)** - Document storage integration with AWS S3; handles file uploads, downloads, encryption, and presigned URL generation

## Key Files

- [audit.py](audit.py) - `log_activity()` function recording action, entity changes, and metadata to activity_log table with organization and user context
- [rbac.py](rbac.py) - `check_permission()` and `has_role()` functions enforcing access control based on user's assigned roles and permissions
- [storage.py](storage.py) - `upload_document()`, `download_document()` functions with S3 integration and KMS encryption support

## Getting Started

Import and call service functions from route handlers to perform business operations. For example, after creating a case, call `log_activity()` from [audit.py](audit.py) to record the action. Similarly, use [rbac.py](rbac.py) functions at the start of protected endpoints to enforce permission checks. Document uploads leveraging [storage.py](storage.py) should specify encryption parameters from [../core/config.py](../core/config.py).

## Related Documentation

- See [../api/routes/](../api/routes/) for service function calls in endpoint implementations
- See [../../Database/activity_log.sql](../../Database/activity_log.sql) for audit log schema
- See [../../Database/permissions.sql](../../Database/permissions.sql) for permission storage structure
