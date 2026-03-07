# Fix Budget Date Filtering — Requirements

**GitHub Issue**: [#48 - Budget page shows transactions from previous month](https://github.com/abhijred/master-of-coin/issues/48)
**Date**: 2026-03-06
**Status**: Draft

## Summary

The Monthly Groceries Budget detail page currently displays transactions from previous months under the current month's view. This happens because the backend `GET /budgets/:id` endpoint does not return the budget's `active_range`, `current_spending`, or `percentage` fields, and the frontend `useBudgetDetail` hook only filters transactions by `category_id` — completely ignoring the budget's date range. As a result, all historical transactions for the category are shown instead of only those within the current budget period.

This is a two-part bug fix: the backend must populate the missing fields on the budget response, and the frontend must use the returned date range to scope its transaction query.

## User Stories

1. As a user, when I view a budget detail page, I see only transactions that fall within the current budget period (e.g., this month for a monthly budget).
2. As a user, when I view a budget with no transactions in the current period, I see zero spend and an empty transaction list — not transactions from previous months.
3. As a user, I can see the current spending amount and percentage used on the budget detail page, reflecting only the active period's transactions.

## Acceptance Criteria

- [ ] `GET /budgets/:id` returns `active_range` with `start_date` and `end_date` for the current period
- [ ] `GET /budgets/:id` returns `current_spending` as a string (BigDecimal formatted)
- [ ] `GET /budgets/:id` returns `percentage` as a float (0.0–100.0+)
- [ ] Budget detail page only shows transactions within the active budget range dates
- [ ] A budget with no transactions in the current period shows `$0.00` spending and 0% used
- [ ] Existing budget list and dashboard functionality remains unaffected

## Scope

| Feature                                        | In Scope | Future |
| ---------------------------------------------- | -------- | ------ |
| Backend: Add active_range to BudgetResponse    | ✅       |        |
| Backend: Calculate current_spending/percentage | ✅       |        |
| Frontend: Pass date range to transaction query | ✅       |        |
| Frontend: Display spending/percentage in UI    |          | ✅     |
| Budget range editing or multi-range support    |          | ✅     |

## Out of Scope

- Changing the budget list page or dashboard budget status cards (they already use `calculate_budget_status()`)
- Adding new UI components to display spending/percentage (the frontend `Budget` type already defines these optional fields)
- Modifying the budget creation or editing workflow

## Dependencies

- Backend `get_active_range()` repository function (already exists and works correctly)
- Backend `calculate_budget_status()` service function (contains the correct date-filtering logic to reuse)
- Frontend `QueryParams` type already supports `start_date` and `end_date` fields
- Backend `TransactionFilter` already supports `start_date` and `end_date` fields

## Open Questions

- None — the investigation has confirmed both bugs and the fix approach is clear.
