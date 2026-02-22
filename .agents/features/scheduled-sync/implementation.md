# Scheduled Sync — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#41](https://github.com/abhijeet-reddy/master-of-coin/issues/41) (Sub-feature C)

---

## Phase 1: Database & Cron Utilities

### 1.1 Migration

- [x] Create migration: `diesel migration generate create_schedules_table`
- [x] Write `up.sql`: CREATE TABLE `schedules` with all columns and indexes
- [x] Write `down.sql`: DROP TABLE
- [x] Run migration: `diesel migration run`
- [x] Verify `schema.rs` auto-generated with `schedules` table

### 1.2 Cron Utilities

- [x] Add `cron` crate to `backend/Cargo.toml`
- [x] Create `backend/src/utils/cron.rs` with:
  - `compute_next_run(cron_expr)` → next occurrence after now
  - `compute_next_run_after(cron_expr, after)` → next occurrence after given timestamp
  - `compute_upcoming_runs(cron_expr, count)` → next N occurrences
  - `describe_cron(cron_expr)` → human-readable description
  - `validate_cron(cron_expr)` → validates expression
  - `validate_min_frequency(cron_expr)` → ensures >= 1 hour between runs
- [x] Register module in `backend/src/utils/mod.rs`
- [x] Verify: `cargo check` passes

---

## Phase 2: Models & Repository

### 2.1 Models

- [x] Create `backend/src/models/schedule.rs` with:
  - `Schedule` — Queryable struct
  - `NewSchedule` — Insertable struct
  - `UpdateSchedule` — Changeset for partial updates
  - `ScheduleResponse` — API response with `cron_description`
  - `ScheduleDetailResponse` — Schedule + recent_jobs + upcoming_runs
  - `CreateScheduleRequest` — Request body with validation
  - `UpdateScheduleRequest` — Partial update request
- [x] Register module in `backend/src/models/mod.rs`
- [x] Verify: `cargo check` passes

### 2.2 Repository

- [x] Create `backend/src/repositories/schedule.rs` with:
  - `create(pool, new_schedule)` → `Schedule`
  - `list_by_user(pool, user_id)` → `Vec<Schedule>`
  - `find_by_id(pool, schedule_id)` → `Option<Schedule>`
  - `update(pool, schedule_id, changeset)` → `Schedule`
  - `delete(pool, schedule_id)` → `usize`
  - `find_due_schedules(pool)` → `Vec<Schedule>`
  - `trigger_schedule(pool, schedule_id, new_job, next_run_at)` → `BackgroundJob` (transactional)
- [x] Register module in `backend/src/repositories/mod.rs`
- [x] Verify: `cargo check` passes

---

## Phase 3: Handler & Routes

### 3.1 Handler

- [x] Create `backend/src/handlers/schedules.rs` with:
  - `create_schedule` — POST, validates cron + min frequency, computes initial next_run_at
  - `list_schedules` — GET list
  - `get_schedule` — GET detail with recent jobs and upcoming runs
  - `update_schedule` — PUT, recomputes next_run_at if cron changes
  - `delete_schedule` — DELETE
- [x] Register module in `backend/src/handlers/mod.rs`

### 3.2 Routes

- [x] Add 5 routes to `backend/src/api/routes.rs`:
  - `POST /schedules` with `Transactions:Write` scope
  - `GET /schedules` with `Transactions:Read` scope
  - `GET /schedules/:id` with `Transactions:Read` scope
  - `PUT /schedules/:id` with `Transactions:Write` scope
  - `DELETE /schedules/:id` with `Transactions:Write` scope
- [x] Verify: `cargo check` passes

---

## Phase 4: Worker Enhancement

### 4.1 Schedule Checking

- [x] Add `check_and_trigger_schedules(pool)` function to `backend/src/bin/worker.rs`:
  - Queries due schedules via `find_due_schedules()`
  - For each: builds job input from parameters, calls `trigger_schedule()` (transactional)
  - Runs as `tokio::spawn` task in the poll loop (parallel with job execution)
- [x] Add schedule checking call in the poll loop
- [x] Verify: `cargo build --bin worker` succeeds

---

## Phase 5: Backend Testing

### 5.1 Cron Utility Tests

- [x] Unit tests for `compute_next_run`, `compute_upcoming_runs`, `describe_cron`, `validate_cron`, `validate_min_frequency`

### 5.2 Integration Tests

- [x] Create `backend/tests/integration/api/test_schedules.rs` with:
  - Schedule CRUD: create, list, get detail, update, delete
  - Schedule ownership: User A can't see User B's schedules
  - Cron validation: invalid expressions rejected
  - Min frequency validation: sub-hourly rejected
  - Active/inactive toggle via update
  - Schedule detail includes recent jobs and upcoming runs
- [x] Register test module
- [x] All tests pass: `cargo test`

### 5.3 Backend Verification

- [x] `cargo fmt` clean
- [x] `cargo clippy` clean
- [x] Both binaries compile
- [x] Docker build succeeds

---

## Phase 6: Frontend — Types, Services, Hooks

### 6.1 Types

- [x] Create `frontend/src/types/schedule.ts` with Schedule, CreateScheduleRequest, UpdateScheduleRequest, ScheduleDetailResponse, CronPreset types
- [x] Export from `frontend/src/types/index.ts`

### 6.2 Services

- [x] Create `frontend/src/services/scheduleService.ts` with createSchedule, listSchedules, getSchedule, updateSchedule, deleteSchedule

### 6.3 Hooks

- [x] Create `frontend/src/hooks/api/useSchedules.ts` with useSchedules, useSchedule, useCreateSchedule, useUpdateSchedule, useDeleteSchedule
- [x] Update hook index files

---

## Phase 7: Frontend — Schedules Pages

### 7.1 Schedules List Page

- [x] Create `frontend/src/pages/Schedules.tsx` — list with job type badge, cron description, next run, last run, active/inactive toggle, delete
- [x] Create `frontend/src/components/schedules/ScheduleCard.tsx` — schedule summary card
- [x] Add route `<Route path="schedules" element={<SchedulesPage />} />`
- [x] Add sidebar nav item (MdSchedule icon, "Schedules")

### 7.2 Schedule Detail Page

- [x] Create `frontend/src/pages/ScheduleDetail.tsx` — full config, previous job runs, upcoming execution times
- [x] Add route `<Route path="schedules/:id" element={<ScheduleDetailPage />} />`

### 7.3 Create Schedule Modal

- [x] Create `frontend/src/components/schedules/CreateScheduleModal.tsx` with:
  - Job type selector
  - Type-specific parameter fields (lookback_days for drift detection)
  - Simple mode: CronPresetSelector
  - Advanced mode: custom cron text input
- [x] Create `frontend/src/components/schedules/CronPresetSelector.tsx` — Hourly, Daily, Weekly, Monthly presets
- [x] Create `frontend/src/components/schedules/index.ts` — barrel exports

---

## Phase 8: Frontend — Jobs Page Enhancement

### 8.1 Schedule Badge

- [x] Add schedule badge to `JobHistoryList` for schedule-triggered jobs (best-effort via summary field)
- [x] Badge links to schedule detail page when schedule_id is available
- [x] Note: Full support requires backend to expose `schedule_id` in job summary or add `input` to BackgroundJobSummary

---

## Phase 9: Final Verification

- [x] Full E2E test: Create schedule → wait for trigger → verify job created → view in Jobs page
- [x] All backend tests pass: `cargo test`
- [x] TypeScript compiles: `tsc --noEmit`
- [x] Docker build succeeds
- [x] Frontend testing checklist completed
- [x] Update requirements.md status to "In Progress"
- [x] Commit with proper message
