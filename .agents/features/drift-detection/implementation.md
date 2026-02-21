# Drift Detection — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#40](https://github.com/abhijeet-reddy/master-of-coin/issues/40)

---

## Phase 1: Database & Types

### 1.1 Migration

- [x] Create migration: `diesel migration generate create_background_jobs_table`
- [x] Write `up.sql`: CREATE TYPE `job_type_enum`, CREATE TYPE `job_status_enum`, CREATE TABLE `background_jobs` with all columns, indexes
- [x] Write `down.sql`: DROP TABLE, DROP TYPEs
- [x] Run migration: `diesel migration run`
- [x] Verify `schema.rs` auto-generated with `background_jobs` table and `sql_types::JobTypeEnum`, `sql_types::JobStatusEnum`

### 1.2 Custom Types

- [x] Create `backend/src/types/job_types.rs` with `JobType` and `JobStatus` enums using manual `ToSql`/`FromSql` (matching existing project pattern)
- [x] Add `pub mod job_types;` to `backend/src/types/mod.rs` and re-export `JobType`, `JobStatus`
- [x] Verify `diesel_derive_enum` is not needed — project uses manual `ToSql`/`FromSql` pattern

### 1.3 Models

- [x] Create `backend/src/models/background_job.rs` with `BackgroundJob` (Queryable) and `NewBackgroundJob` (Insertable) structs using typed `JobType`/`JobStatus` fields
- [x] Create `backend/src/models/drift_detection.rs` with all report types: `DriftDetectionRequest`, `StartJobResponse`, `DriftDetectionJobResponse`, `DriftReport`, `DriftSummary`, `DriftedItem`, `MissingOnExternal`, `MissingOnLocal`, `LocalSplitInfo`, `ExternalSplitInfo`, `UnmappedUser`
- [x] Add `pub mod background_job;` and `pub mod drift_detection;` to `backend/src/models/mod.rs` with exports
- [x] Verify: `cargo check` passes

---

## Phase 2: Repository

### 2.1 Background Job Repository

- [x] Create `backend/src/repositories/background_job.rs` with:
  - `create_job(pool, new_job)` -> `BackgroundJob`
  - `find_by_id(pool, job_id)` -> `Option<BackgroundJob>`
  - `find_by_user_and_type(pool, user_id, job_type)` -> `Vec<BackgroundJob>`
  - `find_stale_jobs(pool)` -> `Vec<BackgroundJob>` (WHERE status = RUNNING)
  - `find_next_pending(pool, exclude_types)` -> `Option<BackgroundJob>` (oldest PENDING, skip types in exclude list)
  - `update_running(pool, job_id)` -> `BackgroundJob`
  - `update_completed(pool, job_id, result_json)` -> `BackgroundJob`
  - `update_failed(pool, job_id, error)` -> `BackgroundJob`
  - `cleanup_old_jobs(pool, older_than)` -> `usize`
- [x] Add `pub mod background_job;` to `backend/src/repositories/mod.rs`
- [x] Verify: `cargo check` passes

---

## Phase 3: Drift Detection Service

### 3.1 Service Implementation

- [x] Create `backend/src/services/drift_detection_service.rs` with:
  - Public: `detect_drift(pool, providers, user_id, start_date, end_date)` -> `ApiResult<DriftReport>`
  - Internal: `fetch_local_split_transactions(pool, user_id, start_date, end_date)` — Diesel query joining transactions + transaction_splits + people + person_split_configs + split_sync_records
  - Internal: `fetch_all_external_expenses(pool, providers, user_id, start_date, end_date)` — for each active provider, call `get_expenses(None, ...)` with pagination and retry
  - Internal: `fetch_with_retry(provider, credentials, params, max_retries)` — exponential backoff (1s, 2s, 4s), only retry on `is_retryable()` errors
  - Internal: `build_external_user_mapping(pool, user_id)` — map external_user_id -> person_name from person_split_configs + people
  - Internal: `classify(local_txns, external_expenses, user_mapping)` — core matching logic producing DriftReport
