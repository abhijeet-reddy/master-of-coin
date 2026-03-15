-- Create investment_provider_type enum for type-safe provider identification
CREATE TYPE investment_provider_type AS ENUM ('TRADING_212');

-- Create investment_providers table
-- Stores brokerage API credentials linked to a specific investment account
CREATE TABLE investment_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider_type investment_provider_type NOT NULL,
    credentials JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each investment account can have at most one provider
    CONSTRAINT uq_investment_providers_account_id UNIQUE (account_id)
);

-- Indexes
CREATE INDEX idx_investment_providers_user_id ON investment_providers(user_id);

-- Apply updated_at trigger (reuses the function from 2025-10-25-000010_create_triggers)
CREATE TRIGGER update_investment_providers_updated_at
    BEFORE UPDATE ON investment_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
