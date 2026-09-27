# UI v2 (Telemetry) — Requirements

**GitHub Issue**: none yet
**Date**: 2026-09-27
**Status**: In Progress

## Summary

Rebuild the Master of Coin frontend from scratch in the Telemetry direction (dark-first finance terminal: monospace figures, zero radius, hairline grids, one hazard accent, dense data). Every capability of the current UI carries over (see `parity-inventory.md`); the fake, broken or dead parts are fixed or removed rather than ported. Chakra UI is dropped in favour of our own design tokens plus whatever headless/utility libraries fit best.

The backend is in scope where v2 needs it: missing API routes are added (reusing existing services and endpoints wherever possible), and two approved data model changes are made (account archive, user preferences). Budget notes are dropped: the v1 Notes field that was never saved is removed.

## Decisions already made

| Topic | Decision |
|---|---|
| Visual direction | C Telemetry, all pages |
| Top bar | Status strip: fixed slots (net worth, month net, budgets, last sync) plus a rotating alert slot |
| Transactions layout | Filter rail (left rail filters, date-grouped rows, detail drawer) |
| Approach | Rewrite pages, components, layout and styling. Keep and clean the API/types/query layer. Same `frontend/` folder on `feat/ui-v2`; v1 screens deleted as v2 replaces them, no runtime switch |
| Component library | Drop Chakra UI; free choice of libraries |
| Unmocked pages | Built directly in React, no further mocks |
| Backend | In scope. API-only changes proceed; data model changes need approval (archive and preferences approved) |

## User Stories

1. As a user, I see every page of the app in the Telemetry design, in dark and light, at desktop and phone widths.
2. As a user, the top status strip shows my net worth, this month's net, budget health and last sync, and rotates alerts (exceeded or warning budgets, large spends, people who owe me).
3. As a user, I can search transactions by title and notes and filter them server-side (account, category, person, date range, amount range, sign, has splits, in transfer, paid by others), with the filters kept in the URL and a real total count.
4. As a user, I can bulk select transactions and delete them.
5. As a user, I can see my net worth trend over time and my income and spend by month.
6. As a user, I can edit a budget, including its limit and period, and see its range history.
7. As a user, I can archive an account so it leaves my active lists but keeps its history, and unarchive it.
8. As a user, I can update my profile and password, and my currency, date format and number format preferences are saved and applied everywhere.
9. As a user, reports use my full data for the chosen period, with multi-currency totals converted properly.
10. As a user, I can see which jobs a schedule started, and run or delete a schedule from its detail page.
11. As a user, everything is reachable by keyboard, and motion respects reduced-motion settings.

## Acceptance Criteria

### Parity

- [ ] Every route in `parity-inventory.md` exists in v2 (21 pages) with all of its listed capabilities, modals and states (loading, empty, error, not found)
- [ ] All 17 modals/flows carry over: transaction, transfer, convert to transfer, CSV import (3 steps), split mismatch, account, budget, category, person, settle debt, schedule, sync wizard (4 steps), drift detection, API key create/created/edit/revoke
- [ ] Integrations keep working end to end: Splitwise/SplitPro connect and sync, TrueLayer connect and bank sync import, Trading 212 portfolio sync

### Design system

- [ ] Telemetry tokens (colour, type, spacing, hairlines, motion) defined once and used everywhere; no Chakra dependency left in `package.json`
- [ ] Dark and light themes; theme follows system by default and is switchable
- [ ] Responsive at 1440px and 390px (sidebar becomes drawer or bottom bar)
- [ ] Money uses tabular numerals; negative means money out; in/out never shown by colour alone
- [ ] Non-EUR (non primary currency) amounts show native amount plus converted amount
- [ ] No arrow glyphs or en/em dashes in any UI copy
- [ ] Accessibility: visible focus rings, keyboard reachable controls, labels above inputs, AA contrast, charts have a text summary
- [ ] Motion honours `prefers-reduced-motion`

### Fixes carried in (from the parity inventory quirks)

- [ ] Header shows the actual page title; breadcrumbs navigate without a full page reload
- [ ] Confirm dialogs stay open with a loading state until the action finishes and show errors inline
- [ ] Transaction date and time are entered and stored in the user's local time zone correctly
- [ ] Bank accounts show "Sync bank", not "Sync portfolio"
- [ ] Budgets list shows every budget, days remaining is correct, "average usage" is computed correctly
- [ ] People debt overview uses full data, not the first 50 transactions
- [ ] CSV import preview summary reflects edits, and editing a row keeps bank sync metadata
- [ ] Schedule preset labels match their cron (Weekly is described correctly)
- [ ] Editing an API key does not silently change its expiry
- [ ] TrueLayer callback lands on the right place with a success or error toast
- [ ] Account type select offers the user-creatable types (including Gift card; excluding Loan, and Debt, which is the system-managed pseudo-account)
- [ ] One HTTP client, one query client; unused hooks, components and services removed
- [ ] Settings About shows the real version; dead links removed
- [ ] Fake or static UI removed: 2FA "coming soon" and static sessions card are removed until real

### Backend: API only

- [ ] Net worth history endpoint (computed from transactions; current FX rates, stated in the UI)
- [ ] Spending trend endpoint (monthly income and spend) using the existing analytics service
- [ ] Budget ranges: list, update, delete, with an overlap check and a deterministic active range
- [ ] `GET /budgets` includes spend and status for each budget
- [ ] Profile update and change password endpoints
- [ ] Jobs expose the schedule that started them; schedule detail supports run now
- [ ] Fixes from the backend findings task where v2 depends on them: N+1 queries on dashboard and balances, lossy balance conversion, CORS exposing `X-Total-Count`, search indexes

### Backend: data model (approved)

- [ ] Accounts can be archived and unarchived; archived accounts are excluded from active lists and pickers but their transactions remain visible and counted where appropriate
- [ ] User preferences stored server-side: default currency, date format, number format (theme stays client-side)

## Scope

| Feature | In Scope | Future |
|---|---|---|
| All 21 pages rebuilt in Telemetry | ✅ | |
| Status strip with rotating alerts | ✅ | |
| Server-side search, filters, bulk delete | ✅ | |
| Net worth history and spending trend charts | ✅ | |
| Budget editing and range history | ✅ | |
| Account archive | ✅ | |
| Real profile, password and preferences | ✅ | |
| Historical FX rates for net worth history | | ✅ |
| 2FA and active sessions | | ✅ |
| Command palette and keyboard shortcuts beyond basics | | ✅ |
| Report export (CSV/PDF) | | ✅ |
| Bank sync on a schedule | | ✅ |

## Out of Scope

- Changes to integrations' behaviour (Splitwise, SplitPro, TrueLayer, Trading 212) beyond what the UI needs
- Budget notes (the unsaved v1 field is removed, no column added)
- The real-time card capture client (outside this repo)
- Keeping v1 alongside v2 at runtime

## Dependencies

- `parity-inventory.md` (capability source of truth)
- `mocks/c-telemetry/` (visual reference for Dashboard, Transactions (filter rail), Accounts, Budgets)
- Backend findings task on the board (parent "Master of Coin backend: findings from the v2 UI audit"); children v2 depends on are pulled into this work

## Open Questions

- None. Budget notes resolved 2026-09-27: dropped.
