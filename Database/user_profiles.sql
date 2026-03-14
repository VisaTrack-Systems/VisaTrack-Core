CREATE TABLE user_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    user_type       VARCHAR(50) NOT NULL,  -- lawyer, client, staff, admin
    
    -- Lawyer-specific fields
    bar_number      VARCHAR(100),
    specialties     TEXT[],  -- ['Express Entry', 'Work Permit', 'Family Sponsorship']
    years_experience INTEGER,
    bio             TEXT,
    hourly_rate     DECIMAL(10,2),
    
    -- Client-specific fields
    date_of_birth   DATE,
    nationality     VARCHAR(100),
    current_status  VARCHAR(100),  -- e.g., "Visitor", "Worker", "Permanent Resident"
    uci_number      VARCHAR(50),  -- Unique Client Identifier from IRCC
    application_number VARCHAR(50),
    
    -- Emergency contact
    emergency_contact JSONB,  -- { name, relationship, phone, email }
    
    -- Address
    address         JSONB,  -- { street, city, province, postal_code, country }
    
    -- Preferences
    notification_prefs JSONB DEFAULT '{
        "email_case_updates": true,
        "email_documents": true,
        "email_payments": true,
        "sms_urgent": false
    }',
    
    custom_fields   JSONB DEFAULT '{}',  -- org-specific custom fields
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_type ON user_profiles(user_type);
CREATE INDEX idx_profiles_bar ON user_profiles(bar_number) WHERE user_type = 'lawyer';
