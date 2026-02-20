-- Revert: remove expense details columns from debt_transaction_metadata
ALTER TABLE debt_transaction_metadata
  DROP COLUMN IF EXISTS expense_participants,
  DROP COLUMN IF EXISTS total_cost;
