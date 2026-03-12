# Add Transaction Button on Account Detail — Requirements

**GitHub Issue**: [#49 - Add Transaction button on Account Detail page](https://github.com/abhijeet-reddy/master-of-coin/issues/49)
**Date**: 2026-03-11
**Status**: Complete

## Summary

Add an "Add Transaction" button to the Account Detail page that opens the transaction creation form with the current account pre-selected. This saves users from manually selecting the account when adding transactions from the account view.

## User Stories

1. As a user viewing an account's detail page, I can click "Add Transaction" to create a new transaction with that account pre-selected.
2. As a user, I can still change the account in the form if I want.

## Acceptance Criteria

- [x] "Add Transaction" button visible on Account Detail page header
- [x] Clicking it opens the TransactionFormModal with the current account pre-selected
- [x] User can still change the account in the form
- [x] Transaction is created successfully with the pre-selected account
- [x] No regression in existing Account Detail or Transaction form functionality

## Scope

| Feature                               | In Scope | Future |
| ------------------------------------- | -------- | ------ |
| Add Transaction button on detail page | ✅       |        |
| Pre-select account in form            | ✅       |        |
| Allow user to change account          | ✅       |        |

## Out of Scope

- Adding the button to the Accounts list page
- Pre-selecting category based on account type

## Dependencies

- None

## Open Questions

- None
