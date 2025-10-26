-- Drop triggers in reverse order
DROP TRIGGER IF EXISTS update_transaction_splits_updated_at ON transaction_splits;
DROP TRIGGER IF EXISTS update_budget_ranges_updated_at ON budget_ranges;
DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS update_people_updated_at ON people;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();