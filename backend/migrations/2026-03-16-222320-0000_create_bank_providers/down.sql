-- Rollback: Drop bank_providers table, remove BANK_SYNC job type, drop bank_provider_type enum

DROP TRIGGER IF EXISTS update_bank_providers_updated_at ON bank_providers;
DROP TABLE IF EXISTS bank_providers;
DROP TYPE IF EXISTS bank_provider_type;

-- Remove BANK_SYNC from job_type enum
-- PostgreSQL does not support removing enum values directly.
-- Recreate the enum without BANK_SYNC.
BEGIN;

DELETE FROM background_jobs WHERE job_type = 'BANK_SYNC';
DELETE FROM schedules WHERE job_type = 'BANK_SYNC';

ALTER TABLE background_jobs ALTER COLUMN job_type TYPE TEXT;
ALTER TABLE schedules ALTER COLUMN job_type TYPE TEXT;
DROP TYPE job_type;
CREATE TYPE job_type AS ENUM ('DRIFT_DETECTION', 'BULK_SYNC', 'PORTFOLIO_SYNC');
ALTER TABLE background_jobs ALTER COLUMN job_type TYPE job_type USING job_type::job_type;
ALTER TABLE schedules ALTER COLUMN job_type TYPE job_type USING job_type::job_type;

COMMIT;
