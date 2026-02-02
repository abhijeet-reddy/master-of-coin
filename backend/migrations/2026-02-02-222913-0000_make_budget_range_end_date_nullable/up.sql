-- Make end_date nullable in budget_ranges table
ALTER TABLE budget_ranges
ALTER COLUMN end_date DROP NOT NULL;
