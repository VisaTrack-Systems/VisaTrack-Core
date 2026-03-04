CREATE TABLE activity_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    
    -- Actor
    user_id         UUID REFERENCES users(id),
    user_type       VARCHAR(50),  -- user, system, client
    
    -- Action
    action          VARCHAR(100) NOT NULL,  -- created, updated, deleted, viewed, downloaded, etc.
    entity_type     VARCHAR(100) NOT NULL,  -- case, document, payment, message, etc.
    entity_id       UUID,
    
    -- Context
    case_id         UUID REFERENCES cases(id) ON DELETE SET NULL,  -- If related to a case
    client_id       UUID REFERENCES users(id) ON DELETE SET NULL,  -- If related to a client
    
    -- Details
    old_values      JSONB,
    new_values      JSONB,
    metadata        JSONB,  -- Additional context
    
    -- Request info
    ip_address      INET,
    user_agent      TEXT,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_org ON activity_log(organization_id, created_at DESC);
CREATE INDEX idx_activity_user ON activity_log(user_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_case ON activity_log(case_id, created_at DESC);
