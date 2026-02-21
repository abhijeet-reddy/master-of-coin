# Sync API — Requirements

**GitHub Issue**: [#41 - Scheduled split sync & sync management UI](https://github.com/abhijeet-reddy/master-of-coin/issues/41) (Sub-feature A)
**Date**: 2026-02-21
**Status**: In Progress

## Summary

Add an **async bulk sync API** that accepts an array of sync operations — each specifying an action (push or pull) and an identifier (local transaction ID or external expense ID) — creates a background job, and processes them asynchronously via the worker. The frontend polls for results. This follows the same async job pattern as the drift detection API.

The existing codebase already has per-transaction sync methods in `SplitSyncService` (`sync_transaction()`, `resolve_mismatch()`, `sync_external_expense()`). This feature wraps them in an async bulk job that the worker processes sequentially, storing per-item results.

This is Sub-feature A of issue #41. It focuses on the **backend API only** — no frontend UI, no scheduled sync.

## User Stories

1. As a user, I can submit a list of sync operations (push and/or pull) in a single API call and receive a job ID immediately.
2. As a user, I can poll the job status to see progress and per-item results as they complete.
3. As a user, I can **push** local transactions to the external provider — creating or updating expenses on the provider side.
4. As a user, I can **pull** external expenses into my local system — importing them as new transactions or updating existing linked ones.
5. As a user, if some items in a bulk sync job fail, the others still succeed — one failure does not block the rest.

## Acceptance Criteria

- [ ] `POST /api/v1/sync` accepts an array of `{action, transaction_id?, external_expense_id?}` items, creates a `BULK_SYNC` background job, returns 202 with job_id
- [ ] `GET /api/v1/sync/:job_id` returns job status and per-item results when completed
- [ ] Worker processes `BULK_SYNC` jobs by iterating through items sequentially
- [ ] **Push** action: accepts a `transaction_id`, pushes local splits to the external provider (creates or updates)
- [ ] **Pull** action: accepts an `external_expense_id`, imports the external expense into the local system (creates or updates)
- [ ] Items are processed sequentially to avoid provider rate limiting
- [ ] Per-item results stored in job result: each item gets a success/failure status with details
- [ ] One item's failure does not prevent other items from being processed
- [ ] Push on an already-linked transaction updates the external expense with local split data
- [ ] Push on an unlinked transaction creates a new expense on the provider
- [ ] Pull on an unlinked external expense imports it as a local transaction
- [ ] Pull on a linked external expense updates the local transaction with external data
- [ ] New `BULK_SYNC` variant added to `JobType` enum (requires ALTER TYPE migration)
- [ ] Worker dispatches `BULK_SYNC` jobs alongside existing `DRIFT_DETECTION` jobs
- [ ] Proper error handling: provider not configured, provider API failure, transaction not found, etc.
- [ ] Integration tests covering: bulk push, bulk pull, mixed push+pull, partial failures, error cases

## Scope

| Feature                                             | In Scope | Future |
| --------------------------------------------------- | -------- | ------ |
| Async bulk sync endpoint via background_jobs        | ✅       |        |
| Poll endpoint for job status and results            | ✅       |        |
| BULK_SYNC job type in worker                        | ✅       |        |
| Sequential processing with per-item results         | ✅       |        |
| Push - local to external - create or update         | ✅       |        |
| Pull - external to local - create or update         | ✅       |        |
| Error isolation - one failure does not block others | ✅       |        |
| Integration tests                                   | ✅       |        |
| Ignore/dismiss functionality                        |          | ✅     |
| Frontend UI                                         |          | ✅     |
| Scheduled/recurring sync                            |          | ✅     |

## Out of Scope

- **Frontend UI**: No frontend components — backend API only (Sub-feature B)
- **Scheduled sync**: No cron/schedule management (Sub-feature C)
- **Ignore/dismiss**: No mechanism to mark items as ignored
- **Concurrent processing**: Items processed sequentially to respect provider rate limits

## Dependencies

- Existing `background_jobs` table and worker infrastructure (from drift detection, #40)
- Existing `SplitSyncService` with `sync_transaction()`, `resolve_mismatch()`, and `sync_external_expense()` methods
- Existing `split_providers` and `person_split_configs` tables for provider resolution
- Existing `split_sync_records` table for tracking sync state
- Existing `JobType` and `JobStatus` enums in `backend/src/types/job_types.rs`

## Open Questions

- None — the existing `SplitSyncService` methods and `background_jobs` infrastructure cover all needed operations. The new feature adds a `BULK_SYNC` job type and orchestrates existing sync methods with per-item error handling.
