-- Add full expense details to debt_transaction_metadata.
-- total_cost: The full expense amount (e.g., 120.00 when split among 4 people)
-- expense_participants: JSONB array of all participants with their paid/owed shares
ALTER TABLE debt_transaction_metadata
  ADD COLUMN total_cost DECIMAL NOT NULL DEFAULT 0,
  ADD COLUMN expense_participants JSONB;
