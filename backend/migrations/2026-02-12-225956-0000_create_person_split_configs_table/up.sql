-- Create person_split_configs table for mapping people to their split provider identities
CREATE TABLE person_split_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    split_provider_id UUID NOT NULL REFERENCES split_providers(id) ON DELETE CASCADE,
    -- The identifier on the external platform
    -- Splitwise: the Splitwise friend user ID (integer stored as string)
    -- SplitPro: email or user ID on the SplitPro instance
    external_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(person_id)  -- One provider config per person
);

-- Indexes for efficient lookups
CREATE INDEX idx_person_split_configs_person_id ON person_split_configs(person_id);
CREATE INDEX idx_person_split_configs_provider_id ON person_split_configs(split_provider_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_person_split_configs_updated_at
    BEFORE UPDATE ON person_split_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
