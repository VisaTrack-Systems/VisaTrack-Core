CREATE TABLE document_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id            UUID REFERENCES document_suites(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,  -- "Passport Copy", "IELTS Results"
    description         TEXT,
    instructions        TEXT,  -- Detailed instructions for client
    is_required         BOOLEAN DEFAULT TRUE,
    accepts_multiple    BOOLEAN DEFAULT FALSE,  -- Can upload multiple files?
    file_types          TEXT[] DEFAULT ARRAY['pdf', 'jpg', 'png'],  -- Allowed extensions
    max_file_size_mb    INTEGER DEFAULT 10,
    expiry_warning_days INTEGER,  -- Warn if document expires in X days (for passports, etc.)
    sort_order          INTEGER DEFAULT 0,
    is_active           BOOLEAN DEFAULT TRUE
);

-- Example templates
INSERT INTO document_templates (suite_id, name, description, instructions, is_required, accepts_multiple, expiry_warning_days) 
SELECT 
    ds.id, 'Passport Copy', 'Valid passport biographical page', 
    'Upload all pages including blank pages. Must be valid for at least 6 months.', 
    TRUE, TRUE, 180
FROM document_suites ds WHERE ds.name = 'Personal Documents';