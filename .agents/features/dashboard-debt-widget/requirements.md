# Dashboard Debt Widget — Requirements

**GitHub Issue**: [#38 - Add Debt widget to Dashboard](https://github.com/abhijeet-reddy/master-of-coin/issues/38)
**Date**: 2026-03-15
**Status**: Complete

## Summary

Add a compact Debt widget to the Dashboard page that shows aggregate "You Owe" and "You Are Owed" totals. Clicking the widget navigates to the People page where full debt details are available. This gives users a quick debt overview without cluttering the dashboard.

## User Stories

1. As a user, I can see a Debt widget on my Dashboard showing the total amount I owe others and the total amount others owe me.
2. As a user, I can click the Debt widget to navigate to the People page for full debt details.

## Acceptance Criteria

- [ ] Dashboard displays a Debt widget with "You Are Owed" total and "You Owe" total
- [ ] Amounts are color-coded (green for owed to me, red for I owe)
- [ ] Clicking the widget navigates to the People page (`/people`)
- [ ] Widget handles empty state gracefully (no debts — shows €0.00)
- [ ] Debt data comes from the backend API (server-side aggregation)

## Scope

| Feature                              | In Scope | Future |
| ------------------------------------ | -------- | ------ |
| Aggregate "You Owe" total            | ✅       |        |
| Aggregate "You Are Owed" total       | ✅       |        |
| Click-through to People page         | ✅       |        |
| Backend debt totals in dashboard API | ✅       |        |
| Per-person breakdown on dashboard    |          | ✅     |
| Settle debt from dashboard           |          | ✅     |

## Out of Scope

- Per-person debt breakdown on the dashboard (available on People page)
- Settling debts from the dashboard widget
- Multi-currency debt aggregation

## Dependencies

- Existing `debt_service::get_all_debts_for_user()` backend function
- Existing dashboard API endpoint (`GET /api/v1/dashboard`)
- People page (`/people`) for debt details

## Open Questions

- None
