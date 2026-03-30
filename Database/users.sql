-- Users Table: User account and authentication schema. Stores user credentials, contact info, and account verification status.

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(50),
    avatar_url      VARCHAR(500),
    email_verified  BOOLEAN DEFAULT FALSE,
    phone_verified  BOOLEAN DEFAULT FALSE,
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    mfa_secret      VARCHAR(255),
    last_login_at   TIMESTAMPTZ,
    login_attempts  INTEGER DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    status          VARCHAR(50) DEFAULT 'active',  -- active, inactive, suspended
    timezone        VARCHAR(50) DEFAULT 'America/Toronto',
    locale          VARCHAR(10) DEFAULT 'en-CA',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    
    UNIQUE(email, organization_id)
);

CREATE INDEX idx_users_org ON users(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email);