- [x] Add `pub mod drift_detection_service;` to `backend/src/services/mod.rs`
- [x] Verify: `cargo check` passes

---

## Phase 4: API Handler & Routes

### 4.1 Handler

- [x] Create `backend/src/handlers/drift_detection.rs` with:
  - `start_drift_detection(State, Extension<AuthContext>, Json<DriftDetectionRequest>)` -> `(StatusCode::ACCEPTED, Json<StartJobResponse>)` — inserts PENDING job, returns 202
  - `get_drift_detection(State, Extension<AuthContext>, Path<Uuid>)` -> `Json<DriftDetectionJobResponse>` — reads job, validates ownership + type, deserializes result
  - `retry_drift_detection(State, Extension<AuthContext>, Path<Uuid>)` -> `(StatusCode::ACCEPTED, Json<StartJobResponse>)` — validates FAILED, creates new job with previous_job_id
- [x] Add `pub mod drift_detection;` to `backend/src/handlers/mod.rs`

### 4.2 Routes

- [x] Add three routes to `backend/src/api/routes.rs`:
  - `POST /drift-detection` -> `start_drift_detection` with `Transactions:Read` scope
  - `GET /drift-detection/:job_id` -> `get_drift_detection` with `Transactions:Read` scope
  - `POST /drift-detection/:job_id/retry` -> `retry_drift_detection` with `Transactions:Read` scope
- [x] Verify: `cargo check` passes

---

## Phase 5: Worker Binary

### 5.1 Worker Implementation

- [x] Create `backend/src/bin/worker.rs` with:
  - Config, DB pool, and provider initialization (reuse from `lib.rs`)
  - Startup recovery: query RUNNING jobs, mark as FAILED
  - Startup cleanup: delete terminal jobs older than 1 year
  - Poll loop: every 30 seconds, query for PENDING jobs (one per type concurrency), dispatch by job_type
  - Daily cleanup at 00:00 UTC: track last cleanup date, trigger when date changes
  - `DRIFT_DETECTION` dispatch: parse input, call `detect_drift()`, store result or error
- [x] Add `[[bin]]` entries to `backend/Cargo.toml` for both `master-of-coin` and `worker`
- [x] Verify: `cargo build --bin worker` succeeds

### 5.2 Docker Changes

- [x] Update `Dockerfile` to build both binaries: `cargo build --release --bin master-of-coin --bin worker`
- [x] Update `docker-compose.yml` to add `worker` service (same image, different command, no ports, `WORKER_POLL_INTERVAL_SECS=30`)
- [x] Verify: `docker compose build` succeeds

---

## Phase 6: Testing

### 6.1 Integration Tests

- [x] Create `backend/tests/integration/api/test_drift_detection.rs` with tests:
  - Start and poll job (POST 202, GET PENDING/COMPLETED)
  - Job not found (GET 404)
  - Job ownership (User A can't see User B's job)
  - Retry creates new job with `previous_job_id`
  - Retry non-FAILED returns 400
- [x] Add `mod test_drift_detection;` to test module registry
- [x] All existing tests still pass: `cargo test`

### 6.2 Background Job Repository Tests

- [x] Test CRUD operations: create, find_by_id, update_running, update_completed, update_failed
- [x] Test find_stale_jobs and find_next_pending
- [x] Test cleanup_old_jobs

### 6.3 Drift Detection Service Tests

- [x] Test classify() with constructed data (no external API calls):
  - All synced scenario
  - Drifted items scenario
  - Missing on external scenario
  - Missing on local scenario
  - Unmapped users scenario
  - Count invariants hold

---

## Phase 7: Final Verification

- [x] All tests passing: `cargo test` (384 tests, 0 failures)
- [x] Both binaries compile: `cargo build --bin master-of-coin-backend --bin worker`
- [x] Docker build succeeds with both binaries
- [x] Update requirements.md status to `In Progress`
- [x] Backend testing checklist completed (see `.agents/testing/testing-backend.md`)
- [x] Verify all changes comply with Rust Rules (clippy warnings fixed, cargo fmt clean, all rules verified)
