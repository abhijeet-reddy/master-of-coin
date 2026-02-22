# Drift UI — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#41](https://github.com/abhijeet-reddy/master-of-coin/issues/41) (Sub-feature B)

---

## Phase 1: Backend — List Jobs Endpoint

### 1.1 Repository Method

- [x] Add `list_by_user(pool, user_id, job_type, limit, offset)` to `backend/src/repositories/background_job.rs`
- [x] Verify: `cargo check` passes

### 1.2 Models

- [x] Create `backend/src/models/job_summary.rs` with `BackgroundJobSummary` and `ListJobsQuery` types
- [x] Add `pub mod job_summary;` to `backend/src/models/mod.rs`
- [x] Verify: `cargo check` passes

### 1.3 Handler & Route

- [x] Create `backend/src/handlers/jobs.rs` with `list_jobs` handler
  - Parses query params (job_type, limit, offset)
  - Calls `list_by_user()` repository method
  - Extracts summary from each job's result JSONB (DriftSummary or BulkSyncSummary)
  - Returns `Vec<BackgroundJobSummary>`
- [x] Add `pub mod jobs;` to `backend/src/handlers/mod.rs`
- [x] Add `GET /jobs` route to `backend/src/api/routes.rs` with `Transactions:Read` scope
- [x] Verify: `cargo check` passes

### 1.4 Backend Tests

- [x] Add integration test for `GET /api/v1/jobs` in `backend/tests/integration/api/test_jobs.rs`
  - List jobs returns empty array for new user
  - List jobs returns drift detection and bulk sync jobs
  - Filter by job_type works
  - Pagination (limit/offset) works
  - Job ownership (User A can't see User B's jobs)
- [x] Add `mod test_jobs;` to `backend/tests/integration/api/mod.rs`
- [x] All existing tests still pass: `cargo test`

### 1.5 Backend Verification

- [x] `cargo fmt` clean
- [x] `cargo clippy` clean for new files
- [x] Both binaries compile

---

## Phase 2: Frontend — Types & Services

### 2.1 Types

- [x] Create `frontend/src/types/jobs.ts` with `JobType`, `JobStatus`, `BackgroundJobSummary`
- [x] Create `frontend/src/types/drift.ts` with all drift detection types (DriftDetectionRequest, DriftDetectionJobResponse, DriftReport, DriftSummary, DriftedItem, MissingOnExternal, MissingOnLocal, LocalSplitInfo, ExternalSplitInfo, UnmappedUser)
- [x] Create `frontend/src/types/sync.ts` with all bulk sync types (SyncAction, SyncItem, BulkSyncRequest, StartSyncJobResponse, BulkSyncJobResponse, BulkSyncReport, BulkSyncSummary, SyncItemResult)
- [x] Export all new types from `frontend/src/types/index.ts`

### 2.2 Services

- [x] Create `frontend/src/services/jobService.ts` with `listJobs(params?)`
- [x] Create `frontend/src/services/driftService.ts` with `startDriftDetection()`, `getDriftJob()`, `retryDriftJob()`
- [x] Create `frontend/src/services/bulkSyncService.ts` with `startBulkSync()`, `getBulkSyncJob()`, `retryBulkSync()`

### 2.3 Hooks

- [x] Create `frontend/src/hooks/api/useJobs.ts` with `useJobs(params?)`
- [x] Create `frontend/src/hooks/api/useDriftDetection.ts` with `useStartDriftDetection()`, `useDriftJob(jobId)` (with polling), `useRetryDriftJob()`
- [x] Create `frontend/src/hooks/api/useBulkSync.ts` with `useStartBulkSync()`, `useBulkSyncJob(jobId)` (with polling), `useRetryBulkSync()`
- [x] Create `frontend/src/hooks/usecase/useSyncWizard.ts` — manages wizard state, selections, step navigation, builds SyncItem array
- [x] Update hook index files as needed

---

## Phase 3: Frontend — Jobs Page

### 3.1 Shared Components

- [x] Create `frontend/src/components/jobs/JobStatusBadge.tsx` — colored badge for PENDING/RUNNING/COMPLETED/FAILED
- [x] Create `frontend/src/components/jobs/JobTypeBadge.tsx` — badge for DRIFT_DETECTION/BULK_SYNC
- [x] Create `frontend/src/components/jobs/JobProgressCard.tsx` — PENDING/RUNNING status with spinner
- [x] Create `frontend/src/components/jobs/JobHistoryList.tsx` — table of jobs with badges, timestamps, summary
- [x] Create `frontend/src/components/jobs/index.ts` — barrel exports

### 3.2 Jobs Page

- [x] Create `frontend/src/pages/Jobs.tsx` — Jobs list page with filter dropdown and JobHistoryList
- [x] Add route `<Route path="jobs" element={<JobsPage />} />` to `frontend/src/App.tsx`
- [x] Add sidebar nav item (MdWorkHistory icon, "Jobs", /jobs) to `frontend/src/components/layout/Sidebar.tsx`

