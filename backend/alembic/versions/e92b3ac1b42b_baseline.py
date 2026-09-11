"""baseline revision

Revision ID: e92b3ac1b42b
Revises:
Create Date: 2026-02-10 23:59:00.000000

"""

from pathlib import Path
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e92b3ac1b42b"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA_DIRECTORY = Path(__file__).resolve().parents[3] / "Database"
SCHEMA_FILES = (
    "organizations.sql",
    "users.sql",
    "user_profiles.sql",
    "roles.sql",
    "permissions.sql",
    "user_roles.sql",
    "user_invitations.sql",
    "cases.sql",
    "case_clients.sql",
    "case_assignments.sql",
    "case_collaborators.sql",
    "milestone_templates.sql",
    "milestones.sql",
    "document_suites.sql",
    "document_templates.sql",
    "case_documents.sql",
    "document_access_log.sql",
    "payment_methods.sql",
    "invoices.sql",
    "invoice_items.sql",
    "payments.sql",
    "client_accounts.sql",
    "trust_account_entries.sql",
    "reminders.sql",
    "notifications.sql",
    "activity_log.sql",
)

TABLES_IN_CREATION_ORDER = tuple(
    Path(file_name).stem for file_name in SCHEMA_FILES
)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    for file_name in SCHEMA_FILES:
        schema_path = SCHEMA_DIRECTORY / file_name
        if not schema_path.is_file():
            raise RuntimeError(f"Missing baseline schema file: {schema_path}")
        op.execute(schema_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    for table_name in reversed(TABLES_IN_CREATION_ORDER):
        op.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')
