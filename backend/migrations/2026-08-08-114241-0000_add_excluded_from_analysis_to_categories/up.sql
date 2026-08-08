-- Mark categories that should be excluded from spending analysis
-- (breakdown, budgeting, etc.). Excluded categories remain fully usable
-- in the ledger and assignable to transactions; only aggregation ignores them.
ALTER TABLE categories
    ADD COLUMN is_excluded_from_analysis BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_categories_excluded_from_analysis
    ON categories(is_excluded_from_analysis)
    WHERE is_excluded_from_analysis = TRUE;
