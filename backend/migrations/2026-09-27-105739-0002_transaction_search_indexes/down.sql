DROP INDEX IF EXISTS idx_transactions_notes_trgm;
DROP INDEX IF EXISTS idx_transactions_title_trgm;
DROP INDEX IF EXISTS idx_transactions_user_date_active;
-- pg_trgm is left installed; other objects may depend on it.
