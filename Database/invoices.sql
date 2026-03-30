-- Invoices Table: Billing and invoice records. Stores invoice data with amounts, dates, and payment tracking.

CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    case_id             UUID REFERENCES cases(id),  -- NULL for general invoices
    client_id           UUID NOT NULL REFERENCES users(id),
    
    -- Invoice details
    invoice_number      VARCHAR(100) NOT NULL,
    status              VARCHAR(50) DEFAULT 'draft',  -- draft, sent, viewed, paid, overdue, cancelled, refunded
    
    -- Amounts
    subtotal            DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    tax_rate            DECIMAL(5,4) DEFAULT 0 CHECK (tax_rate >= 0),
    tax_amount          DECIMAL(12,2) DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount        DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    currency            VARCHAR(3) DEFAULT 'CAD',
    
    -- Dates
    issue_date          DATE DEFAULT CURRENT_DATE,
    due_date            DATE NOT NULL,
    paid_date           DATE,
    sent_at             TIMESTAMPTZ,
    viewed_at           TIMESTAMPTZ,
    
    -- Descriptions
    notes               TEXT,  -- Client-facing notes
    internal_notes      TEXT,
    terms               TEXT,  -- Payment terms
    
    -- Payment tracking
    amount_paid         DECIMAL(12,2) DEFAULT 0 CHECK (amount_paid >= 0),
    amount_due          DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
    payment_method_id   UUID REFERENCES payment_methods(id),
    
    -- Provider info
    provider_invoice_id VARCHAR(255),  -- ID in Stripe/Square
    
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, invoice_number)
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_case ON invoices(case_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status) WHERE status NOT IN ('paid', 'cancelled');
CREATE INDEX idx_invoices_due ON invoices(due_date) WHERE status IN ('sent', 'viewed', 'overdue');
