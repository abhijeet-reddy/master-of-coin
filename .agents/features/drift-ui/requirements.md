# Drift UI — Requirements

**GitHub Issue**: [#41 - Scheduled split sync & sync management UI](https://github.com/abhijeet-reddy/master-of-coin/issues/41) (Sub-feature B)
**Date**: 2026-02-21
**Status**: In Progress

## Summary

Add a **Jobs page** and **job detail views** to the frontend, plus the ability to trigger drift detection from the Settings > Split tab. This provides a generic jobs dashboard where users can see all background jobs, and type-specific detail pages where they can review results and take actions.

The architecture is:

- **Jobs page** (`/jobs`) — generic list of all background jobs (drift detection, bulk sync, future types). Clicking a job navigates to its detail page.
- **Job detail page** (`/jobs/:id`) — type-specific view:
  - **Drift detection jobs** → shows the drift report with summary, drifted items, missing items. User can select items and create a sync job (push/pull).
  - **Bulk sync jobs** → shows per-item sync results (succeeded/failed).
- **Trigger drift detection** — from **Settings > Split tab**, user can enter a date range and start a drift detection job. This creates the job and navigates to the job detail page.

## User Stories

1. As a user, I can navigate to a "Jobs" page from the sidebar to see all my background jobs.
2. As a user, I can see a list of all past jobs with their type, status, timestamps, and summary counts.
3. As a user, I can click into any job to see its type-specific detail view.
4. As a user, I can trigger a drift detection from Settings > Split tab by entering a date range.
5. As a user, after triggering drift detection, I am navigated to the job detail page where I can watch it progress.
6. As a user, viewing a completed drift detection job, I can see the drift report with summary counts and detailed item lists.
7. As a user, I can select any mix of drift items across all categories and click "Sync Selected" to create a single bulk sync job — push items are automatically set to push, pull items to pull.
8. As a user, after creating a sync job from the drift view, I am navigated to the sync job detail page.
9. As a user, viewing a completed bulk sync job, I can see per-item results (succeeded/failed).
10. As a user, I can retry a failed drift detection job from its detail page.
11. As a user, I can retry failed items from a completed bulk sync job from its detail page.

## Acceptance Criteria

- [ ] New "Jobs" page accessible from the sidebar navigation at `/jobs`
- [ ] Jobs list shows all job types with type badges, status badges, timestamps, and summary
- [ ] Clicking a job row navigates to `/jobs/:id`
- [ ] Job detail page renders type-specific view based on job_type
- [ ] Drift detection detail: summary card + tabbed item lists (drifted, missing external, missing local)
- [ ] Drift detection detail: checkboxes on items + "Sync Selected" button (auto-determines push/pull per item)
- [ ] Sync creates a single bulk sync job with mixed push/pull items and navigates to its detail page
- [ ] Bulk sync detail: per-item results with success/failure status
- [ ] Settings > Split tab: date range form + "Run Comparison" button
- [ ] Running comparison creates drift detection job and navigates to `/jobs/:id`
- [ ] Retry button on failed drift detection jobs
- [ ] Retry button on bulk sync jobs with failed items
- [ ] Polling UI for active jobs (PENDING/RUNNING → auto-refresh until COMPLETED/FAILED)
- [ ] Backend: new GET /api/v1/jobs endpoint to list all background jobs
- [ ] Loading states, error states, and empty states
- [ ] Responsive layout using Chakra UI components

## Scope

| Feature                                       | In Scope | Future |
| --------------------------------------------- | -------- | ------ |
| Jobs page with sidebar navigation             | ✅       |        |
| Generic job list for all job types            | ✅       |        |
| Type-specific job detail views                | ✅       |        |
| Drift report display with summary and details | ✅       |        |
| Push/pull action buttons with batch select    | ✅       |        |
| Bulk sync report display                      | ✅       |        |
| Trigger drift detection from Settings > Split | ✅       |        |
| Retry failed jobs and failed sync items       | ✅       |        |
| Backend: generic list jobs endpoint           | ✅       |        |
| Scheduled/recurring sync                      |          | ✅     |
| Ignore/dismiss functionality                  |          | ✅     |

## Out of Scope

- **Scheduled sync**: No cron/schedule management (Sub-feature C)
- **Ignore/dismiss**: No mechanism to mark items as ignored
- **Auto-resolve**: No automatic resolution without user action

## Dependencies

- Existing drift detection API: POST /api/v1/drift-detection, GET /api/v1/drift-detection/:job_id, POST /api/v1/drift-detection/:job_id/retry
- Existing bulk sync API (Sub-feature A): POST /api/v1/sync, GET /api/v1/sync/:job_id, POST /api/v1/sync/:job_id/retry
- Existing background_jobs table with job_type and status columns
- Existing Settings page with Split tab

## Open Questions

- None — all backend APIs are in place. The only new backend work is a generic list jobs endpoint.
