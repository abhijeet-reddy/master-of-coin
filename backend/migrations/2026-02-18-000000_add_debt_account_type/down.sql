-- Rollback: Remove DEBT from account_type enum
-- Wrapped in a transaction so all steps succeed or none do.
-- Existing accounts keep their types because we convert to TEXT first, then cast back.

BEGIN;

-- Step 1: Delete splits on DEBT account transactions
DELETE FROM transaction_splits
WHERE transaction_id IN (
    SELECT t.id FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    WHERE a.type = 'DEBT'
);

-- Step 2: Delete transactions on DEBT accounts
DELETE FROM transactions
WHERE account_id IN (
    SELECT id FROM accounts WHERE type = 'DEBT'
);

-- Step 3: Delete DEBT accounts (no DEBT rows remain after this)
DELETE FROM accounts WHERE type = 'DEBT';

-- Step 4: Convert column to TEXT temporarily (preserves all existing values like 'CHECKING', 'SAVINGS', etc.)
ALTER TABLE accounts ALTER COLUMN type TYPE TEXT;

-- Step 5: Drop the old enum that includes DEBT
DROP TYPE account_type;

-- Step 6: Recreate the enum without DEBT
CREATE TYPE account_type AS ENUM (
    'CHECKING',
    'SAVINGS',
    'CREDIT_CARD',
    'INVESTMENT',
    'CASH'
);

-- Step 7: Convert back from TEXT to the new enum (safe because all DEBT rows were deleted in Step 3)
ALTER TABLE accounts ALTER COLUMN type TYPE account_type USING type::account_type;

COMMIT;
