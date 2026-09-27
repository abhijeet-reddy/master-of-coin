DROP INDEX IF EXISTS idx_accounts_user_active;
ALTER TABLE accounts DROP COLUMN IF EXISTS archived_at;
