-- Revert: Make end_date non-nullable in budget_ranges table
-- Note: This will fail if there are any NULL values in end_date
ALTER TABLE budget_ranges
ALTER COLUMN end_date SET NOT NULL;
