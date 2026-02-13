-- Drop split_sync_records table
DROP TRIGGER IF EXISTS update_split_sync_records_updated_at ON split_sync_records;
DROP INDEX IF EXISTS idx_split_sync_records_status;
DROP INDEX IF EXISTS idx_split_sync_records_split_id;
DROP TABLE IF EXISTS split_sync_records;
