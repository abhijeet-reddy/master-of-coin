# SplitPro Integration — Implementation

**Design**: [design.md](./design.md)

---

## Backend Implementation

### Phase 1: SuperJSON Codec

#### 1.1 Create SuperJSON encoding/decoding module

- [x] Create `backend/src/services/split_provider/superjson.rs`
- [x] Implement `encode_mutation_body` function: takes a serde_json::Value and a list of BigInt field paths, produces SuperJSON-encoded body
  - Handles nested paths like `"participants.0.amount"`
- [x] Implement `decode_response` function: parses SuperJSON response back to plain serde_json::Value
  - Handles BigInt values in responses (stored as strings with metadata)
- [x] Implement `decode_error` function: parses tRPC error responses
- [x] Implement `encode_query_input` function: URL-encodes a SuperJSON input for GET requests
- [x] Implement `amount_to_bigint` and `bigint_to_amount` conversion functions
- [x] Implement `bigint_array_paths` helper for generating participant BigInt paths
- [x] Add unit tests for encoding/decoding round-trips (19 tests, all passing)

### Phase 2: SplitPro Provider Core

#### 2.1 Create SplitProProvider struct

- [x] Create `backend/src/services/split_provider/splitpro.rs`
- [x] Define `SplitProProvider` struct with `http_client: reqwest::Client`
- [x] Implement `SplitProProvider::new()` constructor
- [x] Implement credential extraction helpers:
  - `get_base_url(credentials: &Value) -> Result<String, SplitProviderError>`
  - `get_session_token(credentials: &Value) -> Result<String, SplitProviderError>`
  - `get_splitpro_user_id(credentials: &Value) -> Result<i64, SplitProviderError>`
- [x] Implement `build_trpc_url(base_url: &str, procedure: &str) -> String` helper
- [x] Implement `make_mutation_request` helper: POST to tRPC with SuperJSON body + session cookie
- [x] Implement `make_query_request` helper: GET from tRPC with SuperJSON query params + session cookie
- [x] Implement `map_trpc_error` and `map_http_error` helpers

### Phase 3: SplitProvider Trait Implementation

#### 3.1 Implement `create_expense`

- [x] Map `CreateExternalExpense` to SplitPro's `createExpenseSchema` format
- [x] Build SuperJSON-encoded request body with BigInt metadata paths
- [x] POST to `/api/trpc/expense.addOrEditExpense`
- [x] Parse SuperJSON response to extract expense ID
- [x] Return `ExternalExpenseResult` with expense ID and URL

#### 3.2 Implement `update_expense`

- [x] Map `UpdateExternalExpense` to SplitPro format, including `expenseId` field
- [x] Reuse the same `expense.addOrEditExpense` endpoint
- [x] Build SuperJSON-encoded request body
- [x] Parse response and return `ExternalExpenseResult`

#### 3.3 Implement `delete_expense`

- [x] Build SuperJSON-encoded request: `{"expenseId": "<uuid>"}`
- [x] POST to `/api/trpc/expense.deleteExpense`
- [x] Parse response for success/error

#### 3.4 Implement `get_expenses`

- [x] Map parameters to `expense.getExpensesWithFriend` input
- [x] Build SuperJSON query input and URL-encode for GET request
- [x] Parse SuperJSON response array
- [x] Convert each expense to `ExternalExpenseDetail`
- [x] Apply date filtering and limit client-side

#### 3.5 Implement `get_expense_by_id`

- [x] Build SuperJSON query input: `{"expenseId": "<uuid>"}`
- [x] GET from `/api/trpc/expense.getExpenseDetails`
- [x] Parse SuperJSON response
- [x] Handle deleted expenses

#### 3.6 Implement `validate_credentials`

- [x] GET from `/api/trpc/user.me`
- [x] Return `true` if response is successful, `false` if UNAUTHORIZED

#### 3.7 Implement `refresh_credentials`

- [x] Return `Ok(None)` — SplitPro sessions don't need refresh

### Phase 4: Provider Registration & Integration

#### 4.1 Register provider in SplitSyncService

- [x] Update `backend/src/services/split_sync_service.rs` `SplitSyncService::new()`:
  - Added `SplitProProvider` to the providers HashMap
- [x] Update `backend/src/services/split_provider/mod.rs`:
  - Added `pub mod splitpro;` and `pub mod superjson;`
  - Added `pub use splitpro::SplitProProvider;`

#### 4.2 Add SplitPro credentials model

- [x] Added `SplitProCredentials` struct to `backend/src/models/split_provider.rs`

#### 4.3 Add SplitPro connection handler

- [x] Created `backend/src/handlers/splitpro_integration.rs` with:
  - `connect_splitpro` handler (validates credentials, encrypts, stores)
  - `list_splitpro_friends` handler (fetches friends via tRPC)
- [x] Added `pub mod splitpro_integration;` to `backend/src/handlers/mod.rs`
- [x] Added routes to `backend/src/api/routes.rs`:
  - `POST /api/v1/integrations/splitpro/connect`
  - `GET /api/v1/integrations/splitpro/friends`

#### 4.4 Update friends endpoint for SplitPro

- [x] Updated `backend/src/handlers/split_providers.rs` `get_provider_friends`:
  - Added `"splitpro"` match arm calling `fetch_splitpro_friends`
  - Added `fetch_splitpro_friends` function

#### 4.5 Update external URL generation

- [ ] Update `backend/src/handlers/split_sync.rs`:
  - When generating external URLs, check provider type
  - For splitpro: generate URL as `{base_url}/expenses/{expense_id}` instead of Splitwise URL

### Phase 5: Backend Testing

- [x] SuperJSON codec unit tests (19 tests, all passing)
- [x] Backend compiles cleanly with `cargo check`
- [ ] Write integration test for the connect endpoint
- [ ] Verify all existing tests still pass

---

## Frontend Implementation

### Phase 6: SplitPro Connection UI

#### 6.1 Add SplitPro connection service

- [ ] Add `connectSplitPro` function to `frontend/src/services/integrationService.ts`
- [ ] Add `ConnectSplitProRequest` type to `frontend/src/types/splitIntegration.ts`

#### 6.2 Create SplitPro connection component

- [ ] Create `frontend/src/components/settings/SplitProConnection.tsx`

#### 6.3 Update Settings page

- [ ] Update `frontend/src/pages/Settings.tsx` to include SplitPro connection section

#### 6.4 Update SplitProviderConfig for SplitPro friends

- [ ] Update `frontend/src/hooks/usecase/useSplitProviderConfig.ts`

### Phase 7: Frontend Testing

- [ ] TypeScript compiles cleanly
- [ ] Test SplitPro connection flow in browser
- [ ] Test friend mapping with SplitPro users
- [ ] Test expense sync to SplitPro
- [ ] Verify existing Splitwise integration still works

---

## Setup & Documentation

### Phase 8: Session Setup Documentation

- [ ] Document the one-time session creation process
- [ ] Add setup instructions to project documentation
- [ ] Add SplitPro configuration to `.env.example` if needed
