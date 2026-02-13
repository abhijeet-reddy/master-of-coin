-- Drop split_providers table
DROP TRIGGER IF EXISTS update_split_providers_updated_at ON split_providers;
DROP INDEX IF EXISTS idx_split_providers_user_id;
DROP TABLE IF EXISTS split_providers;
