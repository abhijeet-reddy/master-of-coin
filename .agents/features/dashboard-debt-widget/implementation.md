# Dashboard Debt Widget — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#38 - Add Debt widget to Dashboard](https://github.com/abhijeet-reddy/master-of-coin/issues/38)

---

## Backend Implementation

### Phase 1: API Response Changes

#### 1.1 Add DebtOverview struct to analytics_service

- [x] Add `DebtOverview` struct with `total_owed_to_me: String` and `total_i_owe: String` to `backend/src/services/analytics_service.rs`
- [x] Add `debt_overview: DebtOverview` field to `DashboardSummary` struct
- [x] Add helper function `get_debt_overview()` that calls `debt_service::get_all_debts_for_user()` and aggregates into totals
- [x] Add `get_debt_overview()` to the `tokio::join!` in `get_dashboard_summary()` — errors propagated with `?` like other queries

### Phase 2: Backend Testing

- [x] Update `backend/tests/integration/api/test_dashboard.rs` to verify `debt_overview` field is present in dashboard response
- [x] Verify `debt_overview` has correct values when debts exist
- [x] All existing tests still pass (11/11)

---

## Frontend Implementation

### Phase 3: Types

- [x] Add `DebtOverview` interface to `frontend/src/types/models.ts` with `total_owed_to_me: string` and `total_i_owe: string`
- [x] Add `debt_overview: DebtOverview` field to `DashboardSummary` interface

### Phase 4: DebtWidget Component

- [x] Create `frontend/src/components/dashboard/DebtWidget.tsx`
  - Card with two stat columns: "You Are Owed" (green) and "You Owe" (red)
  - Entire card clickable, navigates to `/people` using `useNavigate()`
  - Cursor pointer and hover effect
  - Handles missing/zero data gracefully
- [x] Export `DebtWidget` from `frontend/src/components/dashboard/index.ts`

### Phase 5: Dashboard Integration

- [x] Import and add `DebtWidget` to `frontend/src/pages/Dashboard.tsx` below Category Breakdown and Recent Transactions grid
- [x] Pass `data.debt_overview` to the widget

### Phase 6: E2E Tests

- [x] Add debt widget test to `e2e/tests/dashboard/dashboard.spec.ts`:
  - Verify "You Are Owed" text is visible on dashboard
  - Verify "You Owe" text is visible on dashboard
  - Verify clicking the debt widget navigates to `/people`
- [x] Take screenshot of dashboard with debt widget for visual verification
- [x] All existing dashboard E2E tests still pass (6/6)
- [x] All smoke tests pass (21/21)

### Phase 7: Verification

- [x] TypeScript compiles cleanly
- [x] ESLint passes with no errors
- [x] Frontend testing checklist completed:
  - [x] Docker containers rebuilt with latest changes
  - [x] Application starts without errors
  - [x] Smoke tests pass (21/21)
  - [x] Dashboard feature tests pass (6/6)
  - [x] Screenshots captured and visually verified
  - [x] No console errors in test output
  - [x] New tests written for debt widget
