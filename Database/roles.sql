CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL,
    description     TEXT,
    is_system       BOOLEAN DEFAULT FALSE,  -- Built-in roles cannot be deleted
    permissions     JSONB NOT NULL,  -- Array of permission strings
    
    -- Predefined permission categories:
    -- cases:view, cases:create, cases:edit, cases:delete, cases:assign
    -- clients:view, clients:create, clients:edit, clients:delete
    -- documents:view, documents:upload, documents:delete, documents:approve
    -- payments:view, payments:create, payments:refund
    -- reports:view, reports:export
    -- settings:view, settings:edit
    -- users:manage, roles:manage
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, slug)
);

-- Prevent duplicate system role slugs (organization_id is NULL for system roles)
CREATE UNIQUE INDEX uq_roles_system_slug ON roles(slug) WHERE organization_id IS NULL;

-- Insert default roles
INSERT INTO roles (organization_id, name, slug, description, is_system, permissions) VALUES
(NULL, 'Super Admin', 'super_admin', 'Full system access', TRUE, '["*"]'),
(NULL, 'Organization Admin', 'org_admin', 'Manages users, roles, and organization operations', TRUE, '[
    "users:manage", "roles:manage",
    "cases:view", "cases:create", "cases:edit", "cases:assign",
    "clients:view", "clients:create", "clients:edit",
    "documents:view", "documents:upload", "documents:approve",
    "payments:view", "payments:create",
    "messages:send", "messages:view",
    "reports:view",
    "settings:view", "settings:edit"
]'),
(NULL, 'Lawyer', 'lawyer', 'Can manage assigned cases and clients', TRUE, '[
    "cases:view", "cases:create", "cases:edit", "cases:assign",
    "clients:view", "clients:create", "clients:edit",
    "documents:view", "documents:upload", "documents:approve",
    "payments:view", "payments:create",
    "messages:send", "messages:view"
]'),
(NULL, 'Paralegal', 'paralegal', 'Can assist with cases but limited approval rights', TRUE, '[
    "cases:view", "cases:edit",
    "clients:view", "clients:edit",
    "documents:view", "documents:upload",
    "messages:view", "messages:send"
]'),
(NULL, 'Client', 'client', 'Can view own case and upload documents', TRUE, '[
    "own_case:view", "own_documents:upload", "own_messages:send", "own_payments:view"
]'),
(NULL, 'Billing Staff', 'billing', 'Can manage invoices and payments', TRUE, '[
    "payments:view", "payments:create", "payments:refund", "payments:edit",
    "invoices:view", "invoices:create", "invoices:send",
    "reports:financial"
]')
ON CONFLICT DO NOTHING;
