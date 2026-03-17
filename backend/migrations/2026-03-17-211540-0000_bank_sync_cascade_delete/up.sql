-- Change bank_sync_records.transaction_id foreign key from ON DELETE SET NULL to ON DELETE CASCADE
-- This allows re-importing bank transactions after deleting the local transaction

-- Drop the existing foreign key constraint
ALTER TABLE bank_sync_records DROP CONSTRAINT IF EXISTS bank_sync_records_transaction_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE bank_sync_records
    ADD CONSTRAINT bank_sync_records_transaction_id_fkey
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
