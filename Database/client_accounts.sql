CREATE TABLE client_accounts (
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
    ),
    UNIQUE (organization_id, account_number_masked, currency)
);

CREATE INDEX idx_client_accounts_org ON client_accounts(organization_id);
CREATE INDEX idx_client_accounts_active ON client_accounts(organization_id, is_active);


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

CREATE TRIGGER trg_validate_client_account_org_consistency
BEFORE INSERT OR UPDATE ON client_accounts
FOR EACH ROW
EXECUTE FUNCTION validate_client_account_org_consistency();
