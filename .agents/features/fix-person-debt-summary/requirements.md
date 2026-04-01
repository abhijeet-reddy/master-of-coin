# Fix Person Debt Summary — Requirements

**Date**: 2026-04-01
**Status**: Draft

## Summary

The People page and Person Detail page display "Net Balance: Settled: €0.00" for every person, regardless of actual debts. When a user has split transactions with a person, the debt amounts should be calculated and displayed, but they always show zero.

## Root Cause

The backend `PersonResponse` struct does not include `debt_summary` or `transaction_count` fields. The frontend expects these fields to render debt information, but since they're absent from the API response, the balance defaults to zero. The debt calculation logic exists in the codebase but is never called when listing or fetching people.

## User Stories

1. As a user, when I view the People page, I can see the correct net balance for each person
2. As a user, when I view a Person Detail page, I can see accurate "Owes Me", "I Owe", and "Net Balance" amounts
3. As a user, I can see how many transactions I've shared with each person
4. As a user, I see a "Settle Up" button only when there is an outstanding balance with a person

## Acceptance Criteria

- [ ] Each person on the People page shows their correct debt balance based on split transactions
- [ ] Each person shows the correct count of shared transactions
- [ ] The Person Detail page shows accurate "Owes Me", "I Owe", and "Net Balance" values
- [ ] The "Settle Up" button appears when there is a non-zero balance
- [ ] A person with no split transactions shows "Settled: €0.00"
- [ ] The DebtSummary card on the People page shows correct aggregate totals

## Scope

| Feature                               | In Scope | Future |
| ------------------------------------- | -------- | ------ |
| Backend returns debt data with people | ✅       |        |
| Backend returns transaction count     | ✅       |        |
| Frontend changes if needed            | ✅       |        |
| Efficient batch query (no N+1)        | ✅       |        |

## Out of Scope

- Database schema changes (no migrations needed)
- Query optimization (can be addressed separately if needed)

## Notes

- The frontend components (`PersonCard`, `PersonInfoCard`, `DebtSummary`) already read `debt_summary` and `transaction_count` from the person object. If the backend returns these fields correctly, the frontend should work without changes. However, any frontend adjustments needed are in scope.

## Dependencies

- Existing debt calculation logic in the codebase
- Existing split transaction data in the database
