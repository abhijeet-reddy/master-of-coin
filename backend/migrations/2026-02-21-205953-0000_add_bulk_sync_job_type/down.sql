-- Rollback: Remove BULK_SYNC from job_type enum
-- PostgreSQL does not support removing enum values directly.
-- To roll back, recreate the enum without BULK_SYNC.

BEGIN;

DELETE FROM background_jobs WHERE job_type = 'BULK_SYNC';

ALTER TABLE background_jobs ALTER COLUMN job_type TYPE TEXT;
DROP TYPE job_type;
CREATE TYPE job_type AS ENUM ('DRIFT_DETECTION');
ALTER TABLE background_jobs ALTER COLUMN job_type TYPE job_type USING job_type::job_type;

COMMIT;
