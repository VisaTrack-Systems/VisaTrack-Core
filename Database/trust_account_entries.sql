CREATE TABLE trust_account_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    client_account_id   UUID NOT NULL REFERENCES client_accounts(id),
    case_id             UUID REFERENCES cases(id),
    client_id           UUID NOT NULL REFERENCES users(id),
    invoice_id          UUID REFERENCES invoices(id),
    
    entry_type          VARCHAR(50) NOT NULL,  -- retainer, disbursement, refund, transfer
    amount              DECIMAL(12,2) NOT NULL CHECK (amount <> 0),  -- Positive for deposit, negative for withdrawal
    
    description         TEXT NOT NULL,
    reference_number    VARCHAR(100),
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Running balance (calculated)
    running_balance     DECIMAL(12,2),
    
    -- Reconciliation
    reconciled          BOOLEAN DEFAULT FALSE,
    reconciled_at       TIMESTAMPTZ,
    reconciled_by       UUID REFERENCES users(id),
    reconciliation_note TEXT,
    
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    voided_at           TIMESTAMPTZ,
    voided_by           UUID REFERENCES users(id),
    void_reason         TEXT,

    CHECK (entry_type IN ('retainer', 'disbursement', 'refund', 'transfer')),
    CHECK (voided_at IS NULL OR (voided_by IS NOT NULL AND void_reason IS NOT NULL)),
    CHECK (reconciled = FALSE OR reconciled_at IS NOT NULL),
    CHECK (occurred_at <= NOW() + INTERVAL '5 minutes')
);

CREATE INDEX idx_trust_org ON trust_account_entries(organization_id);
CREATE INDEX idx_trust_org_occurred ON trust_account_entries(organization_id, occurred_at DESC);
CREATE INDEX idx_trust_case ON trust_account_entries(case_id);
CREATE INDEX idx_trust_client ON trust_account_entries(client_id);
CREATE INDEX idx_trust_client_account ON trust_account_entries(client_account_id);
CREATE INDEX idx_trust_invoice ON trust_account_entries(invoice_id);


CREATE OR REPLACE FUNCTION validate_trust_account_entry_org_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    account_org_id UUID;
    client_org_id UUID;
    case_org_id UUID;
    invoice_org_id UUID;
    invoice_client_id UUID;
BEGIN
    SELECT organization_id INTO account_org_id
    FROM client_accounts
    WHERE id = NEW.client_account_id;

    IF account_org_id IS NULL OR account_org_id <> NEW.organization_id THEN
        RAISE EXCEPTION 'client_account_id must belong to the same organization';
    END IF;

    SELECT organization_id INTO client_org_id
    FROM users
    WHERE id = NEW.client_id
      AND deleted_at IS NULL;

    IF client_org_id IS NULL OR client_org_id <> NEW.organization_id THEN
        RAISE EXCEPTION 'client_id must belong to the same organization';
    END IF;

    IF NEW.case_id IS NOT NULL THEN
        SELECT organization_id INTO case_org_id
        FROM cases
        WHERE id = NEW.case_id
          AND deleted_at IS NULL;

        IF case_org_id IS NULL OR case_org_id <> NEW.organization_id THEN
            RAISE EXCEPTION 'case_id must belong to the same organization';
        END IF;
    END IF;

    IF NEW.invoice_id IS NOT NULL THEN
        SELECT organization_id, client_id
        INTO invoice_org_id, invoice_client_id
        FROM invoices
        WHERE id = NEW.invoice_id;

        IF invoice_org_id IS NULL OR invoice_org_id <> NEW.organization_id THEN
            RAISE EXCEPTION 'invoice_id must belong to the same organization';
        END IF;

        IF invoice_client_id IS NULL OR invoice_client_id <> NEW.client_id THEN
            RAISE EXCEPTION 'invoice_id must belong to the same client';
        END IF;
    END IF;

    IF NEW.created_by IS NOT NULL THEN
        PERFORM 1
        FROM users u
        WHERE u.id = NEW.created_by
          AND u.organization_id = NEW.organization_id
          AND u.deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'created_by must belong to the same organization';
        END IF;
    END IF;

    IF NEW.reconciled_by IS NOT NULL THEN
        PERFORM 1
        FROM users u
        WHERE u.id = NEW.reconciled_by
          AND u.organization_id = NEW.organization_id
          AND u.deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'reconciled_by must belong to the same organization';
        END IF;
    END IF;

    IF NEW.voided_by IS NOT NULL THEN
        PERFORM 1
        FROM users u
        WHERE u.id = NEW.voided_by
          AND u.organization_id = NEW.organization_id
          AND u.deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'voided_by must belong to the same organization';
        END IF;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_trust_account_entry_org_consistency ON trust_account_entries;
CREATE TRIGGER trg_validate_trust_account_entry_org_consistency
BEFORE INSERT OR UPDATE ON trust_account_entries
FOR EACH ROW
EXECUTE FUNCTION validate_trust_account_entry_org_consistency();


CREATE OR REPLACE FUNCTION enforce_trust_entry_not_editable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Ledger should be append-only: disallow changing financial fields after insert.
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.amount IS DISTINCT FROM NEW.amount)
            OR (OLD.entry_type IS DISTINCT FROM NEW.entry_type)
            OR (OLD.client_account_id IS DISTINCT FROM NEW.client_account_id)
            OR (OLD.organization_id IS DISTINCT FROM NEW.organization_id)
            OR (OLD.client_id IS DISTINCT FROM NEW.client_id)
            OR (OLD.case_id IS DISTINCT FROM NEW.case_id)
            OR (OLD.invoice_id IS DISTINCT FROM NEW.invoice_id)
            OR (OLD.occurred_at IS DISTINCT FROM NEW.occurred_at) THEN
            RAISE EXCEPTION 'Trust ledger entries are immutable; void and re-enter instead.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_trust_entry_not_editable ON trust_account_entries;
CREATE TRIGGER trg_enforce_trust_entry_not_editable
BEFORE UPDATE ON trust_account_entries
FOR EACH ROW
EXECUTE FUNCTION enforce_trust_entry_not_editable();
