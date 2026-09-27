-- Soft archive for accounts. NULL = active. Archived accounts are hidden from
-- active lists and pickers but still count toward net worth and reports.
ALTER TABLE accounts ADD COLUMN archived_at TIMESTAMPTZ NULL;
CREATE INDEX idx_accounts_user_active ON accounts (user_id) WHERE archived_at IS NULL;
