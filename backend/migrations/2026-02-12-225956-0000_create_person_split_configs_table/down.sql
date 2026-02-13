-- Drop person_split_configs table
DROP TRIGGER IF EXISTS update_person_split_configs_updated_at ON person_split_configs;
DROP INDEX IF EXISTS idx_person_split_configs_provider_id;
DROP INDEX IF EXISTS idx_person_split_configs_person_id;
DROP TABLE IF EXISTS person_split_configs;
