# backend/app/models

This directory contains SQLAlchemy ORM model classes representing the application's persistent entities as Python classes. Each model corresponds to a database table, defining columns with type hints, relationships to other entities, and validation constraints at the ORM level, enabling type-safe database interactions and automatic query building through the SQLAlchemy declarative API.

## Overview

- **[case.py](case.py)** - Case entity with status, dates, type, priority, and relationships to organization, client, and lawyer
- **[organization.py](organization.py)** - Organization (tenant) entity for multi-tenant support
- **[user.py](user.py)** - User account entity with identification, authentication, and profile details
- **[role.py](role.py)** - Role definition for RBAC with permission sets
- **[user_role.py](user_role.py)** - User-to-role assignment mapping
- **[milestone.py](milestone.py)** - Milestone entities tracking case progression and key dates
- **[case_client.py](case_client.py)** - Case-to-client associations
- **[user_profile.py](user_profile.py)** - Extended user profile information
- **[user_invitation.py](user_invitation.py)** - Pending user invitation records
- **[test.py](test.py)** - Test/specification model (may represent case requirements or test cases)

## Key Files

- [case.py](case.py) - Core case model with UUID primary key, foreign keys to organization/client/lawyer, status tracking
- [organization.py](organization.py) - Organization/tenant model with relationships to users and cases
- [role.py](role.py) - Role model with permission configuration (likely JSONB for flexible permission sets)
- [__init__.py](__init__.py) - Model exports and Base class configuration

## Getting Started

Models inherit from [../db/base.py](../db/base.py) which provides the SQLAlchemy declarative base. Use models in service and route layers to query, create, update, and delete database records via the session object injected as a dependency. Review [case.py](case.py) as a reference for the typical model structure including column definitions, relationships, and type hints.

## Related Documentation

- See [../db/base.py](../db/base.py) for the ORM base class and session configuration
- See [../schemas/](../schemas/) for corresponding Pydantic validation models
- See [../../Database/](../../Database/) for the underlying SQL schema definitions
