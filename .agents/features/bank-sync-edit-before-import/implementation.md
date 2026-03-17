# Bank Sync: Edit Before Import — Implementation

## Status: Not Started

## Phase 1: Backend — Extend `bulk-create` with Bank Sync Metadata

### 1.1 Add `BankSyncMetadata` model

**File:** `backend/src/models/bulk_transaction.rs`

- [ ] Add `BankSyncMetadata` struct with `bank_provider_id: Uuid` and `external_transaction_ids: Vec<String>`
- [ ] Derive `Debug, Deserialize` for `BankSyncMetadata`
- [ ] Add `pub bank_sync_metadata: Option<BankSyncMetadata>` field to `BulkCreateRequest`
- [ ] Document with `///` doc comments

### 1.2 Add `account_id` to `BankSyncReport`

**File:** `backend/src/models/bank_sync.rs`

- [ ] Add `pub account_id: String` field to `BankSyncReport` struct

**File:** `backend/src/services/bank_sync_service.rs`

- [ ] Set `account_id: provider_record.account_id.to_string()` when building the `BankSyncReport`

### 1.3 Update service to handle bank sync records

**File:** `backend/src/services/transaction_service.rs`

- [ ] Update `bulk_create_transactions` signature to accept `bank_sync_metadata: Option<BankSyncMetadata>`
- [ ] After creating transactions, if metadata is present:
  - Validate `external_transaction_ids.len() == created_transactions.len()`
  - Build `Vec<NewBankSyncRecord>` pairing each created transaction ID with its external ID and `bank_provider_id`
  - Call `repositories::bank_sync::create_records` to insert sync records
- [ ] Use `?` error propagation, return `ApiError` on validation failure

### 1.4 Update handler to pass metadata through

**File:** `backend/src/handlers/transactions.rs`

- [ ] Pass `request.bank_sync_metadata` to `transaction_service::bulk_create_transactions`
- [ ] Handler stays thin — no business logic added

**File:** `backend/src/handlers/import.rs`

- [ ] Update the duplicate `bulk_create_transactions` handler to also pass metadata (or remove it — see Phase 5)

### 1.5 Backend tests

- [ ] Test bulk-create without `bank_sync_metadata` (backward compatibility — existing CSV import)
- [ ] Test bulk-create with `bank_sync_metadata` (creates transactions + sync records)
- [ ] Test mismatched array lengths returns validation error
- [ ] Test that `find_imported_ids` returns the newly created external IDs

## Phase 2: Frontend — Types, Service, and Utility

### 2.1 Update types

**File:** `frontend/src/types/bankProvider.ts`

- [ ] Add `account_id: string` to `BankSyncReport` interface

**File:** `frontend/src/types/statementImport.ts`

- [ ] Add `BankSyncMetadata` interface: `{ bank_provider_id: string; external_transaction_ids: string[] }`
- [ ] Add optional `bank_sync_metadata?: BankSyncMetadata` to `BulkCreateRequest`

### 2.2 Update service

**File:** `frontend/src/services/statementImportService.ts`

- [ ] `bulkCreateTransactions` already sends the full `BulkCreateRequest` — no change needed if the type is updated
- [ ] Verify the request body includes `bank_sync_metadata` when present

### 2.3 Create converter utility

**File:** `frontend/src/utils/bankTransactionConverter.ts` (new)

- [ ] Create `bankTxnToParsed(txn: FetchedBankTransaction): ParsedTransaction` — pure function
  - Map `external_id` → `temp_id`
  - Build title from description/merchant (same logic as backend)
  - Convert amount to signed string based on `transaction_type`
  - Map date
  - Set `is_valid: true`, `is_potential_duplicate: false`
- [ ] Create `buildBankSyncMetadata(bankProviderId: string, transactions: FetchedBankTransaction[]): BankSyncMetadata` — pure function
  - Returns `{ bank_provider_id, external_transaction_ids: txns.map(t => t.external_id) }`

## Phase 3: Frontend — Custom Hook

### 3.1 Create `useBankImportPreview` hook

**File:** `frontend/src/hooks/usecase/useBankImportPreview.ts` (new)

