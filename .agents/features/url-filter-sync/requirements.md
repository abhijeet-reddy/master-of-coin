# URL Filter Sync for Transactions Page — Requirements

**Date**: 2026-04-11
**Status**: In Progress

## Summary

Currently, the Transactions page stores all filter state (selected month, account filters, category filters, transaction type, date range, amount range, paid-by-others) in React `useState` hooks. This means filters are lost on page refresh and cannot be shared via URL. This feature syncs all filter state to URL search parameters so that users can bookmark, share, and revisit filtered transaction views.

## User Stories

1. As a user, when I apply filters on the Transactions page, the URL updates to reflect my current filter selections.
2. As a user, when I copy the URL and paste it into a new browser tab, the Transactions page loads with the exact same filters applied.
3. As a user, when I navigate to a different month using the MonthNavigator, the URL updates to include the selected month.
4. As a user, when I clear all filters, the URL search parameters are removed.
5. As a user, when I use the browser back/forward buttons, the filter state updates accordingly.
6. As a user, when I visit `/transactions` with no search params, I see the default view (current month, no filters).

## Acceptance Criteria

- [ ] Selected month (year + month) is reflected in the URL as `?month=2026-04`
- [ ] Account filter IDs are reflected as `?accounts=id1,id2`
- [ ] Category filter IDs are reflected as `?categories=id1,id2`
- [ ] Transaction type filter is reflected as `?type=income` or `?type=expense` (omitted when "all")
- [ ] Date range filters are reflected as `?startDate=2026-01-01&endDate=2026-01-31`
- [ ] Amount range filters are reflected as `?minAmount=10&maxAmount=500`
- [ ] Paid-by-others filter is reflected as `?paidByOthers=only` or `?paidByOthers=exclude` (omitted when "all")
- [ ] Filter panel auto-opens when URL contains any filter params (beyond just month)
- [ ] Visiting a URL with filter params restores the exact filter state
- [ ] Clearing filters removes all search params (or resets to just the current month)
- [ ] Browser back/forward navigation updates filter state correctly
- [ ] Default behavior (no search params) shows current month with no filters applied

## Scope

| Feature                              | In Scope | Future |
| ------------------------------------ | -------- | ------ |
| Sync filters to URL search params    | ✅       |        |
| Sync selected month to URL           | ✅       |        |
| Restore filters from URL on load     | ✅       |        |
| Browser back/forward support         | ✅       |        |
| Auto-open filter panel when filtered | ✅       |        |
| Apply to other detail pages          |          | ✅     |
| URL shortening / encoding            |          | ✅     |

## Out of Scope

- Syncing filters on AccountDetail, CategoryDetail, PersonDetail, or BudgetDetail pages (these can be done as a follow-up)
- Server-side filtering via URL params (filtering is currently client-side)
- Persisting filters to localStorage as a fallback

## Dependencies

- `react-router-dom` v7 (already installed) — provides `useSearchParams` hook

## Open Questions

- None — all information gathered from codebase analysis.
