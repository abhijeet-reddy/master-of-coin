# Sync API — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#41](https://github.com/abhijeet-reddy/master-of-coin/issues/41) (Sub-feature A)

---

## Phase 1: Database & Types

### 1.1 Migration

- [x] Create migration: `diesel migration generate add_bulk_sync_job_type`
- [x] Write `up.sql`: `ALTER TYPE job_type ADD VALUE 'BULK_SYNC';`
- [x] Write `down.sql`: Delete BULK_SYNC jobs, recreate enum without BULK_SYNC (see design.md §3.1)
- [x] Run migration: `diesel migration run`
- [x] Verify `schema.rs` is unchanged (no new tables, just enum value added)

### 1.2 JobType Enum Extension

- [x] Add `BulkSync` variant to `JobType` enum in `backend/src/types/job_types.rs`
- [x] Update `ToSql` impl: add `JobType::BulkSync => out.write_all(b"BULK_SYNC")?`
- [x] Update `FromSql` impl: add `b"BULK_SYNC" => Ok(JobType::BulkSync)`
- [x] Verify: `cargo check` passes

---

## Phase 2: Models

### 2.1 Bulk Sync Types

- [x] Create `backend/src/models/bulk_sync.rs` with all types:
  - `BulkSyncRequest` (with `Validate` derive, items Vec)
  - `SyncItem` (action, optional transaction_id, optional external_expense_id)
  - `SyncAction` enum (Push, Pull) with `#[serde(rename_all = "lowercase")]`
  - `StartSyncJobResponse` (job_id, status, message, total_items)
  - `BulkSyncJobResponse` (job_id, status, timestamps, optional result, optional error)
  - `BulkSyncReport` (summary, items Vec)
  - `BulkSyncSummary` (total, succeeded, failed)
  - `SyncItemResult` (action, optional identifiers, status string, optional detail, optional error)
- [x] Add `pub mod bulk_sync;` to `backend/src/models/mod.rs` with appropriate exports
- [x] Verify: `cargo check` passes

---

## Phase 3: Service

### 3.1 Bulk Sync Service

- [x] Create `backend/src/services/bulk_sync_service.rs` with:
  - Public: `execute_bulk_sync(sync_service, user_id, items)` -> `BulkSyncReport`
  - Internal: `execute_push(sync_service, transaction_id)` -> `Result<SyncItemResult, String>`
    - Calls `sync_service.sync_transaction(transaction_id)`
    - If result is "mismatch", extracts external_expense_id and calls `sync_service.resolve_mismatch(transaction_id, &ext_id, "push")`
    - Returns success result with sync details
  - Internal: `execute_pull(sync_service, user_id, external_expense_id)` -> `Result<SyncItemResult, String>`
    - Checks `split_sync_records` for existing link
    - If linked: calls `sync_service.resolve_mismatch(transaction_id, &ext_id, "pull")`
    - If not linked: fetches expense from provider, calls `sync_service.sync_external_expense(user_id, &expense, provider_id)`
    - Returns success result with import/update details
  - Error isolation: each item wrapped in catch, failures recorded but don't stop processing
- [x] Add `pub mod bulk_sync_service;` to `backend/src/services/mod.rs`
- [x] Verify: `cargo check` passes

---

## Phase 4: Handler & Routes

### 4.1 Handler

- [x] Create `backend/src/handlers/bulk_sync.rs` with three handlers:
  - `start_bulk_sync(State, Extension<AuthContext>, Json<BulkSyncRequest>)` -> `(StatusCode::ACCEPTED, Json<StartSyncJobResponse>)`
    - Validates items not empty, each item has correct fields for its action
    - Creates background_jobs row: job_type=BulkSync, status=Pending, input=serialized items
    - Returns 202 with job_id and total_items
  - `get_bulk_sync(State, Extension<AuthContext>, Path<Uuid>)` -> `Json<BulkSyncJobResponse>`
    - Reads job, validates job_type=BulkSync and user ownership
    - Deserializes result JSONB into BulkSyncReport if COMPLETED
    - Returns current status + result/error
  - `retry_bulk_sync(State, Extension<AuthContext>, Path<Uuid>)` -> `(StatusCode::ACCEPTED, Json<StartSyncJobResponse>)`
    - Validates original job is COMPLETED, belongs to user, is BULK_SYNC type
    - Reads result, extracts failed items, reconstructs SyncItem objects
    - Returns 400 if no failed items or job not COMPLETED
    - Creates new job with failed items only and previous_job_id = original
    - Returns 202 with new job_id
- [x] Add `pub mod bulk_sync;` to `backend/src/handlers/mod.rs`

### 4.2 Routes

- [x] Add three routes to `backend/src/api/routes.rs`:
  - `POST /sync` -> `start_bulk_sync` with `Transactions:Write` scope
  - `GET /sync/:job_id` -> `get_bulk_sync` with `Transactions:Read` scope
  - `POST /sync/:job_id/retry` -> `retry_bulk_sync` with `Transactions:Write` scope
- [x] Verify: `cargo check` passes

---

## Phase 5: Worker

### 5.1 Worker Changes

- [x] Add `SplitSyncService` initialization in `main()` of `backend/src/bin/worker.rs`:
  - `let sync_service = SplitSyncService::new(pool.clone());`
  - Pass `sync_service` to `run_poll_loop()` and `execute_job()`
- [x] Add `JobType::BulkSync` arm to the match in `execute_job()`:
  - Dispatches to new `execute_bulk_sync_job()` function
- [x] Create `execute_bulk_sync_job()` function:
  - Parses input as `BulkSyncRequest`
  - Calls `bulk_sync_service::execute_bulk_sync(&sync_service, user_id, request.items)`
  - Serializes `BulkSyncReport` to JSON and returns it
- [x] Verify: `cargo build --bin worker` succeeds

---

## Phase 6: Testing

### 6.1 Integration Tests

- [x] Create `backend/tests/integration/api/test_bulk_sync.rs` with tests:
  - Start and poll job (POST 202, GET PENDING/COMPLETED)
  - Job not found (GET 404)
  - Job ownership (User A can't see User B's job)
  - Empty items returns 400
  - Push without transaction_id returns 400
  - Pull without external_expense_id returns 400
  - Retry creates new job with failed items only and previous_job_id set
  - Retry with no failed items returns 400
  - Retry non-COMPLETED job returns 400
- [x] Add `mod test_bulk_sync;` to test module registry (`backend/tests/integration/api/mod.rs`)
- [x] All existing tests still pass: `cargo test`

---

## Phase 7: Final Verification

- [x] All tests passing: `cargo test`
- [x] Both binaries compile: `cargo build --bin master-of-coin-backend --bin worker`
- [x] Docker build succeeds with both binaries
- [x] Update requirements.md status to `In Progress`
- [x] Backend testing checklist completed (see `.agents/testing/testing-backend.md`)
- [x] Verify all changes comply with Rust Rules (clippy warnings fixed, cargo fmt clean)
