-- Invoice Items Table: Line items for invoices. Details individual charges and service items within invoices.

CREATE TABLE invoice_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    description     TEXT NOT NULL,
    quantity        DECIMAL(10,2) DEFAULT 1 CHECK (quantity > 0),
    unit_price      DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
    amount          DECIMAL(12,2) NOT NULL CHECK (amount >= 0),  -- quantity * unit_price
    
    -- Categorization
    category        VARCHAR(100),  -- professional_fees, government_fees, disbursements, etc.
    case_milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,  -- Link to milestone if applicable
    
    sort_order      INTEGER DEFAULT 0
);
