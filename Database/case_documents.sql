CREATE TABLE case_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    template_id         UUID REFERENCES document_templates(id),  -- NULL for custom uploads
    
    -- Document metadata
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    file_name           VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,  -- Storage path (S3, etc.)
    file_size_bytes     BIGINT,
    file_type           VARCHAR(100),  -- MIME type
    file_hash           VARCHAR(64),  -- SHA-256 for integrity
    
    -- Versioning
    version             INTEGER DEFAULT 1,
    previous_version_id UUID REFERENCES case_documents(id),
    
    -- Status workflow
    status              VARCHAR(50) DEFAULT 'pending',  -- pending, received, under_review, approved, rejected, expired
    rejection_reason    TEXT,
    
    -- Visibility
    client_visible      BOOLEAN DEFAULT TRUE,
    lawyer_notes        TEXT,  -- Internal notes
    
    -- Expiry tracking (for passports, medicals, etc.)
    issue_date          DATE,
    expiry_date         DATE,
    
    -- Upload info
    uploaded_by         UUID REFERENCES users(id),
    uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    
    -- Audit
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_case_documents_case ON case_documents(case_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_case_documents_status ON case_documents(status);
CREATE INDEX idx_case_documents_expiry ON case_documents(expiry_date) WHERE expiry_date IS NOT NULL;