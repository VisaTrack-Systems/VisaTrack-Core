CREATE TABLE milestone_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    name            VARCHAR(255) NOT NULL,
    case_type       VARCHAR(100) NOT NULL,
    description     TEXT,
    is_system       BOOLEAN DEFAULT FALSE,
    milestones      JSONB NOT NULL,  -- Array of milestone definitions
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Example: Express Entry milestones
INSERT INTO milestone_templates (name, case_type, description, is_system, milestones) VALUES
('Express Entry - Standard', 'Express Entry', 'Standard Express Entry process', TRUE, '[
    {"name": "Initial Consultation", "description": "Case assessment and retainer signed", "days_from_start": 0},
    {"name": "Document Collection", "description": "Gather all required documents", "days_from_start": 14},
    {"name": "ECA & Language Tests", "description": "Complete credential assessment and tests", "days_from_start": 30},
    {"name": "Create EE Profile", "description": "Submit to Express Entry pool", "days_from_start": 45},
    {"name": "Receive ITA", "description": "Invitation to Apply received", "days_from_start": 90},
    {"name": "Submit Application", "description": "Complete PR application submission", "days_from_start": 105},
    {"name": "Application Review", "description": "IRCC processing", "days_from_start": 180}
]');