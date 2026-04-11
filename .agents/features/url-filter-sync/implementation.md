# URL Filter Sync for Transactions Page — Implementation

**Design**: [design.md](./design.md)

---

## Frontend Implementation

### Phase 1: URL Filter Utility Functions

- [x] Create `frontend/src/utils/urlFilterParams.ts` with pure serialization/deserialization functions:
  - [x] `filtersToSearchParams(filters, selectedMonth)` — converts `TransactionFilterValues` + `Date` to `URLSearchParams`
  - [x] `searchParamsToFilters(params)` — parses `URLSearchParams` into `TransactionFilterValues`
  - [x] `searchParamsToMonth(params)` — parses `month` param into `Date`, defaults to current month
  - [x] `isCurrentMonth(date)` — returns `true` if the date is in the current calendar month
  - [x] `hasActiveFilterParams(params)` — returns `true` if any non-month filter param is present

### Phase 2: Custom Hook

- [x] Create `frontend/src/hooks/ui/useTransactionUrlFilters.ts`:
  - [x] Import `useSearchParams` from `react-router-dom`
  - [x] Import utility functions from `urlFilterParams.ts`
  - [x] Derive `selectedMonth` from URL params using `useMemo`
  - [x] Derive `filters` (TransactionFilterValues) from URL params using `useMemo`
  - [x] Derive `hasUrlFilters` from `hasActiveFilterParams`
  - [x] Implement `setSelectedMonth(date)` — updates `month` param, preserves other params
  - [x] Implement `setFilters(filters)` — serializes filters to URL params with `replace: true`
  - [x] Implement `clearFilters()` — removes all filter params, keeps `month` if non-default
  - [x] Export the hook
- [x] Register the hook in `frontend/src/hooks/ui/index.ts`
- [x] Hook auto-exported via `frontend/src/hooks/index.ts` (uses `export * from './ui'`)

### Phase 3: Integrate into TransactionsPage

- [x] Modify `frontend/src/pages/Transactions.tsx`:
  - [x] Remove `useState` for `selectedMonth`
  - [x] Remove `useState` for `filters`
  - [x] Import and use `useTransactionUrlFilters` hook
  - [x] Replace `handleClearFilters` to call `clearFilters()` from the hook
  - [x] Local `showFilters` toggle state defaults to `hasUrlFilters` (auto-opens when URL has filters)
  - [x] Filter toggle button still works for manual show/hide
  - [x] Removed unused `type TransactionFilterValues` import
- [x] TypeScript compiles cleanly: `cd frontend && npx tsc --noEmit`

### Phase 4: Testing & Verification

- [ ] Manual testing: apply filters and verify URL updates
- [ ] Manual testing: copy URL, open in new tab, verify filters restore
- [ ] Manual testing: use browser back/forward, verify state updates
- [ ] Manual testing: visit `/transactions` with no params, verify default view
- [ ] Manual testing: visit `/transactions?type=expense&month=2026-03`, verify correct state
- [ ] Frontend testing checklist completed (see .agents/testing/testing-front-end.md)
