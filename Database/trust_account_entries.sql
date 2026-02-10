CREATE TABLE trust_account_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    case_id             UUID REFERENCES cases(id),
    client_id           UUID NOT NULL REFERENCES users(id),
    
    entry_type          VARCHAR(50) NOT NULL,  -- retainer, disbursement, refund, transfer
    amount              DECIMAL(12,2) NOT NULL CHECK (amount <> 0),  -- Positive for deposit, negative for withdrawal
    
    description         TEXT NOT NULL,
    reference_number    VARCHAR(100),
    
    -- Running balance (calculated)
    running_balance     DECIMAL(12,2),
    
    -- Reconciliation
    reconciled          BOOLEAN DEFAULT FALSE,
    reconciled_at       TIMESTAMPTZ,
    reconciled_by       UUID REFERENCES users(id),
    
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trust_org ON trust_account_entries(organization_id);
CREATE INDEX idx_trust_case ON trust_account_entries(case_id);
CREATE INDEX idx_trust_client ON trust_account_entries(client_id);
