# Soft Delete Transactions — Requirements

**GitHub Issue**: N/A (user request)
**Date**: 2026-03-15
**Status**: Draft

## Summary

Currently, deleting a transaction permanently removes it from the database immediately. This feature introduces a **soft delete** mechanism where transactions are marked as deleted but retained for a configurable period (default: 30 days). During this grace period, users can view and restore soft-deleted transactions from the UI. After the grace period expires, transactions are permanently purged automatically.

This provides a safety net against accidental deletions while keeping the database clean over time.

## User Stories

1. As a user, when I delete a transaction, it disappears from my normal transaction views but is not permanently removed yet.
2. As a user, I can view a list of my recently deleted transactions and see when each will be permanently removed.
3. As a user, I can restore a soft-deleted transaction, returning it to its original state (including any associated data like splits, debt metadata, and transfer links).
4. As a user, when I delete a transaction that is part of a transfer, both sides of the transfer are soft-deleted together.
5. As a user, when I restore a transfer transaction, both sides are restored together.
6. As a user, I can permanently delete a soft-deleted transaction immediately from the trash if I don't want to wait for the grace period.
7. As an admin/self-hoster, I can configure the soft delete retention period via an environment variable.

## Acceptance Criteria

- [ ] Deleting a transaction marks it as deleted instead of removing it from the database
- [ ] Soft-deleted transactions are excluded from all normal views (transaction list, dashboard, budgets, account details, etc.)
- [ ] A "Trash" or "Recently Deleted" view shows soft-deleted transactions with their scheduled permanent deletion date
- [ ] Users can restore individual transactions from the trash view
- [ ] Transfer pairs are soft-deleted and restored as a unit (matching current paired-delete behavior)
- [ ] Expired soft-deleted transactions are automatically purged after the retention period
- [ ] Retention period is configurable via environment variable (default: 30 days)
- [ ] Users can permanently delete a transaction from trash immediately
- [ ] The delete confirmation dialog informs the user that the transaction will be moved to trash (not permanently deleted)

## Scope

| Feature                                 | In Scope | Future |
| --------------------------------------- | -------- | ------ |
| Soft delete for transactions            | ✅       |        |
| Soft delete for transfer pairs          | ✅       |        |
| Trash view in frontend                  | ✅       |        |
| Restore from trash                      | ✅       |        |
| Permanent delete from trash             | ✅       |        |
| Configurable retention period           | ✅       |        |
| Automatic purge of expired transactions | ✅       |        |
| Soft delete for accounts                |          | ✅     |
| Soft delete for categories              |          | ✅     |
| Soft delete for budgets                 |          | ✅     |
| Undo toast with immediate undo          |          | ✅     |

## Out of Scope

- Soft delete for non-transaction entities (accounts, categories, budgets, people)
- Audit log of deletion/restoration events
- Bulk restore from trash
- Export of trashed transactions

## Dependencies

- Existing background worker for automatic purge of expired transactions
- Existing transfer pairing logic for paired delete/restore

## Open Questions

- None — all questions resolved during design discussion
