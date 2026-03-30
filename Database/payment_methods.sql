-- Payment Methods Table: Stored payment method information. Securely stores customer payment methods for billing purposes.

CREATE TABLE payment_methods (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Tokenized payment info (never store raw card numbers!)
    provider            VARCHAR(50) NOT NULL,  -- stripe, square, etc.
    provider_customer_id VARCHAR(255),  -- Customer ID in payment provider
    provider_payment_method_id VARCHAR(255),  -- Tokenized payment method ID
    
    -- Display info (safe to store)
    type                VARCHAR(50),  -- credit_card, debit_card, bank_transfer, etc.
    brand               VARCHAR(50),  -- visa, mastercard, amex
    last_four           VARCHAR(4),
    expiry_month        INTEGER,
    expiry_year         INTEGER,
    billing_address     JSONB,
    
    is_default          BOOLEAN DEFAULT FALSE,
    is_active           BOOLEAN DEFAULT TRUE,
    
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_client ON payment_methods(client_id) WHERE is_active = TRUE;