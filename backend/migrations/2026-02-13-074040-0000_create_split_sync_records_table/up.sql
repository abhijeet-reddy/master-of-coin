-- Create split_sync_records table for tracking sync state of each split
CREATE TABLE split_sync_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_split_id UUID NOT NULL REFERENCES transaction_splits(id) ON DELETE CASCADE,
    split_provider_id UUID NOT NULL REFERENCES split_providers(id) ON DELETE CASCADE,
    -- The expense ID on the external platform
    external_expense_id VARCHAR(255),
    -- Sync status: pending, synced, failed, deleted
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(transaction_split_id, split_provider_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_split_sync_records_split_id ON split_sync_records(transaction_split_id);
CREATE INDEX idx_split_sync_records_status ON split_sync_records(sync_status);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_split_sync_records_updated_at
    BEFORE UPDATE ON split_sync_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add check constraint for sync_status
ALTER TABLE split_sync_records
    ADD CONSTRAINT check_sync_status
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'deleted'));
