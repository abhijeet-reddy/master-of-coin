-- Create debt_transaction_metadata table for "Paid by Others" feature.
-- Links a transaction (on a DEBT account) to the person who paid for it.
CREATE TABLE debt_transaction_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
    payer_person_id UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
