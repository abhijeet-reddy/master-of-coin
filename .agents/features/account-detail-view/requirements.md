# Account Detail View — Requirements

**GitHub Issue**: [#43 - Create Account view](https://github.com/abhijeet-reddy/master-of-coin/issues/43)
**Date**: 2026-03-01
**Status**: Draft

## Summary

Users should be able to click on an account in the Accounts page and navigate to a detail view that shows the account's information along with its transactions, filtered by that account. This provides a focused view of a single account's activity with the ability to further filter and infinitely scroll through transactions within that account context.

## User Stories

1. As a user, I can click on an account card on the Accounts page to navigate to that account's detail view.
2. As a user, I can see the account's key information (name, type, currency, balance, notes) at the top of the detail page.
3. As a user, I can see all transactions belonging to that account with infinite scroll.
4. As a user, I can filter the account's transactions by category, transaction type, date range, and amount range.
5. As a user, I can edit or delete the account from the detail view.
6. As a user, I can navigate back to the Accounts list via breadcrumbs.

## Acceptance Criteria

- [ ] Clicking an account card on the Accounts page navigates to `/accounts/:id`
- [ ] The Account Detail page shows account info (name, type, currency, balance, notes)
- [ ] The Account Detail page shows transactions filtered to that account
- [ ] Transactions support infinite scroll pagination
- [ ] Transactions support additional filtering (category, type, date range, amount)
- [ ] The page has breadcrumbs: Accounts > {Account Name}
- [ ] Edit and Delete actions are available from the detail page
- [ ] Loading and error states are handled gracefully
- [ ] The page follows existing detail page patterns (TransactionDetail, ScheduleDetail)

## Scope

| Feature                              | In Scope | Future |
| ------------------------------------ | -------- | ------ |
| Account detail route `/accounts/:id` | ✅       |        |
| Account info card                    | ✅       |        |
| Account transactions list            | ✅       |        |
| Infinite scroll pagination           | ✅       |        |
| Transaction filters (category, type) | ✅       |        |
| Edit/Delete account from detail      | ✅       |        |
| Breadcrumb navigation                | ✅       |        |
| Account-specific charts/analytics    |          | ✅     |
| Transaction creation from detail     |          | ✅     |

## Out of Scope

- Account-specific spending charts or analytics (future enhancement)
- Creating new transactions directly from the account detail page (can navigate to Transactions page)
- Account transfer history as a separate section
- Month-based navigation (using infinite scroll instead)

## Dependencies

- Existing `GET /transactions?account_id=<uuid>` backend filtering (already supported)
- Existing `GET /accounts/:id` endpoint (already exists)
- Existing `useAccount` hook (already exists)
- Existing `useTransactions` hook with filter support (already exists)

## Open Questions

- None — all required backend support already exists.
