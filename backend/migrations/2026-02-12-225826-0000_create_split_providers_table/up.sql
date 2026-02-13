-- Create split_providers table for storing user-level split provider configurations
CREATE TABLE split_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_type VARCHAR(50) NOT NULL,
    -- Encrypted credentials stored as JSONB
    -- Splitwise: { "access_token": "...", "refresh_token": "...", "token_expires_at": "...", "splitwise_user_id": 12345 }
    -- SplitPro: { "base_url": "...", "api_key": "..." } (future)
    credentials JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider_type)
);

-- Index for efficient user lookups
CREATE INDEX idx_split_providers_user_id ON split_providers(user_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_split_providers_updated_at
    BEFORE UPDATE ON split_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
