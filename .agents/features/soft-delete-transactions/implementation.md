# Soft Delete Transactions — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: N/A (user request)

---

## Backend Implementation

### Phase 1: Database & Configuration

#### 1.1 Migration

- [x] Create migration folder `backend/migrations/2026-03-15-211534-0000_add_soft_delete_to_transactions/`
- [x] Write `up.sql`: Add `is_deleted BOOLEAN NOT NULL DEFAULT FALSE` and `deleted_at TIMESTAMPTZ DEFAULT NULL` columns to `transactions` table
- [x] Write `up.sql`: Add partial index `idx_transactions_is_deleted` on `is_deleted` where `is_deleted = FALSE`
- [x] Write `down.sql`: Drop index and both columns
- [x] Run `diesel migration run` and verify
- [x] Run `diesel print-schema` to regenerate `schema.rs` — verify `is_deleted -> Bool` and `deleted_at -> Nullable<Timestamptz>` appear in the `transactions` table

#### 1.2 Configuration

- [x] Add `soft_delete_retention_days: i64` field to `Config` struct in `backend/src/config/mod.rs`
- [x] Parse `SOFT_DELETE_RETENTION_DAYS` env var in `Config::from_env()` with default of 30
- [x] Add validation in `Config::validate()`: `soft_delete_retention_days > 0`
- [x] Add `SOFT_DELETE_RETENTION_DAYS=30` to `.env.example` with comment

#### 1.3 Models

- [x] Add `is_deleted: bool` and `deleted_at: Option<DateTime<Utc>>` to `Transaction` struct in `backend/src/models/transaction.rs`
- [x] Add `#[serde(skip_serializing_if = "Option::is_none")]` `deleted_at: Option<DateTime<Utc>>` to `TransactionResponse`
- [x] Add `#[serde(skip_serializing_if = "Option::is_none")]` `permanent_delete_at: Option<DateTime<Utc>>` to `TransactionResponse`
- [x] Add `is_deleted: Option<bool>` to `TransactionFilter` struct
- [x] Create `DeleteTransactionQuery` struct with `is_permanent: Option<bool>` field for the delete endpoint query params
- [x] Update `From<Transaction> for TransactionResponse` impl to populate `deleted_at` (set `permanent_delete_at` to None — computed in service layer)
- [x] Update `From<TransactionWithDebtInfo> for TransactionResponse` impl similarly
- [x] Export new types from `backend/src/models/mod.rs` if needed

### Phase 2: Repository Layer

#### 2.1 Transaction Repository Changes

- [x] Update `list_transactions()` in `backend/src/repositories/transaction.rs` to add `.filter(transactions::is_deleted.eq(false))` by default, or `.filter(transactions::is_deleted.eq(true))` when `filters.is_deleted == Some(true)`
- [x] Update `find_by_id()` to NOT filter by `is_deleted` (needed for restore/permanent-delete operations — filtering happens in service layer)
- [x] Add `soft_delete_transaction(pool, transaction_id) -> Result<Transaction, ApiError>` — sets `is_deleted = true`, `deleted_at = now()`, returns updated transaction
- [x] Add `restore_transaction(pool, transaction_id) -> Result<Transaction, ApiError>` — sets `is_deleted = false`, `deleted_at = null`, returns updated transaction
- [x] Add `find_expired_soft_deleted(pool, cutoff: DateTime<Utc>) -> Result<Vec<Transaction>, ApiError>` — finds transactions where `is_deleted = true AND deleted_at < cutoff`
- [x] Add `hard_delete_transaction(pool, transaction_id) -> Result<(), ApiError>` — actual DELETE from DB (renamed existing `delete_transaction`)

#### 2.2 Transfer Repository Changes

- [x] Add `soft_delete_transfer_transactions(pool, transfer: &Transfer) -> Result<(), ApiError>` — sets `is_deleted = true` and `deleted_at = now()` on both `from_transaction_id` and `to_transaction_id`
- [x] Add `restore_transfer_transactions(pool, transfer: &Transfer) -> Result<(), ApiError>` — sets `is_deleted = false` and `deleted_at = null` on both transactions

### Phase 3: Service Layer

#### 3.1 Transaction Service Changes

