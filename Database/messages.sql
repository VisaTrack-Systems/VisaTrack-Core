CREATE TABLE messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID REFERENCES cases(id) ON DELETE CASCADE,
    
    -- Sender/Recipient
    sender_id           UUID NOT NULL REFERENCES users(id),
    recipient_id        UUID REFERENCES users(id),  -- NULL for broadcast/announcements
    
    -- Message content
    subject             VARCHAR(255),
    body                TEXT NOT NULL,
    body_html           TEXT,  -- Sanitized HTML for rich text
    
    -- Threading
    parent_message_id   UUID REFERENCES messages(id),
    thread_id           UUID,  -- For grouping conversation threads
    
    -- Status
    is_draft            BOOLEAN DEFAULT FALSE,
    sent_at             TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    
    -- Attachments
    attachment_ids      UUID[],  -- References to case_documents
    
    -- Client portal visibility
    visible_to_client   BOOLEAN DEFAULT TRUE,
    
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_case ON messages(case_id) WHERE is_draft = FALSE;
CREATE INDEX idx_messages_recipient ON messages(recipient_id) WHERE read_at IS NULL;
CREATE INDEX idx_messages_thread ON messages(thread_id);