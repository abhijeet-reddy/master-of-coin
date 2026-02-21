# Drift Detection — Requirements

**GitHub Issue**: [#40 - Bulk split sync comparison API — diff local vs external expenses by date range](https://github.com/abhijeet-reddy/master-of-coin/issues/40)
**Date**: 2026-02-21
**Status**: In Progress

## Summary

Add a **drift detection API** that takes a date range, fetches all split expenses from both local and external systems (using each person's configured split provider), and returns a **drift report** showing what is in sync, what has drifted, and what is missing on each side.

Currently, split sync is **per-transaction only** — the user must open each transaction detail page and click "Sync" individually. There is no way to get a holistic view of sync status across a date range. This feature provides that holistic view as a **read-only comparison** — it does not auto-resolve anything.

## User Stories

1. As a user, I can request a drift report for a date range and see a summary of how many transactions are synced, drifted, or missing on either side.
2. As a user, I can see the detailed list of drifted items with local vs external comparison data so I can decide which ones to resolve.
3. As a user, I can see which local transactions are missing on the external provider so I can push them.
4. As a user, I can see which external expenses are missing locally so I can import them.
5. As a user, I don't need to specify which provider to use — the API automatically resolves providers from each person's split config.

## Acceptance Criteria

- [ ] API accepts `start_date` (required) and optional `end_date` (defaults to today)
- [ ] Automatically resolves providers from each person's split config via `person_split_configs`
- [ ] Returns summary counts: total local, total external, synced, drifted, missing on external, missing on local
- [ ] Returns detailed drift list with local vs external comparison data
- [ ] Returns list of local transactions missing on external provider
- [ ] Returns list of external expenses missing locally
- [ ] Handles multiple friends/persons and providers correctly (deduplicates external expenses)
- [ ] Integration tests covering: all-synced, drift detection, missing on both sides

## Scope

| Feature                                         | In Scope | Future |
| ----------------------------------------------- | -------- | ------ |
| Read-only drift detection API (GET endpoint)    | ✅       |        |
| Summary counts                                  | ✅       |        |
| Detailed drift list                             | ✅       |        |
| Missing on external list                        | ✅       |        |
| Missing on local list                           | ✅       |        |
| Multi-provider support via person_split_configs | ✅       |        |
| External expense deduplication                  | ✅       |        |
| Integration tests                               | ✅       |        |
| Auto-resolve/bulk sync actions                  |          | ✅     |
| Frontend UI for drift report                    |          | ✅     |
| Scheduled/periodic drift checks                 |          | ✅     |

## Out of Scope

- **Auto-resolution**: This API is read-only; it does not push, pull, or resolve any mismatches
- **Frontend UI**: No frontend components in this issue — backend API only
- **Bulk sync actions**: No "sync all" or "resolve all" functionality
- **Scheduled checks**: No cron/background job for periodic drift detection

## Dependencies

- Existing `SplitProvider` trait with `get_expenses()` method
- Existing `split_sync_records` table for identifying already-linked pairs
- Existing `person_split_configs` table for resolving person → provider mappings
- Existing `SplitSyncService` with `compare_splits()` and `compare_debt_splits()` methods

## Open Questions

- None — the issue requirements are clear and the existing infrastructure supports all needed operations.
