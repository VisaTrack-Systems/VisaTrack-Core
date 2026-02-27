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

-- Seed templates across system suites (idempotent)
INSERT INTO document_templates (
    suite_id,
    name,
    description,
    instructions,
    is_required,
    accepts_multiple,
    expiry_warning_days,
    sort_order
)
SELECT
    ds.id,
    seed.template_name,
    seed.description,
    seed.instructions,
    seed.is_required,
    seed.accepts_multiple,
    seed.expiry_warning_days,
    seed.sort_order
FROM (
    VALUES
        ('Personal Documents', 'Passport Copy', 'Valid passport biographical page', 'Upload all pages including blank pages. Must be valid for at least 6 months.', TRUE, TRUE, 180, 1),
        ('Personal Documents', 'National ID Card', 'Government-issued identity card', 'Upload front and back images in color.', FALSE, FALSE, NULL, 2),
        ('Personal Documents', 'Birth Certificate', 'Official birth certificate', 'Upload clear scan. If not in English/French include certified translation.', TRUE, FALSE, NULL, 3),
        ('Education Documents', 'Degree Certificate', 'Highest education credential', 'Upload final degree certificate. If provisional, include final transcript.', TRUE, FALSE, NULL, 1),
        ('Education Documents', 'Official Transcript', 'Academic transcript from institution', 'Upload complete transcript with all semesters.', TRUE, FALSE, NULL, 2),
        ('Education Documents', 'ECA Report', 'Educational Credential Assessment', 'Upload valid ECA report from designated body.', FALSE, FALSE, 30, 3),
        ('Employment Documents', 'Reference Letter', 'Employer reference letter', 'Include role, duties, dates, and hours/week on company letterhead.', TRUE, TRUE, NULL, 1),
        ('Employment Documents', 'Pay Stubs', 'Recent salary slips', 'Upload last 3 months of pay stubs.', FALSE, TRUE, NULL, 2),
        ('Employment Documents', 'Employment Contract', 'Signed employment contract', 'Upload complete signed contract PDF.', FALSE, FALSE, NULL, 3),
        ('Language Tests', 'IELTS / CELPIP Result', 'Language proficiency test result', 'Upload official result report with TRF number if applicable.', TRUE, FALSE, 30, 1),
        ('Language Tests', 'TEF / TCF Result', 'French language test result', 'Upload official French test report if applicable.', FALSE, FALSE, 30, 2),
        ('Financial Documents', 'Bank Statements', 'Proof of funds', 'Upload last 6 months statements for all declared accounts.', TRUE, TRUE, NULL, 1),
        ('Financial Documents', 'Proof of Income', 'Salary or business income evidence', 'Upload recent income evidence (pay slips, tax returns, etc.).', FALSE, TRUE, NULL, 2),
        ('Financial Documents', 'Gift Deed / Affidavit', 'Source of funds declaration', 'Upload signed deed/affidavit and supporting transfer proof.', FALSE, FALSE, NULL, 3),
        ('Police Certificates', 'Country of Residence PCC', 'Police clearance certificate', 'Upload valid PCC from current country of residence.', TRUE, FALSE, 30, 1),
        ('Police Certificates', 'Previous Country PCC', 'Police certificates for prior residencies', 'Upload PCCs for countries where residence exceeded 6 months.', FALSE, TRUE, 30, 2),
        ('Medical Examination', 'IME Information Sheet', 'Panel physician medical exam confirmation', 'Upload eMedical information sheet after exam.', TRUE, FALSE, 30, 1)
) AS seed(
    suite_name,
    template_name,
    description,
    instructions,
    is_required,
    accepts_multiple,
    expiry_warning_days,
    sort_order
)
JOIN document_suites ds
    ON ds.name = seed.suite_name
WHERE NOT EXISTS (
    SELECT 1
    FROM document_templates dt
    WHERE dt.suite_id = ds.id
      AND dt.name = seed.template_name
);
