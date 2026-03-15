-- Rollback: Remove PORTFOLIO_SYNC from job_type enum
-- PostgreSQL does not support removing enum values directly.
-- To roll back, recreate the enum without PORTFOLIO_SYNC.

BEGIN;

DELETE FROM background_jobs WHERE job_type = 'PORTFOLIO_SYNC';
DELETE FROM schedules WHERE job_type = 'PORTFOLIO_SYNC';

ALTER TABLE background_jobs ALTER COLUMN job_type TYPE TEXT;
ALTER TABLE schedules ALTER COLUMN job_type TYPE TEXT;
DROP TYPE job_type;
CREATE TYPE job_type AS ENUM ('DRIFT_DETECTION', 'BULK_SYNC');
ALTER TABLE background_jobs ALTER COLUMN job_type TYPE job_type USING job_type::job_type;
ALTER TABLE schedules ALTER COLUMN job_type TYPE job_type USING job_type::job_type;

COMMIT;
