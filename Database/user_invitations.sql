CREATE TABLE user_invitations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    role_slug       VARCHAR(100) NOT NULL,
    token_hash      VARCHAR(128) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    invited_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(token_hash)
);

CREATE INDEX idx_user_invitations_org ON user_invitations(organization_id, created_at DESC);
CREATE INDEX idx_user_invitations_user ON user_invitations(user_id, created_at DESC);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
