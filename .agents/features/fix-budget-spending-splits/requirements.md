# Fix Budget Spending Split Calculation — Requirements

**Date**: 2026-03-07
**Status**: Complete

## Summary

Budget spending calculations currently use the full transaction amount without accounting for transaction splits. When a user splits a transaction with friends, only the user's share should count toward budget spending. For example, if a user creates a €10 grocery expense and splits it equally with a friend (€5 each), the budget should show €5 spent, not €10.

Additionally, the fix must correctly handle **debt transactions** ("paid by others"). Debt transactions live on DEBT pseudo-accounts and already represent the user's share — their splits have negative amounts for debt tracking and should NOT be subtracted from spending.

This bug was confirmed via integration tests in `backend/tests/integration/api/test_budget_spending.rs` — the tests `test_budget_spending_accounts_for_splits` and `test_budget_spending_mixed_splits` both fail, proving the budget service ignores splits entirely.

## User Stories

1. As a user, when I create a transaction that is split with a friend, I expect my budget to only reflect my share of the expense, not the full amount.
2. As a user, when I view my budget detail page, I expect the "Spent" amount to accurately represent what I personally spent, excluding amounts owed by others.
3. As a user, when I have a mix of split and non-split transactions, I expect the budget to correctly sum only my shares across all transactions.
4. As a user, when a friend pays for an expense on my behalf (debt transaction), I expect my budget to correctly show my share (the transaction amount), not zero.

## Acceptance Criteria

- [ ] Budget `current_spending` reflects the user's share (full amount minus sum of positive split amounts) for transactions with regular splits
- [ ] Budget `current_spending` remains unchanged (full amount) for transactions without splits
- [ ] Budget `current_spending` remains unchanged for debt transactions (splits have negative amounts and should not be subtracted)
- [ ] Budget `percentage_used` is calculated based on the user's share, not the full transaction amount
- [ ] Both `get_budget()` and `calculate_budget_status()` in the budget service are fixed consistently
- [ ] Existing integration tests `test_budget_spending_accounts_for_splits` and `test_budget_spending_mixed_splits` pass
- [ ] New integration test for debt transactions with category filters passes
- [ ] All existing budget tests continue to pass (no regressions)
- [ ] Dashboard budget statuses also reflect split-adjusted spending (if they use the same code path)

## Scope

| Feature                                                   | In Scope | Future |
| --------------------------------------------------------- | -------- | ------ |
| Fix budget spending to subtract regular split amounts     | ✅       |        |
| Handle debt transaction splits correctly (no subtraction) | ✅       |        |
| Fix both `get_budget()` and `calculate_budget_status()`   | ✅       |        |
| Integration tests for regular splits (already written)    | ✅       |        |
| Integration test for debt transaction + budget            | ✅       |        |
| Frontend changes                                          |          | ✅     |
| Per-user primary currency setting                         |          | ✅     |

## Out of Scope

- Frontend UI changes (the frontend already displays `current_spending` from the backend correctly; the fix is backend-only)
- Changing how splits are stored or validated
- Adding new API endpoints
- Database migrations

## Dependencies

- Existing `repositories::transaction::list_splits_for_transaction()` function to load splits
- Existing `TransactionSplit` model with `amount` field:
  - **Positive** for regular splits (friend's share of user-paid expense)
  - **Negative** for debt splits (user's debt to the payer)

## Open Questions

- None — the bug is well-understood and the fix accounts for both regular and debt transaction splits.
