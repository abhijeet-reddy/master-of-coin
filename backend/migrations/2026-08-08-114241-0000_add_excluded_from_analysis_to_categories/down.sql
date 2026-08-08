DROP INDEX IF EXISTS idx_categories_excluded_from_analysis;
ALTER TABLE categories DROP COLUMN IF EXISTS is_excluded_from_analysis;
