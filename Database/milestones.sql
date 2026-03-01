CREATE TABLE milestones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    milestone_type      VARCHAR(100),  -- document_submission, filing, interview, decision, etc.
    
    -- Timeline
    planned_date        DATE,
    actual_date         DATE,
    due_date            DATE,
    
    -- Status
    status              VARCHAR(50) DEFAULT 'not_started',  -- not_started, in_progress, completed, blocked, skipped
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
    
    -- Dependencies
    depends_on          UUID[],  -- Array of milestone IDs that must complete first
    
    -- Visibility
    client_visible      BOOLEAN DEFAULT TRUE,
    auto_notify_client  BOOLEAN DEFAULT FALSE,
    
    -- Assignment
    assigned_to         UUID REFERENCES users(id),
    
    -- Notifications
    reminder_days       INTEGER[],  -- Send reminders X days before due_date: [7, 3, 1]
    last_reminder_sent  TIMESTAMPTZ,
    
    sort_order          INTEGER DEFAULT 0,
    
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    completed_by        UUID REFERENCES users(id),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_milestones_case ON milestones(case_id);
CREATE INDEX idx_milestones_status ON milestones(status) WHERE status != 'completed';
CREATE INDEX idx_milestones_due ON milestones(due_date) WHERE status IN ('not_started', 'in_progress', 'blocked');