# Investment Account UI Enhancement — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#50](https://github.com/abhijeet-reddy/master-of-coin/issues/50) (follow-up)

---

## Frontend Implementation

### Phase 1: Fix Portfolio Sync Job Detail Page (Bug Fix)

#### 1.1 Add `portfolio-sync` to JobDetailPage

- [x] In `frontend/src/pages/JobDetail.tsx`, add `'portfolio-sync'` to the `JobDetailType` union type
- [x] Add `'portfolio-sync': 'Portfolio Sync'` to the `titleMap` record
- [x] Add the `portfolio-sync` case to the render switch (alongside `drift-detection` and `sync`)

#### 1.2 Create PortfolioSyncJobDetail component

- [x] Create `PortfolioSyncJobDetail` component in `frontend/src/pages/JobDetail.tsx` (inline, following the pattern of `DriftJobDetail` and `SyncJobDetail`)
- [x] Use `usePortfolioSyncJob` hook from `@/hooks/api/usePortfolioSync` to fetch job data
- [x] Show `JobHeaderCard` with title, status, timestamps
- [x] Show `JobProgressCard` while status is PENDING or RUNNING
- [x] Show error alert with retry button when FAILED
- [x] Show sync results when COMPLETED (use `PortfolioSyncReportView`)

#### 1.3 Create PortfolioSyncReportView component

- [x] Create `frontend/src/components/jobs/PortfolioSyncReportView.tsx`
- [x] Display a table/card with synced account results: account name, previous balance, new value, adjustment amount, status
- [x] Color-code adjustment amounts (green positive, red negative, muted for zero/no change)
- [x] Export from `frontend/src/components/jobs/index.ts`

#### 1.4 Verify

- [x] TypeScript compiles cleanly
- [x] Navigate to `/jobs/portfolio-sync/:id` and verify it loads correctly

---

### Phase 2: Restructure Account Detail Page

#### 2.1 Enhance AccountInfoCard with Sync Portfolio button

- [x] In `frontend/src/components/accounts/AccountInfoCard.tsx`, add new optional props: `onSync`, `isSyncing`, `syncFailed`, `syncError`, `syncJobId`, `showSyncButton`
- [x] Add a "Sync Portfolio" button next to the Edit button, visible only when `showSyncButton` is true
- [x] The button should show a loading spinner when `isSyncing` is true (use Chakra `loading` prop)
- [x] Below the card body, conditionally render an inline error alert when `syncFailed` is true, showing the error message and a "View Job Details" button linking to `/jobs/portfolio-sync/{syncJobId}`

#### 2.2 Update AccountDetailPage to remove separate cards and wire up sync

- [x] In `frontend/src/pages/AccountDetail.tsx`, remove the `<InvestmentProviderCard>` and `<PortfolioSyncSection>` components from the render
- [x] Import `usePortfolioSyncTrigger` from `@/hooks/usecase`
- [x] Import `useInvestmentProviderConnection` from `@/hooks/usecase`
- [x] Call `usePortfolioSyncTrigger(id)` and `useInvestmentProviderConnection(id)` for Investment accounts
- [x] Pass sync-related props to `AccountInfoCard`: `onSync={handleSync}`, `isSyncing`, `syncFailed`, `syncError`, `syncJobId`, `showSyncButton`
- [x] Remove unused imports for `InvestmentProviderCard` and `PortfolioSyncSection`

#### 2.3 Update barrel export

- [x] In `frontend/src/components/accounts/index.ts`, remove exports for `InvestmentProviderCard` and `PortfolioSyncSection`

#### 2.4 Verify

- [x] TypeScript compiles cleanly

---

### Phase 3: Add Broker Connection to Account Form Modal

#### 3.1 Add provider connection section to AccountFormModal

- [x] In `frontend/src/components/accounts/AccountFormModal.tsx`, use `watch('type')` from react-hook-form to observe the account type field
- [x] When type is `INVESTMENT` and in **edit mode** (account prop exists):
  - [x] Use `useInvestmentProviderConnection(account.id)` to get provider state
  - [x] If connected: show a read-only section with provider info (Trading 212, connected since date) and a "Disconnect" button
  - [x] If not connected: show the `ConnectProviderForm` component inline
- [x] When type is `INVESTMENT` and in **create mode** (no account prop):
  - [x] Show an info callout: "You can connect a brokerage provider after creating the account."
- [x] Add a visual separator (Separator component) before the brokerage section

#### 3.2 Verify

- [x] TypeScript compiles cleanly

---

### Phase 4: Cleanup and Polish

#### 4.1 Remove unused components

- [x] Deleted `frontend/src/components/accounts/InvestmentProviderCard.tsx`
- [x] Deleted `frontend/src/components/accounts/PortfolioSyncSection.tsx`

#### 4.2 Final verification

- [x] All TypeScript compiles cleanly with no errors
- [ ] Frontend testing checklist completed (see `.agents/testing/testing-front-end.md`)
- [x] All three user-reported issues are resolved:
  1. Account Detail page is clean — no separate broker/sync cards
  2. Account Edit modal has provider connection section
  3. Portfolio Sync job detail page loads correctly
