-- Create bank_sync_records table
-- Tracks which external bank transactions have been imported to prevent duplicates
CREATE TABLE bank_sync_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_provider_id UUID NOT NULL REFERENCES bank_providers(id) ON DELETE CASCADE,
    external_transaction_id VARCHAR(255) NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevents double-importing the same bank transaction.
    -- The implicit composite index also serves lookups by bank_provider_id.
    CONSTRAINT uq_bank_sync_external_txn UNIQUE (bank_provider_id, external_transaction_id)
);
