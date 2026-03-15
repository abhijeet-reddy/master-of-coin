-- Rollback: Drop investment_providers table and investment_provider_type enum

DROP TRIGGER IF EXISTS update_investment_providers_updated_at ON investment_providers;
DROP TABLE IF EXISTS investment_providers;
DROP TYPE IF EXISTS investment_provider_type;
