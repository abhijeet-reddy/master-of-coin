-- Drop trigger
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;

-- Drop indexes
DROP INDEX IF EXISTS idx_api_keys_key_hash;
DROP INDEX IF EXISTS idx_api_keys_user_id;

-- Drop table
DROP TABLE IF EXISTS api_keys;

-- Drop ENUM type
DROP TYPE IF EXISTS api_key_status;
