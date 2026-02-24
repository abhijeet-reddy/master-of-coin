# Account-to-Account Transfers — Requirements

**Date**: 2026-02-23
**Status**: In Progress

## Summary

Users need the ability to transfer money between their own accounts. A transfer is an atomic operation that creates two linked transactions: a debit (outflow) on the source account and a credit (inflow) on the destination account. Cross-currency transfers are supported - the user can specify amounts on both sides or provide an exchange rate, with the rate auto-computed and displayed.

## User Stories

1. As a user, I can transfer money from one of my accounts to another by specifying the source account, destination account, amount, and date.
2. As a user, when transferring between accounts with different currencies, I can either enter the exchange rate directly OR enter the amounts on both sides and see the computed exchange rate.
3. As a user, I can see transfers visually differentiated from regular income/expense transactions in the transaction list (e.g., a "Transfer" badge).
4. As a user, when I view a transfer transaction, I can see which account the money was transferred to/from.
5. As a user, when I delete a transfer, both the source and destination transactions are deleted together.

## Acceptance Criteria

- [ ] A dedicated `POST /api/v1/transfers` endpoint exists that atomically creates two linked transactions
- [ ] Source account is debited (negative amount) and destination account is credited (positive amount)
- [ ] Both accounts must belong to the authenticated user
- [ ] Cross-currency transfers are supported: user provides `from_amount` and `to_amount` (or `from_amount` + `exchange_rate`)
- [ ] Same-currency transfers require only a single `amount` field
- [ ] Transfer transactions are linked via a `transfers` table so they can be identified and managed together
- [ ] When listing transactions, transfer transactions include metadata indicating the linked account
- [ ] The frontend Transactions page has a "Transfer" option/button that opens a transfer form
- [ ] The transfer form supports both same-currency and cross-currency flows
- [ ] For cross-currency: user can enter amounts on both sides and the exchange rate is auto-computed and displayed
- [ ] For cross-currency: user can enter an exchange rate and the destination amount is auto-computed
- [ ] Transfer transactions are visually differentiated in the transaction list (e.g., "Transfer" badge, arrow icon)
- [ ] Deleting a transfer deletes both linked transactions atomically
- [ ] Backend integration tests cover transfer creation, cross-currency, deletion, and error cases

## Scope

| Feature                                          | In Scope | Future |
| ------------------------------------------------ | -------- | ------ |
| Same-currency transfers                          | ✅       |        |
| Cross-currency transfers                         | ✅       |        |
| User-specified exchange rate                     | ✅       |        |
| Auto-computed exchange rate from amounts         | ✅       |        |
| Atomic creation of linked transactions           | ✅       |        |
| Atomic deletion of linked transactions           | ✅       |        |
| Transfer badge in transaction list               | ✅       |        |
| Transfer form modal on Transactions page         | ✅       |        |
| Editing a transfer (update both sides)           |          | ✅     |
| Recurring/scheduled transfers                    |          | ✅     |
| Auto-fetch exchange rates from API as suggestion |          | ✅     |

## Out of Scope

- Editing an existing transfer (updating amounts/accounts after creation) — future enhancement
- Recurring/scheduled transfers — can be built on top of the schedules feature later
- Automatically fetching live exchange rates — user must provide the rate or both amounts manually
- Transfer between accounts of different users

## Dependencies

- Existing `transactions` table and transaction creation flow
- Existing `accounts` table and account ownership verification
- Existing frontend Transactions page with `TransactionFormModal` pattern

## Open Questions

- None — all questions resolved during requirements discussion.
