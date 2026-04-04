# Duplicate Transaction — Requirements

**Date**: 2026-04-04
**Status**: In Progress

## Summary

Users frequently create similar transactions (e.g., recurring purchases, weekly groceries, monthly subscriptions). Currently, they must manually re-enter all fields each time. The "Duplicate Transaction" feature adds a copy/duplicate action to every page where transactions are displayed, opening the existing `TransactionFormModal` pre-filled with the source transaction's data (title, amount, category, account, notes) but with today's date and time, allowing the user to review and modify before saving.

This is a **frontend-only** feature — no backend changes are needed since the existing `POST /transactions` (and `POST /debt-transactions`) endpoints already handle creation.

## User Stories

1. As a user viewing a transaction in a list, I can click a "Duplicate" button to open a pre-filled form modal so I can quickly create a similar transaction.
2. As a user viewing a single transaction's detail page, I can click a "Duplicate" button in the action bar to open a pre-filled form modal.
3. As a user, when I duplicate a transaction, the form is pre-filled with the original's title, amount, category, account, and notes, but the date and time default to now so I don't accidentally create a backdated entry.
4. As a user, I can modify any field in the duplicated form before saving, just like creating a new transaction.
5. As a user, when I duplicate a debt ("paid by others") transaction, the form opens in "Someone else paid" mode with the payer and amount pre-filled.

## Acceptance Criteria

- [ ] A "Duplicate" icon button appears on each `TransactionRow` in the transaction list (alongside the existing delete button)
- [ ] A "Duplicate" button appears in the `TransactionActions` bar on the Transaction Detail page
- [ ] Clicking "Duplicate" opens the `TransactionFormModal` in **create** mode (not edit) with fields pre-filled from the source transaction
- [ ] Pre-filled fields: title, amount (absolute value), transaction type (income/expense), account, category, notes
- [ ] Date defaults to today, time defaults to current time (NOT the source transaction's date)
- [ ] Splits are NOT copied (user must re-add splits if needed)
- [ ] Debt metadata (expense participants) is NOT copied — only payer_person_id and currency are pre-filled for debt transactions
- [ ] The duplicate action works on all transaction-displaying pages: Transactions, Account Detail, Category Detail, Person Detail, Budget Detail, Transaction Detail
- [ ] The duplicate action is NOT present on the Trash page
- [ ] After saving the duplicated transaction, the transaction list refreshes to show the new entry
- [ ] The modal title shows "Add Transaction" (not "Edit Transaction") since this creates a new transaction

## Scope

| Feature                                    | In Scope | Future |
| ------------------------------------------ | -------- | ------ |
| Duplicate button on TransactionRow         | ✅       |        |
| Duplicate button on TransactionDetail page | ✅       |        |
| Pre-fill form modal with source data       | ✅       |        |
| Duplicate debt transactions (basic)        | ✅       |        |
| Copy splits to duplicated transaction      |          | ✅     |
| Copy expense participants                  |          | ✅     |
| Keyboard shortcut for duplicate            |          | ✅     |
| Bulk duplicate (multiple transactions)     |          | ✅     |

## Out of Scope

- Backend API changes (uses existing create endpoints)
- Copying split payment details
- Copying expense participant details (only payer info for debt transactions)
- Duplicate action on the Trash page
- Duplicate action for transfer transactions (these involve two linked accounts)

## Dependencies

- Existing `TransactionFormModal` component
- Existing `useCreateTransaction` and `useCreateDebtTransaction` hooks
- Existing `TransactionRow` and `TransactionActions` components

## Open Questions

- None — requirements are clear based on user confirmation.