- [ ] Manage `step` state: `'select' | 'preview'`
- [ ] Store `previewTransactions: ParsedTransaction[]`, `bankSyncMetadata`, and `accountId`
- [ ] `showPreview(selectedTxns, bankProviderId, accountId)`: converts to ParsedTransaction[], builds metadata, stores accountId, switches to preview
- [ ] `goBackToSelect()`: resets to select step
- [ ] `handleConfirmImport(editedTxns)`: calls `bulkCreateTransactions` with edited data + metadata, shows toast, invalidates queries
- [ ] `isImporting` loading state
- [ ] Export from `frontend/src/hooks/usecase/index.ts`

## Phase 4: Frontend — UI Component Updates

### 4.1 Update `BankSyncReportView`

**File:** `frontend/src/components/bank/BankSyncReportView.tsx`

- [ ] Import and use `useBankImportPreview` hook
- [ ] Import `useCategories` hook for category data (React Query caching)
- [ ] Import `TransactionPreviewStep` from transactions import
- [ ] When step is `'select'`: show existing selection UI, change Import button to call `showPreview`
- [ ] When step is `'preview'`: show `TransactionPreviewStep` with converted transactions and categories
- [ ] Wire up `onImport` callback to `handleConfirmImport`
- [ ] Wire up `onBack` callback to `goBackToSelect`

### 4.2 Update `BankSyncReview`

**File:** `frontend/src/components/bank/BankSyncReview.tsx`

- [ ] Apply same two-step flow as `BankSyncReportView`
- [ ] Use `useBankImportPreview` hook
- [ ] Import categories and `TransactionPreviewStep`
- [ ] Replace direct import button with preview flow

### 4.3 Update `useBankSync` hook

**File:** `frontend/src/hooks/usecase/useBankSync.ts`

- [ ] Remove `useImportBankTransactions` import and usage
- [ ] Remove `handleImport` function (replaced by `useBankImportPreview`)
- [ ] Remove `isImporting` state (moved to new hook)

## Phase 5: Cleanup — Remove Deprecated APIs

### 5.1 Backend cleanup

- [ ] Remove `POST /bank-providers/sync/:job_id/import` route from `backend/src/api/routes.rs`
- [ ] Remove `import_transactions` handler from `backend/src/handlers/bank_providers.rs`
- [ ] Remove `import_transactions` service function from `backend/src/services/bank_sync_service.rs`
- [ ] Remove `BankSyncImportRequest` from `backend/src/models/bank_provider.rs`
- [ ] Remove `BankImportResult` from `backend/src/models/bank_sync.rs`
- [ ] Remove duplicate `bulk_create_transactions` handler from `backend/src/handlers/import.rs` (dead code)
- [ ] Clean up any `mod.rs` re-exports that reference removed items
- [ ] Run `cargo clippy` and `cargo fmt` to verify no warnings

### 5.2 Frontend cleanup

- [ ] Remove `importTransactions` function from `frontend/src/services/bankProviderService.ts`
- [ ] Remove `useImportBankTransactions` hook from `frontend/src/hooks/api/useBankProviders.ts`
- [ ] Remove `BankSyncImportRequest` and `BankImportResult` types from `frontend/src/types/bankProvider.ts`
- [ ] Remove re-export of `useImportBankTransactions` from `frontend/src/hooks/api/index.ts`
- [ ] Remove `importTransactions` import from `bankProviderService.ts` imports in `useBankProviders.ts`

### 5.3 Backend test cleanup

- [ ] Remove or update any integration tests that test the old `POST /bank-providers/sync/:job_id/import` endpoint
- [ ] Verify all existing tests still pass

## Phase 6: Verification

- [ ] Manual test: bank sync job detail page shows preview after clicking Import
- [ ] Manual test: edit title, amount, date, category in preview table
- [ ] Manual test: confirm import creates transactions with edited values
- [ ] Manual test: back button returns to selection step
- [ ] Manual test: import without edits still works correctly
- [ ] Manual test: future bank sync correctly detects previously imported transactions as duplicates
- [ ] Manual test: CSV import still works unchanged (backward compatibility)
- [ ] Run `cargo test` — all backend tests pass
- [ ] Run `cargo clippy` — no warnings
