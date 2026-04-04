# Manual Investment Value Update — Requirements

**Date**: 2026-04-04
**Status**: In Progress

## Summary

Investment accounts need the ability to have their balance manually updated by the user. Currently, the balance is computed from the sum of all transactions. For investment accounts, users want to simply set the current portfolio value without creating individual transactions. Additionally, the "Add Transaction" button should be removed from the account detail page for investment accounts since manual transaction entry doesn't make sense for this account type.

## User Stories

1. As a user, I can manually update the value of my investment account by entering the current portfolio value.
2. As a user, when I view an investment account detail page, I do not see an "Add Transaction" button since investment accounts are value-tracked, not transaction-tracked.
3. As a user, when I update my investment value, the system creates an adjustment transaction behind the scenes to reconcile the balance.

## Acceptance Criteria

- [ ] Investment account detail page shows an "Update Value" button
- [ ] Clicking "Update Value" allows the user to enter a new total balance
- [ ] Submitting the new value creates a balance adjustment transaction (difference between current and new balance)
- [ ] The account balance updates immediately after submission
- [ ] The "Add Transaction" button is hidden on the account detail page for investment accounts
- [ ] The filter toggle button remains visible for investment accounts
- [ ] Non-investment accounts are unaffected — they still show "Add Transaction"

## Scope

| Feature                                    | In Scope | Future |
| ------------------------------------------ | -------- | ------ |
| Manual balance update for investment accts | ✅       |        |
| Hide "Add Transaction" for investments     | ✅       |        |
| Update Value UI on AccountInfoCard         | ✅       |        |
| Backend endpoint for setting balance       | ✅       |        |
| Historical value tracking / charting       |          | ✅     |
| Automatic portfolio sync changes           |          | ✅     |

## Out of Scope

- Changes to the automatic portfolio sync feature (Trading 212 integration)
- Historical investment value tracking or performance charts
- Hiding transactions list for investment accounts (adjustment transactions should still be visible)

## Dependencies

- None — this builds on existing account and transaction infrastructure

## Open Questions

- None
