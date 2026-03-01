CREATE TABLE permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(100) UNIQUE NOT NULL,  -- e.g., "cases:edit"
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    resource        VARCHAR(50) NOT NULL,  -- cases, clients, documents, etc.
    action          VARCHAR(50) NOT NULL,  -- view, create, edit, delete, approve
    scope           VARCHAR(50) DEFAULT 'organization'  -- own, organization, all
);

-- Permission audit log
CREATE TABLE permission_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,  -- GRANT, REVOKE, CHECK
    resource        VARCHAR(100) NOT NULL,
    resource_id     UUID,
    permission      VARCHAR(100),
    granted         BOOLEAN,
    context         JSONB,  -- IP, user agent, etc.
    created_at      TIMESTAMPTZ DEFAULT NOW()
);