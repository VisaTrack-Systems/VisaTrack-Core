-- Migration: Trust accounting hardening + client_accounts registry
-- Date: 2026-02-13
--
-- Safe to run multiple times (uses IF EXISTS / IF NOT EXISTS where possible).
-- Review before running in production.

BEGIN;

-- 1) Create client_accounts table (if missing)
CREATE TABLE IF NOT EXISTS client_accounts (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_name                    VARCHAR(255) NOT NULL,
    financial_institution_name      VARCHAR(255) NOT NULL,
    financial_institution_address   TEXT,
    account_number_masked           VARCHAR(64) NOT NULL,
    routing_number_masked           VARCHAR(32),
    currency                        VARCHAR(3) NOT NULL DEFAULT 'CAD',
    is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
    opened_at                       DATE NOT NULL,
    closed_at                       DATE,
    college_notified_opened_at      TIMESTAMPTZ,
    college_notified_closed_at      TIMESTAMPTZ,
    created_by                      UUID NOT NULL REFERENCES users(id),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (currency ~ '^[A-Z]{3}$'),
    CHECK (closed_at IS NULL OR closed_at >= opened_at),
    CHECK (
        (is_active = TRUE AND closed_at IS NULL)
        OR
        (is_active = FALSE AND closed_at IS NOT NULL)
    ),
    CHECK (
        college_notified_opened_at IS NULL
        OR (
            college_notified_opened_at >= opened_at::TIMESTAMPTZ
            AND college_notified_opened_at <= opened_at::TIMESTAMPTZ + INTERVAL '15 days'
        )
    ),
    CHECK (
        college_notified_closed_at IS NULL
        OR (
            closed_at IS NOT NULL
            AND college_notified_closed_at >= closed_at::TIMESTAMPTZ
            AND college_notified_closed_at <= closed_at::TIMESTAMPTZ + INTERVAL '15 days'
        )
    )
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_client_accounts_org'
    ) THEN
        CREATE INDEX idx_client_accounts_org ON client_accounts(organization_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_client_accounts_active'
    ) THEN
        CREATE INDEX idx_client_accounts_active ON client_accounts(organization_id, is_active);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_client_accounts_org_number_currency'
    ) THEN
        ALTER TABLE client_accounts
            ADD CONSTRAINT uq_client_accounts_org_number_currency
            UNIQUE (organization_id, account_number_masked, currency);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION validate_client_account_org_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM 1
    FROM users u
    WHERE u.id = NEW.created_by
      AND u.organization_id = NEW.organization_id
      AND u.deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'created_by must belong to the same organization';
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_client_account_org_consistency ON client_accounts;
CREATE TRIGGER trg_validate_client_account_org_consistency
BEFORE INSERT OR UPDATE ON client_accounts
FOR EACH ROW
EXECUTE FUNCTION validate_client_account_org_consistency();

-- 2) Add columns to trust_account_entries
ALTER TABLE trust_account_entries
    ADD COLUMN IF NOT EXISTS client_account_id UUID,
    ADD COLUMN IF NOT EXISTS invoice_id UUID,
    ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS reconciliation_note TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Add FK to client_accounts (cannot use IF NOT EXISTS for constraints)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_trust_account_entries_client_account_id'
    ) THEN
        ALTER TABLE trust_account_entries
            ADD CONSTRAINT fk_trust_account_entries_client_account_id
            FOREIGN KEY (client_account_id) REFERENCES client_accounts(id);
    END IF;
END $$;

-- Add FK to invoices (cannot use IF NOT EXISTS for constraints)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_trust_account_entries_invoice_id'
    ) THEN
        ALTER TABLE trust_account_entries
            ADD CONSTRAINT fk_trust_account_entries_invoice_id
            FOREIGN KEY (invoice_id) REFERENCES invoices(id);
    END IF;
END $$;

-- 2b) Check constraints for integrity
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trust_entry_type') THEN
        ALTER TABLE trust_account_entries
            ADD CONSTRAINT chk_trust_entry_type
            CHECK (entry_type IN ('retainer', 'disbursement', 'refund', 'transfer')) NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trust_void_requires_reason') THEN
        ALTER TABLE trust_account_entries
            ADD CONSTRAINT chk_trust_void_requires_reason
            CHECK (voided_at IS NULL OR (voided_by IS NOT NULL AND void_reason IS NOT NULL)) NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trust_reconcile_requires_timestamp') THEN
        ALTER TABLE trust_account_entries
            ADD CONSTRAINT chk_trust_reconcile_requires_timestamp
            CHECK (reconciled = FALSE OR reconciled_at IS NOT NULL) NOT VALID;
    END IF;
END $$;

ALTER TABLE trust_account_entries VALIDATE CONSTRAINT chk_trust_entry_type;
ALTER TABLE trust_account_entries VALIDATE CONSTRAINT chk_trust_void_requires_reason;
ALTER TABLE trust_account_entries VALIDATE CONSTRAINT chk_trust_reconcile_requires_timestamp;

-- 3) Backfill: ensure each org with trust entries has a default client_account
-- Pick a deterministic created_by per organization (earliest created user in org).
WITH orgs AS (
    SELECT DISTINCT organization_id
    FROM trust_account_entries
    WHERE organization_id IS NOT NULL
), org_creator AS (
    SELECT o.organization_id,
           (
             SELECT u.id
             FROM users u
             WHERE u.organization_id = o.organization_id
               AND u.deleted_at IS NULL
             ORDER BY u.created_at ASC
             LIMIT 1
           ) AS created_by
    FROM orgs o
), inserted AS (
    INSERT INTO client_accounts (
        organization_id,
        account_name,
        financial_institution_name,
        financial_institution_address,
        account_number_masked,
        routing_number_masked,
        currency,
        is_active,
        opened_at,
        created_by
    )
    SELECT oc.organization_id,
           'Default Trust Account',
           'Unknown',
           NULL,
           'unknown',
           NULL,
           'CAD',
           TRUE,
           CURRENT_DATE,
           oc.created_by
    FROM org_creator oc
    WHERE oc.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM client_accounts ca
        WHERE ca.organization_id = oc.organization_id
          AND ca.account_number_masked = 'unknown'
          AND ca.currency = 'CAD'
      )
    RETURNING id, organization_id
)
SELECT 1;

-- 4) Backfill trust_account_entries.client_account_id to the default account where NULL
UPDATE trust_account_entries tae
SET client_account_id = ca.id
FROM client_accounts ca
WHERE tae.client_account_id IS NULL
  AND ca.organization_id = tae.organization_id
  AND ca.account_number_masked = 'unknown'
  AND ca.currency = 'CAD';

-- 5) Enforce NOT NULL (after backfill)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trust_account_entries'
          AND column_name = 'client_account_id'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE trust_account_entries
            ALTER COLUMN client_account_id SET NOT NULL;
    END IF;
END $$;

-- 6) Indexes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_trust_org_occurred'
    ) THEN
        CREATE INDEX idx_trust_org_occurred ON trust_account_entries(organization_id, occurred_at DESC);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_trust_client_account'
    ) THEN
        CREATE INDEX idx_trust_client_account ON trust_account_entries(client_account_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_trust_invoice'
    ) THEN
        CREATE INDEX idx_trust_invoice ON trust_account_entries(invoice_id);
    END IF;
END $$;

-- 7) Triggers to enforce tenant consistency + ledger immutability
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

COMMIT;
