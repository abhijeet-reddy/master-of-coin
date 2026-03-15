ALTER TABLE transactions
    ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

CREATE INDEX idx_transactions_is_deleted ON transactions(is_deleted)
    WHERE is_deleted = FALSE;
