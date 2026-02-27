CREATE TABLE case_clients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    client_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type   VARCHAR(50) DEFAULT 'primary', -- primary, dependent, sponsor, etc.
    status              VARCHAR(50) DEFAULT 'active',
    invited_by          UUID REFERENCES users(id),
    invited_at          TIMESTAMPTZ DEFAULT NOW(),
    removed_at          TIMESTAMPTZ,

    UNIQUE(case_id, client_user_id)
);

CREATE INDEX idx_case_clients_case ON case_clients(case_id) WHERE removed_at IS NULL;
CREATE INDEX idx_case_clients_client ON case_clients(client_user_id) WHERE removed_at IS NULL;
