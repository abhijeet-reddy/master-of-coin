# Gift Card Account Type — Requirements

**GitHub Issue**: [#47 - Introduce new account type: Gift Card](https://github.com/abhijeet-reddy/master-of-coin/issues/47)
**Date**: 2026-03-12
**Status**: Draft

## Summary

Add a new "Gift Card" account type to support tracking gift card balances. Gift cards behave like prepaid/stored-value accounts with a declining balance.

## User Stories

1. As a user, I can create a new account with type "Gift Card".
2. As a user, I can see Gift Card accounts in my accounts list with a distinctive icon and color.
3. As a user, I can add transactions (expenses) to Gift Card accounts to track spending.
4. As a user, I can transfer between Gift Card accounts and other accounts.

## Acceptance Criteria

- [x] "Gift Card" is a valid account type in the backend schema/enum
- [x] "Gift Card" option appears in the account creation and edit forms
- [x] Gift Card accounts display with appropriate icon and color in all views
- [x] Gift Card accounts can have transactions and transfers
- [x] No regression in existing account type functionality

## Scope

| Feature                             | In Scope | Future |
| ----------------------------------- | -------- | ------ |
| Backend enum + migration            | ✅       |        |
| Frontend enum + form option         | ✅       |        |
| Icon and color in all account views | ✅       |        |
| Gift card expiry tracking           |          | ✅     |
| Gift card balance alerts            |          | ✅     |

## Out of Scope

- Gift card expiry date tracking
- Low balance alerts for gift cards
- Gift card-specific reporting

## Dependencies

- None

## Open Questions

- None
