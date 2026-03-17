# Person Transaction View — Requirements

**Date**: 2026-03-17
**Status**: Draft

## Summary

Create a Person Detail page (`/people/:id`) that displays a person's information card alongside a list of all transactions associated with that person. This follows the same pattern as the existing Account Detail and Category Detail pages. Currently, the People page shows person cards with debt summaries, but clicking "Transactions" only shows a placeholder message. This feature provides a full transaction view for each person.

## User Stories

1. As a user, I can click on a person card to navigate to a Person Detail page showing their info and all related transactions.
2. As a user, I can see all transactions where I have splits with a specific person (both "I paid" and "they paid" transactions).
3. As a user, I can filter the person's transactions by account, date range, amount, and transaction type.
4. As a user, I can navigate from a person's transaction list to individual transaction details and back.
5. As a user, I can edit or delete the person from their detail page.

## Acceptance Criteria

- [ ] Person Detail page accessible at `/people/:id`
- [ ] Person info card displayed with name, contact info, debt summary, and actions (edit, delete, settle)
- [ ] Transaction list shows all transactions with splits involving this person
- [ ] Transaction list supports infinite scroll pagination
- [ ] Transaction filters (account, date range, amount, type) work correctly
- [ ] Breadcrumb navigation: People → Person Name
- [ ] Navigation state passed to transaction rows for proper back-navigation
- [ ] Backend supports `person_id` filter on the transactions endpoint
- [ ] Loading, error, and empty states handled properly
- [ ] Person card on People list page links to the detail page

## Scope

| Feature                          | In Scope | Future |
| -------------------------------- | -------- | ------ |
| Person Detail page               | ✅       |        |
| Backend person_id filter         | ✅       |        |
| Person info card with actions    | ✅       |        |
| Transaction list with pagination | ✅       |        |
| Transaction filters              | ✅       |        |
| Breadcrumb navigation            | ✅       |        |
| PersonCard click-to-navigate     | ✅       |        |
| Settle debt from detail page     | ✅       |        |
| Split provider config on detail  |          | ✅     |

## Out of Scope

- Split provider configuration display on the detail page (can be added later)
- Transaction creation from the person detail page
- Editing transactions inline from the person detail page

## Dependencies

- Existing `PersonCard`, `PersonFormModal`, `SettleDebtModal` components
- Existing `TransactionList`, `TransactionFilters` components
- Backend `TransactionFilter` model and `list_transactions` repository function
- `useEnrichedTransactions` hook for transaction enrichment

## Open Questions

- None — all patterns are well-established in AccountDetail and CategoryDetail pages.
