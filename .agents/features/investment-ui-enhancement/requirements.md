# Investment Account UI Enhancement — Requirements

**GitHub Issue**: [#50](https://github.com/abhijeet-reddy/master-of-coin/issues/50) (follow-up)
**Date**: 2026-03-15
**Status**: In Progress

## Summary

The investment portfolio sync feature (issue #50) was implemented but the UI has several usability issues. The Account Detail page is cluttered with separate cards for Brokerage Connection and Portfolio Sync. The Account create/edit modal has no way to connect a brokerage provider for Investment accounts. The Portfolio Sync job detail page fails to load because the `JobDetailPage` doesn't recognize the `portfolio-sync` job type.

This enhancement consolidates the investment provider UI into the account edit flow and fixes the broken job detail page.

## User Stories

1. As a user, when I view an Investment account detail page, I see a clean layout with a "Sync Portfolio" button next to the Edit button — not separate cards cluttering the page.
2. As a user, when I click "Sync Portfolio", the button shows a loading spinner until the sync job completes (or fails), without navigating away.
3. As a user, when a portfolio sync fails, I see an error message on the account detail page with an option to view the full job details.
4. As a user, when I create or edit an Investment account, I can connect/disconnect my brokerage provider directly in the form modal.
5. As a user, when I click on a Portfolio Sync job in the Jobs list, I see the job detail page load correctly with status, timestamps, and results.

## Acceptance Criteria

- [ ] The Account Detail page for Investment accounts no longer shows separate `InvestmentProviderCard` and `PortfolioSyncSection` cards
- [ ] A "Sync Portfolio" button appears next to the Edit button on Investment account detail pages (only when a provider is connected)
- [ ] The "Sync Portfolio" button shows a loading/spinner state while the sync job is running, and returns to normal when complete
- [ ] On sync failure, an error message is displayed on the account detail page with a link/button to navigate to the job details page
- [ ] Sync success is communicated via toast notifications (already exists in hook)
- [ ] The Account Edit modal for Investment accounts includes a section to connect/disconnect a brokerage provider (API key, secret, environment)
- [ ] The Account Create modal for Investment accounts includes a section to connect a brokerage provider after creation (or shows a note that connection can be done after creation)
- [ ] The Portfolio Sync job detail page (`/jobs/portfolio-sync/:id`) loads correctly and displays job status, timestamps, and sync results
- [ ] The Jobs list page correctly links to portfolio-sync job detail pages

## Scope

| Feature                                           | In Scope | Future |
| ------------------------------------------------- | -------- | ------ |
| Remove InvestmentProviderCard from account detail | ✅       |        |
| Remove PortfolioSyncSection from account detail   | ✅       |        |
| Add Sync Portfolio button to AccountInfoCard      | ✅       |        |
| Inline sync failure message with job detail link  | ✅       |        |
| Add provider connection to AccountFormModal       | ✅       |        |
| Fix portfolio-sync job detail page                | ✅       |        |
| Support multiple provider types                   |          | ✅     |

## Out of Scope

- Supporting providers other than Trading 212
- Displaying portfolio sync history on the account detail page

## Dependencies

- Existing investment provider API endpoints (connect, disconnect, list)
- Existing portfolio sync API endpoints (start, get job, retry)
- Existing `useInvestmentProviderConnection` and `usePortfolioSyncTrigger` hooks

## Open Questions

- None — all three issues are clearly scoped from the screenshots and code review.
