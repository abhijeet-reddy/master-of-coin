-- Revert: Change bank_sync_records.transaction_id foreign key back to ON DELETE SET NULL

-- Drop the CASCADE constraint
ALTER TABLE bank_sync_records DROP CONSTRAINT IF EXISTS bank_sync_records_transaction_id_fkey;

-- Re-add with ON DELETE SET NULL (original behavior)
ALTER TABLE bank_sync_records
    ADD CONSTRAINT bank_sync_records_transaction_id_fkey
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
