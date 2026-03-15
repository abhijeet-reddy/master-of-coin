DROP INDEX IF EXISTS idx_transactions_is_deleted;
ALTER TABLE transactions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE transactions DROP COLUMN IF EXISTS is_deleted;
