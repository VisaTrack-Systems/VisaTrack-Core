CREATE TABLE case_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
    lawyer_id       UUID REFERENCES users(id),
    role            VARCHAR(50) DEFAULT 'associate',  -- lead, associate, paralegal, consultant
    assigned_at     TIMESTAMPTZ DEFAULT NOW(),
    assigned_by     UUID REFERENCES users(id),
    removed_at      TIMESTAMPTZ,
    removal_reason  TEXT
);

CREATE UNIQUE INDEX uq_case_assignments_active_lawyer
    ON case_assignments(case_id, lawyer_id)
    WHERE removed_at IS NULL;

CREATE INDEX idx_case_assignments_case ON case_assignments(case_id);
CREATE INDEX idx_case_assignments_lawyer ON case_assignments(lawyer_id) WHERE removed_at IS NULL;
