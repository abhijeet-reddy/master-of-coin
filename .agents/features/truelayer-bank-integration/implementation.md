# Open Banking Integration — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: N/A

---

## Backend Implementation

### Phase 1: Database & Types

#### 1.1 Migration: Create `bank_provider_type` enum and `bank_providers` table

- [x] Generate migration: `cd backend && diesel migration generate create_bank_providers`
- [x] Write `up.sql`:
  - Create `bank_provider_type` enum with `'TRUELAYER'`
  - Add `'BANK_SYNC'` to `job_type` enum
  - Create `bank_providers` table with `account_id UNIQUE` constraint
- [x] Write `down.sql` (drop table, remove enum values)
- [x] Run migration: `diesel migration run`
- [x] Verify `schema.rs` is updated correctly

#### 1.2 Migration: Create `bank_sync_records` table

- [x] Generate migration: `cd backend && diesel migration generate create_bank_sync_records`
- [x] Write `up.sql`:
  - Create `bank_sync_records` table with `UNIQUE(bank_provider_id, external_transaction_id)`
- [x] Write `down.sql`
- [x] Run migration: `diesel migration run`
- [x] Verify `schema.rs` is updated correctly

#### 1.3 Rust Types

- [x] Create `backend/src/types/bank_provider_type.rs`:
  - `BankProviderType` enum with `TrueLayer` variant
  - Implement `ToSql` / `FromSql` for Diesel
  - Implement `Serialize` / `Deserialize`
- [x] Add `BankSync` variant to `JobType` enum in `backend/src/types/job_types.rs`
  - Update `ToSql` / `FromSql` implementations
- [x] Register new type in `backend/src/types/mod.rs`

#### 1.4 Database Models

- [x] Create `backend/src/models/bank_provider.rs`:
  - `BankProviderRecord` (Queryable)
  - `NewBankProvider` (Insertable)
  - `BankProviderResponse` (Response DTO, excludes credentials)
  - `BankAuthUrlRequest` (for auth-url endpoint)
  - `BankSyncRequest` (for sync endpoint, with optional date range)
  - `BankSyncImportRequest` (for import endpoint, with transaction IDs)
- [x] Create `backend/src/models/bank_sync.rs`:
  - `BankSyncRecord` (Queryable)
  - `NewBankSyncRecord` (Insertable)
  - `BankSyncReport` (stored as JSONB in job result)
  - `BankSyncSummary`
  - `FetchedBankTransaction`
  - `BankBalanceInfo`
  - `BankSyncJobResponse`
  - `BankImportResult`
- [x] Register models in `backend/src/models/mod.rs`

### Phase 2: Bank Provider Trait & TrueLayer Implementation

#### 2.1 Generic BankProvider Trait

- [x] Create `backend/src/services/bank_provider/mod.rs`:
  - Define `BankProvider` async trait
  - Define `all_bank_providers()` registry function
  - Re-export types
- [x] Create `backend/src/services/bank_provider/types.rs`:
  - `BankTokens` struct (access_token, refresh_token, expires_at)
  - `BankAccount` struct (id, name, type, currency, account_number, sort_code)
  - `BankTransaction` struct (id, description, amount, currency, date, type, merchant, category)
  - `BankBalance` struct (current, available, currency, updated_at)
  - `BankProviderError` enum (AuthFailed, TokenExpired, RateLimited, ApiError, NetworkError, InvalidResponse)
- [x] Register module in `backend/src/services/mod.rs`

#### 2.2 TrueLayer Implementation

- [x] Create `backend/src/services/bank_provider/truelayer.rs`:
  - `TrueLayerProvider` struct with `client_id`, `client_secret`, `environment`
  - `TrueLayerProvider::from_env()` — reads `TRUELAYER_CLIENT_ID`, `TRUELAYER_CLIENT_SECRET`, `TRUELAYER_ENVIRONMENT`
  - Implement `BankProvider` trait:
    - `generate_auth_url()` — builds TrueLayer auth link with scopes: `info accounts balance transactions offline_access`
    - `exchange_code()` — POST to `https://auth.truelayer-sandbox.com/connect/token`
    - `refresh_token()` — POST to token endpoint with `grant_type=refresh_token`
    - `fetch_accounts()` — GET `https://api.truelayer-sandbox.com/data/v1/accounts`
    - `fetch_transactions()` — GET `https://api.truelayer-sandbox.com/data/v1/accounts/{id}/transactions`
    - `fetch_balance()` — GET `https://api.truelayer-sandbox.com/data/v1/accounts/{id}/balance`
  - URL selection based on environment (sandbox vs production)
  - Auto-refresh token if expired (check `token_expires_at` before API calls)

