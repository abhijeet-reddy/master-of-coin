# Breadcrumb Navigation Source — Requirements

**GitHub Issue**: [#52 - Breadcrumbs should reflect navigation source (Account vs Transaction)](https://github.com/abhijeet-reddy/master-of-coin/issues/52)
**Date**: 2026-03-08
**Status**: In Progress

## Summary

The breadcrumb navigation on the Transaction Detail page always shows "Transactions > Details" regardless of where the user navigated from. When a user clicks a transaction from an Account Detail page, the breadcrumb should reflect that path (e.g., "Accounts > Account Name > Transaction Title"). Similarly, navigating from Category Detail or Budget Detail should show the appropriate breadcrumb trail. This ensures users can always navigate back to where they came from.

## User Stories

1. As a user, when I navigate to a transaction from the Account Detail page, I see breadcrumbs showing "Accounts > [Account Name] > [Transaction Title]" and can click to go back to the account.
2. As a user, when I navigate to a transaction from the Transactions list, I see breadcrumbs showing "Transactions > [Transaction Title]" and can click to go back to the transactions list.
3. As a user, when I navigate to a transaction from the Category Detail page, I see breadcrumbs showing "Categories > [Category Name] > [Transaction Title]" and can click to go back to the category.
4. As a user, when I navigate to a transaction from the Budget Detail page, I see breadcrumbs showing "Budgets > [Budget Name] > [Transaction Title]" and can click to go back to the budget.
5. As a user, when I navigate to a transaction from the Dashboard, I see breadcrumbs showing "Transactions > [Transaction Title]" (default behavior since Dashboard is a summary view).
6. As a user, when I navigate directly to a transaction URL (e.g., bookmark or shared link), I see the default breadcrumbs "Transactions > [Transaction Title]".

## Acceptance Criteria

- [ ] Navigating from Account Detail → Transaction Detail shows: `Accounts > [Account Name] > [Transaction Title]`
- [ ] Navigating from Transactions list → Transaction Detail shows: `Transactions > [Transaction Title]`
- [ ] Navigating from Category Detail → Transaction Detail shows: `Categories > [Category Name] > [Transaction Title]`
- [ ] Navigating from Budget Detail → Transaction Detail shows: `Budgets > [Budget Name] > [Transaction Title]`
- [ ] Navigating from Dashboard → Transaction Detail shows: `Transactions > [Transaction Title]`
- [ ] Direct URL access (no navigation state) shows default: `Transactions > [Transaction Title]`
- [ ] Clicking breadcrumb links navigates to the correct source page
- [ ] Delete action on transaction navigates back to the correct source page (not always `/transactions`)

## Scope

| Feature                                   | In Scope | Future |
| ----------------------------------------- | -------- | ------ |
| Account → Transaction breadcrumb          | ✅       |        |
| Category → Transaction breadcrumb         | ✅       |        |
| Budget → Transaction breadcrumb           | ✅       |        |
| Dashboard → Transaction breadcrumb        | ✅       |        |
| Direct URL fallback breadcrumb            | ✅       |        |
| Delete navigates back to source           | ✅       |        |
| Browser back button behavior              |          | ✅     |
| Breadcrumb context for other detail pages |          | ✅     |

## Out of Scope

- Changing breadcrumb behavior on pages other than Transaction Detail (Account Detail, Category Detail, Budget Detail already have correct breadcrumbs)
- Deep breadcrumb chains (e.g., Dashboard > Account > Transaction) — only one level of source context
- Persisting navigation source across page refreshes (state is ephemeral via `location.state`)

## Dependencies

- None — this is a frontend-only change using existing React Router capabilities

## Open Questions

- None at this time
