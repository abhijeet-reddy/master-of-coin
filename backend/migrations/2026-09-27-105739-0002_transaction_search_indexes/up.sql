-- Fast active-row listing and title/notes search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_transactions_user_date_active
    ON transactions (user_id, date DESC) WHERE is_deleted = false;
CREATE INDEX idx_transactions_title_trgm
    ON transactions USING gin (title gin_trgm_ops);
CREATE INDEX idx_transactions_notes_trgm
    ON transactions USING gin (notes gin_trgm_ops);
