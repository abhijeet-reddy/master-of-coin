-- Add DEBT to account_type enum for "Paid by Others" feature
-- DEBT accounts are hidden pseudo-accounts used to track expenses paid by other people
-- They are excluded from net worth calculations and hidden from the account list
ALTER TYPE account_type ADD VALUE 'DEBT';
