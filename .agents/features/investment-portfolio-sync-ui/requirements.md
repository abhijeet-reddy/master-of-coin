# Investment Portfolio Sync UI — Requirements

**GitHub Issue**: [#50 - Investment Portfolio Sync Job](https://github.com/abhijeet-reddy/master-of-coin/issues/50)
**Date**: 2026-03-15
**Status**: Draft

## Summary

Add frontend UI to the Account Detail page for INVESTMENT accounts that allows users to connect their Trading 212 brokerage account, trigger portfolio sync jobs, and view sync results. Also ensure the `PORTFOLIO_SYNC` job type is available in the existing Schedules and Jobs pages. This is the frontend counterpart to the backend investment portfolio sync feature already implemented.

## User Stories

1. As a user viewing an INVESTMENT account, I can see a section to connect a brokerage provider.
2. As a user, I can enter my Trading 212 API key and secret to connect my brokerage.
3. As a user, I can see the connected provider status and disconnect it.
4. As a user, I can trigger a manual portfolio sync to update my account balance.
5. As a user, I can see the sync job progress (pending, running, completed, failed).
6. As a user, I can see the sync result (previous balance, new value, adjustment amount).
7. As a user, I can retry a failed sync job.
8. As a user, I can create a scheduled portfolio sync via the existing Schedules page.
9. As a user, I can see PORTFOLIO_SYNC jobs in the Jobs page listing.

## Acceptance Criteria

- [ ] Investment provider section only appears on INVESTMENT account detail pages
- [ ] Connect form accepts API key, API secret, and environment (live/demo)
- [ ] Credentials are validated via the backend before saving (backend makes test API call)
- [ ] Connected provider shows status card with disconnect option
- [ ] Sync button triggers a portfolio sync job
- [ ] Sync progress shows real-time status updates (polling while PENDING/RUNNING)
- [ ] Completed sync shows previous balance, new value, and adjustment amount
- [ ] Failed sync shows error message with retry button
- [ ] `PORTFOLIO_SYNC` job type appears in the Jobs page listing
- [ ] `PORTFOLIO_SYNC` job type is available in the Schedule creation form

## Scope

| Feature                          | In Scope | Future |
| -------------------------------- | -------- | ------ |
| Connect/disconnect Trading 212   | ✅       |        |
| Manual portfolio sync trigger    | ✅       |        |
| Sync status polling and display  | ✅       |        |
| Sync result display              | ✅       |        |
| PORTFOLIO_SYNC in Jobs page      | ✅       |        |
| PORTFOLIO_SYNC in Schedules page | ✅       |        |
| Multiple provider support UI     |          | ✅     |
| Portfolio value history chart    |          | ✅     |

## Out of Scope

- Multiple provider support (one provider per account for now)
- Portfolio value history charting

## Dependencies

- Backend API endpoints (already implemented and committed)
- Existing Account Detail page and component patterns
- Existing Schedules page and Jobs page
- Chakra UI v3 component library
