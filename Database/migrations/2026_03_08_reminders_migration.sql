-- Migration: Replace client-lawyer messaging with one-way reminders
-- Date: 2026-03-08
--
-- Safe to run multiple times.

BEGIN;

CREATE TABLE IF NOT EXISTS reminders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id           UUID NOT NULL REFERENCES users(id),
    title               VARCHAR(255) NOT NULL,
    body                TEXT NOT NULL,
    sent_at             TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    acknowledged_at     TIMESTAMPTZ,
    visible_to_client   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_reminders_case_sent_at'
    ) THEN
        CREATE INDEX idx_reminders_case_sent_at ON reminders(case_id, sent_at DESC) WHERE deleted_at IS NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_reminders_client_visibility'
    ) THEN
        CREATE INDEX idx_reminders_client_visibility
            ON reminders(client_user_id, read_at)
            WHERE visible_to_client = TRUE AND deleted_at IS NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_reminders_org_created_at'
    ) THEN
        CREATE INDEX idx_reminders_org_created_at
            ON reminders(organization_id, created_at DESC)
            WHERE deleted_at IS NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.messages') IS NOT NULL THEN
        INSERT INTO reminders (
            id,
            case_id,
            organization_id,
            client_user_id,
            sender_id,
            title,
            body,
            sent_at,
            read_at,
            visible_to_client,
            created_at,
            updated_at
        )
        SELECT
            m.id,
            m.case_id,
            c.organization_id,
            c.client_id,
            m.sender_id,
            COALESCE(NULLIF(BTRIM(m.subject), ''), 'Case Reminder'),
            m.body,
            m.sent_at,
            m.read_at,
            COALESCE(m.visible_to_client, TRUE),
            COALESCE(m.created_at, NOW()),
            COALESCE(m.updated_at, NOW())
        FROM messages m
        JOIN cases c ON c.id = m.case_id
        WHERE COALESCE(m.is_draft, FALSE) = FALSE
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Migrate case portal permissions payloads from messaging -> reminders.
WITH cases_to_update AS (
    SELECT
        id,
        CASE
            WHEN LOWER(COALESCE(custom_fields->'portal_permissions'->>'messaging', '')) = 'disabled' THEN 'disabled'
            ELSE 'enabled'
        END AS reminders_value
    FROM cases
    WHERE
        custom_fields IS NOT NULL
        AND custom_fields ? 'portal_permissions'
        AND (custom_fields->'portal_permissions') ? 'messaging'
)
UPDATE cases c
SET
    custom_fields = jsonb_set(
        c.custom_fields #- '{portal_permissions,messaging}',
        '{portal_permissions,reminders}',
        to_jsonb(cu.reminders_value),
        TRUE
    ),
    updated_at = NOW()
FROM cases_to_update cu
WHERE c.id = cu.id;

-- Normalize role permissions from message-* to reminder-*.
UPDATE roles
SET permissions = (
    REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(permissions::text, '"messages:send"', '"reminders:create"'),
                '"messages:view"', '"reminders:view"'
            ),
            '"own_messages:send"', '"own_reminders:acknowledge"'
        ),
        '"own_messages:view"', '"own_reminders:view"'
    )::jsonb
)
WHERE
    permissions::text LIKE '%"messages:%'
    OR permissions::text LIKE '%"own_messages:%';

COMMIT;
