-- Case Collaborators Table: Co-worker and collaborator assignments. Tracks additional lawyers and staff assigned to cases.

CREATE TABLE case_collaborators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    role            VARCHAR(100),  -- interpreter, consultant, etc.
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);