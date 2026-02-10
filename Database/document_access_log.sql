CREATE TABLE document_access_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID REFERENCES case_documents(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,  -- view, download, upload, delete, approve, reject
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_access_doc ON document_access_log(document_id);
CREATE INDEX idx_doc_access_user ON document_access_log(user_id);