- [x] Modify `delete_transaction()` in `backend/src/services/transaction_service.rs`:
  - Instead of hard-deleting, call `soft_delete_transaction()` from repository
  - For transfers: call `soft_delete_transfer_transactions()` instead of `delete_transfer_and_transactions()`
  - Return `TransactionResponse` with `deleted_at` and computed `permanent_delete_at`
- [x] Add `restore_transaction(pool, transaction_id, user_id) -> Result<TransactionResponse, ApiError>`:
  - Fetch transaction (including soft-deleted), verify ownership
  - Verify `is_deleted == true`, return 400 if not
  - If part of transfer: restore both sides
  - If standalone: restore single transaction
  - Return restored `TransactionResponse`
- [x] Add `permanent_delete_transaction(pool, transaction_id, user_id) -> Result<(), ApiError>`:
  - Fetch transaction (including soft-deleted), verify ownership
  - Verify `is_deleted == true`, return 400 if not
  - If part of transfer: hard-delete transfer record, both transactions, splits, debt metadata
  - If standalone: hard-delete splits, debt metadata, then transaction
- [x] Update `list_transactions()` to pass `is_deleted` filter from `TransactionFilter` to repository
- [x] Add helper to compute `permanent_delete_at` from `deleted_at` + retention days (read from config or accept as parameter)

#### 3.2 Analytics Service Changes

- [x] Audit `backend/src/services/analytics_service.rs` — ensure all transaction queries include `.filter(transactions::is_deleted.eq(false))` so soft-deleted transactions are excluded from dashboard totals

### Phase 4: Handler Layer

#### 4.1 Transaction Handler Changes

- [x] Modify `delete()` handler in `backend/src/handlers/transactions.rs`:
  - Accept `Query(query): Query<DeleteTransactionQuery>` parameter
  - If `query.is_permanent == Some(true)`: call `permanent_delete_transaction()`, return 204
  - Otherwise: call soft-delete service, return 200 with `TransactionResponse`
- [x] Add `restore()` handler:
  - `POST /transactions/:id/restore`
  - Call `restore_transaction()` service
  - Return 200 with `TransactionResponse`

#### 4.2 Route Registration

- [x] Add `POST /transactions/:id/restore` route in `backend/src/api/routes.rs` with `Transactions` scope and `Write` operation
- [x] Update `DELETE /transactions/:id` route to accept query parameters (handler signature change handles this)

#### 4.3 Handler Module

- [x] Export `restore` handler from `backend/src/handlers/mod.rs` if needed

### Phase 5: Worker Changes

#### 5.1 Purge Function

- [x] Add `purge_soft_deleted_transactions(pool, retention_days)` function in `backend/src/bin/worker.rs`:
  - Compute cutoff date: `Utc::now() - Duration::days(retention_days)`
  - Call `find_expired_soft_deleted(pool, cutoff)` from repository
  - For each expired transaction:
    - Check if part of transfer via `find_transfer_by_transaction_id()`
    - If transfer: call `delete_transfer_and_transactions()` (existing hard-delete)
    - If standalone: delete splits, debt metadata, then hard-delete transaction
  - Log count of purged transactions
- [x] Call `purge_soft_deleted_transactions()` in the daily cleanup cycle (alongside `run_cleanup()` in the date-change block)
- [x] Read `retention_days` from `Config::from_env().soft_delete_retention_days`

---

## Frontend Implementation

### Phase 6: Types & Services

#### 6.1 Type Updates

- [x] Add `deleted_at?: string` to `Transaction` interface in `frontend/src/types/models.ts`
- [x] Add `permanent_delete_at?: string` to `Transaction` interface
- [x] Add `deleted_at?: string` and `permanent_delete_at?: string` to `EnrichedTransaction` interface

#### 6.2 Service Functions

- [x] Add `getTrashTransactions(params?)` to `frontend/src/services/transactionService.ts` — calls `GET /transactions?is_deleted=true` with optional `limit`/`offset`
- [x] Add `restoreTransaction(id: string)` to `transactionService.ts` — calls `POST /transactions/${id}/restore`
- [x] Add `permanentDeleteTransaction(id: string)` to `transactionService.ts` — calls `DELETE /transactions/${id}?is_permanent=true`

