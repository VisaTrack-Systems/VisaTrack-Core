CREATE TABLE cases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Case identification
    case_number         VARCHAR(100) NOT NULL,  -- Human-readable: C-2024-001
    client_id           UUID NOT NULL REFERENCES users(id),
    primary_lawyer_id   UUID REFERENCES users(id),  -- Lead attorney
    
    -- Case details
    case_type           VARCHAR(100) NOT NULL,  -- Express Entry, Work Permit, etc.
    case_subtype        VARCHAR(100),  -- FSWP, CEC, FSTP for Express Entry
    status              VARCHAR(50) DEFAULT 'intake',  -- See status enum below
    
    -- IRCC specific
    ircc_file_number    VARCHAR(100),
    uci_number          VARCHAR(50),
    application_number  VARCHAR(50),
    visa_office         VARCHAR(100),
    
    -- Timeline
    intake_date         DATE DEFAULT CURRENT_DATE,
    start_date          DATE,
    target_filing_date  DATE,
    actual_filing_date  DATE,
    estimated_completion_from DATE,
    estimated_completion_to   DATE,
    completion_confidence INTEGER CHECK (completion_confidence BETWEEN 0 AND 100),
    actual_completion_date    DATE,
    
    -- Descriptions
    description         TEXT,  -- Client-facing
    internal_notes      TEXT,  -- Lawyer-only
    
    -- Priority and assignment
    priority            VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, urgent
    complexity          VARCHAR(20) DEFAULT 'standard',  -- simple, standard, complex
    
    -- Financial
    fee_agreement       JSONB,  -- { total_fee, payment_schedule, currency }
    
    -- Metadata
    source              VARCHAR(50),  -- referral, website, walk-in
    tags                TEXT[],
    custom_fields       JSONB DEFAULT '{}',
    
    -- Audit
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    
    UNIQUE(organization_id, case_number)
);

-- Status enum values: intake, awaiting_client, in_progress, closed

CREATE INDEX idx_cases_org ON cases(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cases_client ON cases(client_id);
CREATE INDEX idx_cases_lawyer ON cases(primary_lawyer_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_type ON cases(case_type);
CREATE INDEX idx_cases_priority ON cases(priority) WHERE status NOT IN ('approved', 'refused', 'withdrawn', 'closed');