### 3.3 Visual Test

- [x] Docker build and test Jobs page in browser
- [x] Verify jobs list renders with correct badges and timestamps
- [x] Verify filter dropdown works
- [x] Verify clicking a job row navigates to `/jobs/:type/:id`

---

## Phase 4: Frontend — Drift Details Page

### 4.1 Drift Report Components

- [x] Create `frontend/src/components/drift/DriftSummaryCard.tsx` — grid of summary counts
- [x] Create `frontend/src/components/drift/DriftItemRow.tsx` — single item row with local vs external comparison
- [x] Create `frontend/src/components/drift/DriftItemList.tsx` — list of items for each tab
- [x] Create `frontend/src/components/drift/DriftReportView.tsx` — full report: summary + tabs + Sync button
- [x] Create `frontend/src/components/drift/index.ts` — barrel exports

### 4.2 Job Detail Page

- [x] Create `frontend/src/pages/JobDetail.tsx` — wrapper that reads `:type` and `:id`, fetches from right endpoint, renders DriftReportView or BulkSyncReportView
- [x] Add route `<Route path="jobs/:type/:id" element={<JobDetailPage />} />` to `frontend/src/App.tsx`

### 4.3 Visual Test

- [x] Docker build and test Drift Details page in browser
- [x] Trigger a drift detection from API (or Settings), navigate to job detail
- [x] Verify summary card, tabs, and item lists render correctly
- [x] Verify polling works (PENDING → RUNNING → COMPLETED)
- [x] Verify back to jobs link works

---

## Phase 5: Frontend — Sync Wizard

### 5.1 Wizard Components

- [x] Create `frontend/src/components/sync/wizard/DriftedStepView.tsx` — Step 1: drifted items with checkboxes + push/pull toggle
- [x] Create `frontend/src/components/sync/wizard/MissingExternalStepView.tsx` — Step 2: missing on external with checkboxes (always push)
- [x] Create `frontend/src/components/sync/wizard/MissingLocalStepView.tsx` — Step 3: missing on local with checkboxes (always pull)
- [x] Create `frontend/src/components/sync/wizard/ReviewStepView.tsx` — Step 4: summary of selections + Sync All button
- [x] Create `frontend/src/components/sync/wizard/SyncWizard.tsx` — modal container with step navigation (back, next, skip, submit)
- [x] Create `frontend/src/components/sync/wizard/index.ts` — barrel exports

### 5.2 Integration

- [x] Wire Sync button in DriftReportView to open SyncWizard modal
- [x] Wire SyncWizard submit to call `startBulkSync()` and navigate to `/jobs/sync/:job_id`

### 5.3 Visual Test

- [x] Docker build and test Sync Wizard in browser
- [x] Test full flow: Drift Details → Sync button → Step 1-4 → Submit → Navigate to sync job detail
- [x] Verify step navigation (back, next, skip)
- [x] Verify selections persist across steps
- [x] Verify review step shows correct summary

---

## Phase 6: Frontend — Bulk Sync Report & Retry

### 6.1 Sync Report Components

- [x] Create `frontend/src/components/sync/BulkSyncReportView.tsx` — sync results: summary + per-item list + retry button
- [x] Create `frontend/src/components/sync/SyncItemResultRow.tsx` — single result row with success/failure badge
- [x] Create `frontend/src/components/sync/index.ts` — barrel exports

### 6.2 Integration

- [x] Wire BulkSyncReportView into JobDetail page for type=sync
- [x] Wire retry button to call `retryBulkSync()` and navigate to new job
- [x] Wire retry button on drift detection FAILED jobs to call `retryDriftJob()` and navigate to new job

### 6.3 Visual Test

- [x] Docker build and test Bulk Sync report in browser
- [x] Verify per-item results display correctly
- [x] Verify retry button works for both job types

---

## Phase 7: Frontend — Settings Enhancement

### 7.1 Drift Detection Modal

- [x] Create `frontend/src/components/settings/DriftDetectionModal.tsx` — modal with date range pickers + Run Drift Detection Job button
- [x] Add "Run Drift Detection Job" button to `frontend/src/components/settings/SplitIntegrationsList.tsx`
- [x] Wire button to open modal, modal submit to call `startDriftDetection()` and navigate to `/jobs/drift-detection/:job_id`

### 7.2 Visual Test

- [x] Docker build and test Settings > Split tab in browser
- [x] Verify button appears
- [x] Verify modal opens with date pickers
- [x] Verify submit creates job and navigates to detail page

---

## Phase 8: Final Verification

- [x] Full E2E test: Settings > Run Drift Detection Job → Job Detail → Sync wizard → Sync job results → Retry
- [x] Jobs page shows all jobs correctly
- [x] All error states and empty states work
- [x] Responsive layout works
- [x] Frontend testing checklist completed (see `.agents/testing/testing-front-end.md`)
- [x] All backend tests pass: `cargo test` (398 passed, 0 failed)
- [x] Docker build succeeds
- [x] Update requirements.md status to `In Progress`