### Phase 7: Hooks

#### 7.1 New API Hooks

- [x] Create `frontend/src/hooks/api/useTrashTransactions.ts` — React Query hook with key `['transactions', 'trash']`, calls `getTrashTransactions()`
- [x] Create `frontend/src/hooks/api/useRestoreTransaction.ts` — mutation hook, invalidates `['transactions']` and `['transactions', 'trash']` on success
- [x] Create `frontend/src/hooks/api/usePermanentDeleteTransaction.ts` — mutation hook, invalidates `['transactions', 'trash']` on success
- [x] Export all three from `frontend/src/hooks/api/index.ts`

### Phase 8: Trash Page & Components

#### 8.1 Trash Page

- [x] Create `frontend/src/pages/Trash.tsx` — `TrashPage` component:
  - Uses `useTrashTransactions` hook for data
  - Uses `useAccounts` and `useCategories` for enrichment (or use `useEnrichedTransactions`)
  - Renders `PageHeader` with title "Trash"
  - Renders list of `TrashTransactionRow` components
  - Shows empty state when no trashed transactions
  - Loading and error states

#### 8.2 Trash Transaction Row

- [x] Create `frontend/src/components/transactions/TrashTransactionRow.tsx`:
  - Displays transaction title, amount, date, account name
  - Shows "Deleted on" date (from `deleted_at`)
  - Shows "Permanently deleted on" date (from `permanent_delete_at`)
  - Restore button (calls `useRestoreTransaction`)
  - Permanent delete button with confirmation dialog (calls `usePermanentDeleteTransaction`)

### Phase 9: Navigation & Routing

#### 9.1 Routing

- [x] Add `<Route path="trash" element={<TrashPage />} />` in `frontend/src/App.tsx` inside the protected routes
- [x] Import `TrashPage` from `@/pages/Trash`

#### 9.2 Sidebar Navigation

- [x] Add `MdDelete` (or `MdDeleteOutline`) import from `react-icons/md` in `frontend/src/components/layout/Sidebar.tsx`
- [x] Add `<NavItem icon={MdDelete} label="Trash" to="/trash" onClick={onClose} isCollapsed={isCollapsed} />` to the sidebar navigation (after Settings or in a logical position)

### Phase 10: Modify Existing Components

#### 10.1 Delete Confirmation Dialogs

- [x] Update delete confirmation message in `frontend/src/pages/Transactions.tsx` from "This action cannot be undone" to "This transaction will be moved to trash and permanently deleted after 30 days"
- [x] Update delete confirmation message in `frontend/src/pages/TransactionDetail.tsx` similarly

#### 10.2 Delete Hook Enhancement

- [x] Update `frontend/src/hooks/api/useDeleteTransaction.ts` `onSuccess` to also invalidate `['transactions', 'trash']` query
- [x] Optionally: add a toast notification "Transaction moved to trash" on successful delete

#### 10.3 TypeScript Compilation

- [x] Verify TypeScript compiles cleanly with `npm run build` or `npx tsc --noEmit`

---

## Testing & Verification

### Phase 11: Backend Testing

- [x] Write/run backend tests for soft delete service logic
- [x] Write/run backend tests for restore service logic
- [x] Write/run backend tests for permanent delete service logic
- [x] Write/run backend tests for transfer pair soft-delete/restore
- [x] Verify `cargo clippy` passes with no new warnings (pre-existing warnings in unrelated files)
- [x] Verify `cargo fmt` is clean for all modified files
- [x] Follow backend testing checklist (see `.agents/testing/testing-backend.md`)

### Phase 12: Frontend Testing & Verification

- [x] Test in browser: delete a transaction → verify it disappears from transaction list
- [x] Test in browser: navigate to Trash → verify deleted transaction appears with dates
- [x] Test in browser: restore a transaction from Trash → verify it reappears in transaction list
- [x] Test in browser: permanently delete from Trash → verify it's gone
- [x] Test in browser: delete a transfer transaction → verify both sides appear in Trash
- [x] Test in browser: restore a transfer transaction → verify both sides are restored
- [x] Test in browser: verify dashboard totals exclude soft-deleted transactions
- [x] Follow frontend testing checklist (see `.agents/testing/testing-front-end.md`)
