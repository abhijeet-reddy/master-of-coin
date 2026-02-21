-- Add BULK_SYNC to job_type enum for the Sync API feature
-- BULK_SYNC jobs process arrays of push/pull sync operations via the worker
ALTER TYPE job_type ADD VALUE 'BULK_SYNC';
