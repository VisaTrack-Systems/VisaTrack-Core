-- Organizations Table: Multi-tenant organization schema. Stores tenant information, branding, and organization-wide settings.

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier
    legal_name      VARCHAR(255),
    tax_id          VARCHAR(50),
    address         JSONB,  -- { street, city, province, postal_code, country }
    contact_email   VARCHAR(255) NOT NULL,
    contact_phone   VARCHAR(50),
    website         VARCHAR(255),
    logo_url        VARCHAR(500),
    settings        JSONB DEFAULT '{}',  -- org-specific configurations
    subscription_tier VARCHAR(50) DEFAULT 'basic',  -- basic, professional, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ  -- Soft delete
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_subscription ON organizations(subscription_status) 
    WHERE deleted_at IS NULL;