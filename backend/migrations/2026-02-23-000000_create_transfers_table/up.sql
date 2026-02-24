CREATE TABLE transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    to_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    exchange_rate NUMERIC NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT transfers_from_to_unique UNIQUE (from_transaction_id, to_transaction_id)
);

CREATE INDEX idx_transfers_from_transaction ON transfers(from_transaction_id);
CREATE INDEX idx_transfers_to_transaction ON transfers(to_transaction_id);
