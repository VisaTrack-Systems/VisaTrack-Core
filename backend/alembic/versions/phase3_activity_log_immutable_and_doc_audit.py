"""Phase 3: activity_log immutable + structured fields (SOC 2 privacy)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-02

- Make activity_log immutable: BEFORE UPDATE/DELETE raise exception.
- Add changed_fields TEXT[] and sensitivity_level TEXT.
- Preserve old_values/new_values (app redacts sensitive keys before insert).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(connection, table_name: str) -> bool:
    r = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :n"
        ),
        {"n": table_name},
    )
    return r.scalar() is not None


def _column_exists(connection, table_name: str, column_name: str) -> bool:
    r = connection.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table_name, "c": column_name},
    )
    return r.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "activity_log"):
        return

    if not _column_exists(conn, "activity_log", "changed_fields"):
        op.add_column(
            "activity_log",
            sa.Column("changed_fields", sa.ARRAY(sa.Text()), nullable=True),
        )
    if not _column_exists(conn, "activity_log", "sensitivity_level"):
        op.add_column(
            "activity_log",
            sa.Column("sensitivity_level", sa.String(50), nullable=True),
        )

    conn.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION activity_log_immutable()
            RETURNS TRIGGER AS $$
            BEGIN
                IF TG_OP = 'UPDATE' THEN
                    RAISE EXCEPTION 'activity_log is immutable: updates are not allowed';
                ELSIF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'activity_log is immutable: deletes are not allowed';
                END IF;
                RETURN NULL;
            END; $$ LANGUAGE plpgsql;
            """
        )
    )
    op.execute("DROP TRIGGER IF EXISTS trg_activity_log_immutable ON activity_log;")
    op.execute(
        """
        CREATE TRIGGER trg_activity_log_immutable
            BEFORE UPDATE OR DELETE ON activity_log
            FOR EACH ROW EXECUTE PROCEDURE activity_log_immutable();
        """
    )


def downgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "activity_log"):
        return

    op.execute("DROP TRIGGER IF EXISTS trg_activity_log_immutable ON activity_log;")
    op.execute("DROP FUNCTION IF EXISTS activity_log_immutable();")

    if _column_exists(conn, "activity_log", "changed_fields"):
        op.drop_column("activity_log", "changed_fields")
    if _column_exists(conn, "activity_log", "sensitivity_level"):
        op.drop_column("activity_log", "sensitivity_level")
