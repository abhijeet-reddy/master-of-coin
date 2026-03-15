CREATE TYPE split_provider_type AS ENUM ('splitwise', 'splitpro');
ALTER TABLE split_providers ALTER COLUMN provider_type TYPE split_provider_type USING provider_type::split_provider_type;