### Phase 3: Repositories

#### 3.1 Bank Provider Repository

- [x] Create `backend/src/repositories/bank_provider.rs`:
  - `create()` — Insert new bank provider
  - `find_by_id()` — Find by ID with user_id check
  - `find_by_account_id()` — Find by account_id
  - `list_by_user()` — List all for a user
  - `update_credentials()` — Update encrypted credentials (after token refresh)
  - `update_last_sync()` — Update last_sync_at timestamp
  - `update_external_account_id()` — Set the linked external account
  - `deactivate()` — Set is_active = false
  - `delete()` — Hard delete (cascade to sync records)
- [x] Register in `backend/src/repositories/mod.rs`

#### 3.2 Bank Sync Repository

- [x] Create `backend/src/repositories/bank_sync.rs`:
  - `find_imported_ids()` — Get all external_transaction_ids for a provider (for duplicate detection)
  - `create_records()` — Batch insert sync records when transactions are imported
  - `find_by_provider()` — List all sync records for a provider
- [x] Register in `backend/src/repositories/mod.rs`

### Phase 4: Service Layer

#### 4.1 Bank Sync Service

- [x] Create `backend/src/services/bank_sync_service.rs`:
  - `sync_bank_transactions()` — Main sync function called by worker:
    1. Load bank provider record, decrypt credentials
    2. Check token expiry, refresh if needed (update stored credentials)
    3. Call `fetch_accounts()` to get the linked external account
    4. Call `fetch_transactions()` for the date range
    5. Call `fetch_balance()` for current balance
    6. Load previously-imported IDs from `bank_sync_records`
    7. Mark each fetched transaction as `already_imported` or new
    8. Build and return `BankSyncReport`
  - `import_transactions()` — Import selected transactions:
    1. Validate selected external IDs exist in the sync report
    2. Create Master of Coin transactions for each selected item
    3. Insert `bank_sync_records` for each imported transaction
    4. Return import result with counts
- [x] Register in `backend/src/services/mod.rs`

### Phase 5: HTTP Handlers & Routing

#### 5.1 Bank Provider Handlers

- [x] Create `backend/src/handlers/bank_providers.rs`:
  - `list_bank_providers()` — GET /api/v1/bank-providers
  - `get_truelayer_auth_url()` — GET /api/v1/bank-providers/truelayer/auth-url
    - Accept `account_id` as query param
    - Generate state token (encrypt user_id + account_id)
    - Return auth URL + state
  - `truelayer_oauth_callback()` — GET /api/v1/bank-providers/truelayer/callback
    - Validate state token
    - Exchange code for tokens
    - Encrypt and store credentials in bank_providers
    - Redirect to frontend success page
  - `disconnect_bank_provider()` — DELETE /api/v1/bank-providers/:id
  - `start_sync()` — POST /api/v1/bank-providers/:id/sync
    - Create BANK_SYNC background job
    - Return 202 Accepted with job_id
  - `get_sync_job()` — GET /api/v1/bank-providers/sync/:job_id
    - Return job status + result (BankSyncReport)
  - `import_transactions()` — POST /api/v1/bank-providers/sync/:job_id/import
    - Accept list of external transaction IDs to import
    - Call bank_sync_service::import_transactions()
  - `get_balance()` — GET /api/v1/bank-providers/:id/balance
    - Fetch live balance from provider
  - `list_external_accounts()` — GET /api/v1/bank-providers/:id/accounts
    - Fetch bank accounts from provider (for linking)
  - `link_external_account()` — PUT /api/v1/bank-providers/:id/link-account
    - Set external_account_id on the bank provider record
