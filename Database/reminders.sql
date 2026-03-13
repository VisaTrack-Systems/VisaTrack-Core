CREATE TABLE reminders (
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

CREATE INDEX idx_reminders_case_sent_at ON reminders(case_id, sent_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_reminders_client_visibility ON reminders(client_user_id, read_at) WHERE visible_to_client = TRUE AND deleted_at IS NULL;
CREATE INDEX idx_reminders_org_created_at ON reminders(organization_id, created_at DESC) WHERE deleted_at IS NULL;
