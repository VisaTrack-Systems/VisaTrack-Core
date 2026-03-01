CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id),
    payment_method_id   UUID REFERENCES payment_methods(id),
    
    -- Transaction details
    amount              DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency            VARCHAR(3) DEFAULT 'CAD',
    status              VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed, refunded
    
    -- Provider info
    provider            VARCHAR(50) NOT NULL,
    provider_payment_id VARCHAR(255),  -- Transaction ID from provider
    provider_fee_amount DECIMAL(12,2) CHECK (provider_fee_amount >= 0),  -- Processing fee
    
    -- Refund info
    refunded_amount     DECIMAL(12,2) DEFAULT 0 CHECK (refunded_amount >= 0),
    refund_reason       TEXT,
    refunded_at         TIMESTAMPTZ,
    refunded_by         UUID REFERENCES users(id),
    
    -- Metadata
    metadata            JSONB,  -- Provider-specific response data
    
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
