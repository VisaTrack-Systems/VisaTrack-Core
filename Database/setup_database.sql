-- VisaTrack schema bootstrap (PostgreSQL)
-- Run with:
--   psql -d <database_name> -f Database/setup_database.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

\ir organizations.sql
\ir users.sql
\ir user_profiles.sql

\ir roles.sql
\ir permissions.sql
\ir user_roles.sql
\ir user_invitations.sql

\ir cases.sql
\ir case_clients.sql
\ir case_assignments.sql
\ir case_collaborators.sql

\ir milestone_templates.sql
\ir milestones.sql

\ir document_suites.sql
\ir document_templates.sql
\ir case_documents.sql
\ir document_access_log.sql

\ir payment_methods.sql
\ir invoices.sql
\ir invoice_items.sql
\ir payments.sql
\ir client_accounts.sql
\ir trust_account_entries.sql

\ir reminders.sql
\ir notifications.sql
\ir activity_log.sql

COMMIT;
