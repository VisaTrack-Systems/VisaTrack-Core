CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    type            VARCHAR(50) NOT NULL,  -- case_update, document_request, payment_due, milestone_reminder, reminder
    title           VARCHAR(255) NOT NULL,
    body            TEXT,
    
    -- Deep linking
    action_url      VARCHAR(500),
    action_type     VARCHAR(50),  -- navigate, download, etc.
    
    -- Status
    read_at         TIMESTAMPTZ,
    dismissed_at    TIMESTAMPTZ,
    
    -- Related entities
    case_id         UUID REFERENCES cases(id) ON DELETE SET NULL,
    document_id     UUID REFERENCES case_documents(id) ON DELETE SET NULL,
    payment_id      UUID REFERENCES payments(id) ON DELETE SET NULL,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id) WHERE read_at IS NULL AND dismissed_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);
