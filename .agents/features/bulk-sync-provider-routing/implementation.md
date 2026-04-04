# Bulk Sync Provider Routing Fix — Implementation

**Design**: [design.md](./design.md)

---

## Backend Implementation

### Phase 1: Model Changes

- [x] In `backend/src/models/bulk_sync.rs`, add `provider_type: Option<SplitProviderType>` field to `SyncItem` struct (with `#[serde(skip_serializing_if = "Option::is_none")]`)
- [x] Add `use crate::types::SplitProviderType;` import to `bulk_sync.rs`
- [x] Add `provider_type: Option<SplitProviderType>` to `SyncItemResult` struct (for retry support)

### Phase 2: Service & Handler Changes

- [x] In `backend/src/services/bulk_sync_service.rs`, update `execute_pull()` signature to accept `provider_type: Option<SplitProviderType>`
- [x] In `execute_pull()`, update the provider lookup (lines 252-262) to filter by `provider_type` when provided, falling back to first active provider when `None`
- [x] In `execute_bulk_sync()`, pass `item.provider_type` through to `execute_pull()` (line 87)
- [x] Add `use crate::types::SplitProviderType;` import
- [x] Add `provider_type` to all `SyncItemResult` struct literals (7 instances)
- [x] In `backend/src/handlers/bulk_sync.rs`, add `provider_type` to retry handler's `SyncItem` reconstruction
- [x] Run `cargo check` to verify compilation ✅

---

## Frontend Implementation

### Phase 3: Type Changes

- [x] In `frontend/src/types/sync.ts`, add optional `provider_type?: string` to `SyncItem` interface
- [x] In `frontend/src/types/sync.ts`, add optional `providerType?: string` to `DriftedSelection` interface
- [x] In `frontend/src/types/sync.ts`, add optional `provider_type?: string` to `SyncItemResult` interface

### Phase 4: Wizard State Changes

- [x] In `frontend/src/hooks/usecase/useSyncWizard.ts`, update `TOGGLE_DRIFTED` action type to include optional `providerType?: string`
- [x] In `frontend/src/hooks/usecase/useSyncWizard.ts`, update `SELECT_ALL_DRIFTED` entries type to include optional `providerType?: string`
- [x] In `wizardReducer`, pass `providerType` through when setting `DriftedSelection` in `TOGGLE_DRIFTED` and `SELECT_ALL_DRIFTED` cases
- [x] In `toggleDriftedItem`, add `providerType?: string` parameter and pass it to dispatch
- [x] In `selectAllDrifted`, add `providerType?: string` to entries type and pass through
- [x] Update `buildSyncItems()` to accept optional `report: DriftReport` parameter
- [x] In `buildSyncItems()` drifted section: include `provider_type: selection.providerType` in the SyncItem
- [x] In `buildSyncItems()` missing-on-local section: look up `provider_type` from `report.missing_on_local` by matching `external_expense_id`

### Phase 5: Component Changes

- [x] In `frontend/src/components/sync/wizard/DriftedStepView.tsx`, pass `item.provider_type` through `onToggle` calls
- [x] In `frontend/src/components/sync/wizard/DriftedStepView.tsx`, pass `providerType` through `selectAll` entries
- [x] In `frontend/src/components/sync/wizard/ReviewStepView.tsx`, update `buildSyncItems` type signature and pass `report`
- [x] Run TypeScript compilation check: `npx tsc --noEmit` ✅

---

## Verification

### Phase 6: Testing

- [x] `cargo check` passes (backend compiles)
- [x] `npx tsc --noEmit` passes (frontend compiles)
- [ ] Manual test: bulk sync with mixed Splitwise + SplitPro expenses routes correctly
