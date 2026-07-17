-- Marks a split whose upstream provider (e.g. Splitwise) sync was intentionally
-- skipped at transaction-create time. Distinguishes "deliberately not synced"
-- from "not yet synced". Defaults to FALSE to preserve existing behaviour.
ALTER TABLE transaction_splits
    ADD COLUMN sync_skipped BOOLEAN NOT NULL DEFAULT FALSE;
