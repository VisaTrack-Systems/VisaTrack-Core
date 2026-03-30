-- Document Suites Table: Categorized document groupings. Organizes documents into logical suites, folders, or categories per case.

CREATE TABLE document_suites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL for system defaults
    name            VARCHAR(255) NOT NULL,  -- "Personal Documents", "Employment Documents"
    description     TEXT,
    case_types      TEXT[],  -- ['Express Entry', 'Work Permit'] - applicable case types
    is_system       BOOLEAN DEFAULT FALSE,
    sort_order      INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- System default suites
INSERT INTO document_suites (name, description, case_types, is_system, sort_order) VALUES
('Personal Documents', 'Identity and personal information documents', ARRAY['Express Entry', 'Work Permit', 'Study Permit', 'Family Sponsorship'], TRUE, 1),
('Education Documents', 'Academic credentials and assessments', ARRAY['Express Entry', 'Study Permit'], TRUE, 2),
('Employment Documents', 'Work history and reference letters', ARRAY['Express Entry', 'Work Permit'], TRUE, 3),
('Language Tests', 'IELTS, CELPIP, TEF results', ARRAY['Express Entry'], TRUE, 4),
('Financial Documents', 'Proof of funds and financial capacity', ARRAY['Express Entry', 'Study Permit'], TRUE, 5),
('Police Certificates', 'Background check documents', ARRAY['Express Entry', 'Work Permit', 'Study Permit'], TRUE, 6),
('Medical Examination', 'IME results from panel physicians', ARRAY['Express Entry'], TRUE, 7);