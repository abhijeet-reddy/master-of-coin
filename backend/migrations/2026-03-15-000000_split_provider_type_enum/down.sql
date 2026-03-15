ALTER TABLE split_providers ALTER COLUMN provider_type TYPE VARCHAR(50) USING provider_type::text;
DROP TYPE split_provider_type;
