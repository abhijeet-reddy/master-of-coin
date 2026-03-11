# Auto-set Transfer Category — Requirements

**GitHub Issue**: [#51 - Auto-set Transfer category when creating transfers](https://github.com/abhijeet-reddy/master-of-coin/issues/51)
**Date**: 2026-03-11
**Status**: Complete

## Summary

When creating a transfer between accounts, the category should be automatically set to "Transfer" rather than requiring the user to manually select it. The intent is already clear from the form context.

## User Stories

1. As a user, when I open the Transfer form, the "Transfer" category should be pre-selected.
2. As a user, I can still change the category to something else if I want.
3. As a user, if no "Transfer" category exists, the category field should remain empty (no error).

## Acceptance Criteria

- [x] Transfer form auto-selects the "Transfer" category on open
- [x] User can still change the category manually
- [x] If no "Transfer" category exists, the field defaults to empty (graceful fallback)
- [x] No regression in transfer form functionality

## Scope

| Feature                                  | In Scope | Future |
| ---------------------------------------- | -------- | ------ |
| Auto-select Transfer category on open    | ✅       |        |
| Allow user to override category          | ✅       |        |
| Create Transfer category if not existing |          | ✅     |

## Out of Scope

- Auto-creating a "Transfer" category if one doesn't exist
- Backend changes (the category_id is already optional in the API)

## Dependencies

- None

## Open Questions

- None
