# Database

This directory contains the complete IRCC immigration system data model expressed as SQL schemas and versioned migrations. It defines the core relational structure for case management, user accounts, billing, documents, and activity tracking, supporting the application's multi-tenant architecture with role-based access control and comprehensive audit logging. The schema provides PostgreSQL-specific features including JSON data types, array columns, and UUID primary keys for secure, distributed system design.

## Overview

- **Core Schema Files** (~20 SQL files)
  - [users.sql](users.sql) - User account definitions with profile references
  - [organizations.sql](organizations.sql) - Multi-tenant organization structure
  - [cases.sql](cases.sql) - Case entity with status, dates, and complexity tracking
  - [roles.sql](roles.sql) - Role definitions for permission inheritance
  - [permissions.sql](permissions.sql) - Fine-grained permission matrix
  - [user_roles.sql](user_roles.sql) - Role assignment mapping
  - [case_clients.sql](case_clients.sql) - Case-to-client relationship tracking
  - [case_assignments.sql](case_assignments.sql) - User-to-case assignment records
  - [case_collaborators.sql](case_collaborators.sql) - Secondary collaborator assignments
  - [milestones.sql](milestones.sql) - Case milestone definitions and tracking
  - [documents.sql](documents.sql) - Document metadata and storage references

- **Financial Schema Files**
  - [invoices.sql](invoices.sql) - Invoice records for billing
  - [invoice_items.sql](invoice_items.sql) - Itemized invoice line items
  - [payments.sql](payments.sql) - Payment transaction history
  - [payment_methods.sql](payment_methods.sql) - Stored payment method definitions
  - [trust_account_entries.sql](trust_account_entries.sql) - Trust account ledger entries

- **Document & Template Management**
  - [document_suites.sql](document_suites.sql) - Document collection grouping
  - [document_templates.sql](document_templates.sql) - Reusable document templates
  - [document_access_log.sql](document_access_log.sql) - Document access audit trail
  - [case_documents.sql](case_documents.sql) - Case-to-document associations

- **Additional Features**
  - [activity_log.sql](activity_log.sql) - Comprehensive action and change audit log
  - [notifications.sql](notifications.sql) - User notification records
  - [reminders.sql](reminders.sql) - Task reminder scheduling
  - [user_invitations.sql](user_invitations.sql) - Pending user invitations
  - [user_profiles.sql](user_profiles.sql) - Extended user profile information

- **migrations/** directory
  - [2026_02_13_trust_account_hardening.sql](migrations/2026_02_13_trust_account_hardening.sql) - Trust account validation enhancements
  - [2026_03_08_reminders_migration.sql](migrations/2026_03_08_reminders_migration.sql) - Reminders feature implementation
  - [2026_03_13_mvp_status_consolidation.sql](migrations/2026_03_13_mvp_status_consolidation.sql) - Status field consolidation
  - [2026_03_14_drop_jurisdiction_and_visa_office.sql](migrations/2026_03_14_drop_jurisdiction_and_visa_office.sql) - Schema cleanup

## Key Files

- [setup_database.sql](setup_database.sql) - Baseline database initialization script
- [Info.txt](Info.txt) - Database schema documentation and notes

## Getting Started

Alembic is the authoritative migration runner. From `backend/`, run
`alembic upgrade head`; its baseline consumes the ordered schema files in this
directory before applying later revisions. Do not separately apply files under
`Database/migrations/` to an Alembic-managed database. Those files are retained
as historical migration records and are reconciled by Alembic revisions.

`setup_database.sql` remains available only for inspecting or manually
bootstrapping the historical baseline. Application deployments and automated
environments must use Alembic.

## Related Documentation

- See [../backend/README.md](../backend/README.md) for application-level documentation
- See [../backend/alembic/](../backend/alembic/) for programmatic migration management using SQLAlchemy Alembic
