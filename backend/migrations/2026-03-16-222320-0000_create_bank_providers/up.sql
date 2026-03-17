-- Create bank_provider_type enum for type-safe provider identification
CREATE TYPE bank_provider_type AS ENUM ('TRUELAYER');

-- Add BANK_SYNC to job_type enum for bank transaction sync jobs
ALTER TYPE job_type ADD VALUE 'BANK_SYNC';

-- Create bank_providers table
-- Stores Open Banking provider credentials linked to a specific account
CREATE TABLE bank_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider_type bank_provider_type NOT NULL,
    credentials JSONB NOT NULL,
    external_account_id VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each account can have at most one bank provider connection
    CONSTRAINT uq_bank_providers_account_id UNIQUE (account_id)
);

-- Apply updated_at trigger (reuses the function from 2025-10-25-000010_create_triggers)
CREATE TRIGGER update_bank_providers_updated_at
    BEFORE UPDATE ON bank_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