- [x] Register handlers in `backend/src/handlers/mod.rs`
- [x] Add routes in `backend/src/api/routes.rs`

### Phase 6: Worker Integration

#### 6.1 Add BANK_SYNC Job Dispatch

- [x] Update `backend/src/bin/worker.rs`:
  - Add `BANK_SYNC` arm to `execute_job()` match
  - Create `execute_bank_sync_job()` function:
    - Parse input (bank_provider_id, from_date, to_date)
    - Call `bank_sync_service::sync_bank_transactions()`
    - Return serialized `BankSyncReport`
  - Add `BankSync` to `build_job_input()` match (for future scheduled sync)
  - Initialize bank providers in worker startup (similar to investment providers)

### Phase 7: Environment Configuration

- [x] Add TrueLayer env vars to `.env.example`:
  - `TRUELAYER_CLIENT_ID`
  - `TRUELAYER_CLIENT_SECRET`
  - `TRUELAYER_REDIRECT_URI`
  - `TRUELAYER_ENVIRONMENT=sandbox`

### Phase 8: Backend Testing

- [ ] Write integration tests in `backend/tests/integration/api/test_bank_providers.rs`:
  - Test list bank providers (empty, with providers)
  - Test OAuth callback with mock token exchange
  - Test disconnect bank provider
  - Test start sync job
  - Test get sync job status
  - Test import transactions with duplicate detection
  - Test balance fetch
- [ ] All backend tests passing

---

## Frontend Implementation

### Phase 9: Types & Services

- [x] Create `frontend/src/types/bankProvider.ts`:
  - `BankProviderType` enum
  - `BankProvider` interface
  - `BankSyncJobResponse` interface
  - `BankSyncReport` interface
  - `FetchedBankTransaction` interface
  - `BankBalanceInfo` interface
  - `BankImportResult` interface
- [x] Create `frontend/src/services/bankProviderService.ts`:
  - `listBankProviders()`
  - `getAuthUrl(accountId)`
  - `disconnectProvider(id)`
  - `startSync(id, fromDate?, toDate?)`
  - `getSyncJob(jobId)`
  - `importTransactions(jobId, transactionIds)`
  - `getBalance(id)`
  - `listExternalAccounts(id)`
  - `linkExternalAccount(id, externalAccountId)`

### Phase 10: Hooks

- [x] Create `frontend/src/hooks/api/useBankProviders.ts`:
  - React Query hooks for all bank provider API calls
  - Mutations with query invalidation
- [x] Create `frontend/src/hooks/usecase/useBankProviderConnection.ts`:
  - Connection lifecycle (connect, disconnect, link account, balance)
- [x] Create `frontend/src/hooks/usecase/useBankSync.ts`:
  - Sync lifecycle (start, poll, review, select, import)

### Phase 11: UI Components

- [x] Create `frontend/src/components/bank/BankConnectionConfig.tsx`:
  - Shows connection status (connected/disconnected)
  - Connect button → initiates OAuth flow (opens TrueLayer auth URL)
  - Disconnect button
  - Account linking and balance display
- [x] Create `frontend/src/components/bank/BankAccountSelector.tsx`:
  - After OAuth, shows list of external bank accounts from provider
  - User selects which one to link to the Master of Coin account
- [x] Create `frontend/src/components/bank/BankBalanceDisplay.tsx`:
  - Shows current and available balance
  - Currency display
- [x] Create `frontend/src/components/bank/BankSyncReview.tsx`:
  - Sync trigger button
  - Transaction list with checkboxes (inline, not separate component)
  - Summary badges (fetched, new, already imported)
  - Import selected button
  - Columns: date, description, amount, type, merchant, status (new/already imported)
  - Select all / deselect all
  - Already-imported items shown as disabled/greyed out

### Phase 12: Integration into Existing UI

- [x] Modify AccountDetail page to include:
  - BankConnectionConfig component (for checking/savings/credit card accounts)
  - BankSyncReview component (when bank is connected and linked)
- [x] TypeScript compiles cleanly (`npx tsc --noEmit` passes)
- [ ] Frontend testing checklist completed (see .agents/testing/testing-front-end.md)
