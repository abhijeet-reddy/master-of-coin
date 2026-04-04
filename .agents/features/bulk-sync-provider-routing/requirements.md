# Bulk Sync Provider Routing Fix — Requirements

**GitHub Issue**: N/A (Production bug)
**Date**: 2026-04-04
**Status**: Draft

## Summary

When a user has multiple active split providers (e.g., both Splitwise and SplitPro), the bulk sync "pull" operation sends all external expense IDs to a single provider — whichever active provider is found first. This causes failures when a Splitwise expense ID (numeric, e.g., `4383330546`) is sent to SplitPro (which expects UUIDs), resulting in an HTTP 500 from SplitPro's Prisma ORM.

The drift detection system correctly fetches expenses from all active providers and tags each item with its `provider_type`. However, this `provider_type` is dropped when the frontend builds the `SyncItem` array and the backend `SyncItem` model has no field for it.

## User Stories

1. As a user with both Splitwise and SplitPro configured, when I run drift detection and select expenses from both providers for bulk sync, all items should sync successfully to their respective providers.
2. As a user, when I select a Splitwise expense for pull sync, it should be fetched from Splitwise — not from SplitPro.
3. As a user, when I select a SplitPro expense for pull sync, it should be fetched from SplitPro — not from Splitwise.

## Acceptance Criteria

- [ ] `SyncItem` (backend and frontend) includes an optional `provider_type` field
- [ ] `buildSyncItems()` in the sync wizard populates `provider_type` from the drift report data
- [ ] `execute_pull()` uses the provided `provider_type` to find the correct provider instead of blindly picking the first active one
- [ ] Bulk sync of mixed Splitwise + SplitPro expenses succeeds for all items
- [ ] Backward compatibility: if `provider_type` is not provided, falls back to current behavior (first active provider)
- [ ] TypeScript compiles cleanly
- [ ] Rust compiles cleanly

## Scope

| Feature                                    | In Scope | Future |
| ------------------------------------------ | -------- | ------ |
| Add `provider_type` to `SyncItem` model    | ✅       |        |
| Thread `provider_type` through frontend    | ✅       |        |
| Update `execute_pull()` provider lookup    | ✅       |        |
| Backward-compatible fallback               | ✅       |        |
| Update `execute_push()` for multi-provider |          | ✅     |
| Add provider badge to sync result UI       |          | ✅     |

## Out of Scope

- Changing the drift detection logic (it already works correctly)
- Adding provider_id (UUID) — using `provider_type` (enum) is simpler and sufficient since a user can only have one provider per type
- Modifying the push flow (push already has `transaction_id` which links to the correct provider via `transaction_split` → `split_sync_record`)

## Dependencies

- None — this is a self-contained bug fix

## Open Questions

- None
