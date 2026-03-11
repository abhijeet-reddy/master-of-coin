# Hide Split Option for Income Transactions — Requirements

**GitHub Issue**: [#53 - Hide split option for income transactions](https://github.com/abhijeet-reddy/master-of-coin/issues/53)
**Date**: 2026-03-11
**Status**: Complete

## Summary

The split payment functionality should not be available for income transactions. Splitting expenses makes sense (e.g., sharing a dinner bill), but splitting income is not a typical use case and causes confusion. The "Enable Split Payment" button should be hidden when the transaction type is set to "Income", and the backend should reject any attempt to create/update an income transaction with splits.

## User Stories

1. As a user, when I create or edit an income transaction, I should **not** see the "Enable Split Payment" button.
2. As a user, when I switch a transaction from "Expense" to "Income" while the split form is open, the split should be automatically disabled and cleared.
3. As a user, when I switch back from "Income" to "Expense", I should be able to enable split payment again.
4. As a developer, if an API request attempts to create/update an income transaction with splits, the backend should reject it with a validation error.

## Acceptance Criteria

- [x] The "Enable/Disable Split Payment" button is hidden when transaction type is "Income"
- [x] The Split Payment Form is hidden when transaction type is "Income"
- [x] Switching from "Expense" to "Income" auto-disables splits and clears split data
- [x] Switching from "Income" to "Expense" allows re-enabling splits
- [x] Backend rejects splits on income transactions (positive amount) with a validation error
- [x] No regression in existing split functionality for expense transactions
- [x] No regression in functionality or data accuracy

## Scope

| Feature                                    | In Scope | Future |
| ------------------------------------------ | -------- | ------ |
| Hide split toggle for income in form modal | ✅       |        |
| Auto-clear splits on type change           | ✅       |        |
| Backend validation of splits on income     | ✅       |        |

## Out of Scope

- Changes to the transaction detail view (splits card already only renders when splits exist)
- Changes to the transaction list view (split badge already only renders when splits exist)

## Dependencies

- None — this is a self-contained frontend + backend change

## Open Questions

- None
