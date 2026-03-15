# Investment Portfolio Sync UI — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#50](https://github.com/abhijeet-reddy/master-of-coin/issues/50)

---

## Frontend Implementation

### Phase 1: Types & Service

#### 1.1 Create investment provider types

- [ ] Create `frontend/src/types/investmentProvider.ts`
  - `InvestmentProviderType` enum with `TRADING_212`
  - `InvestmentProvider` interface (id, user_id, account_id, provider_type, is_active, created_at, updated_at)
  - `ConnectInvestmentProviderRequest` interface (account_id, provider_type, api_key, api_secret, environment?)
  - `PortfolioSyncRequest` interface (account_id?)
  - `StartPortfolioSyncResponse` interface (job_id, status, message)
  - `PortfolioSyncJobResponse` interface (job_id, status, created_at, started_at?, completed_at?, result?, error?)
  - `PortfolioSyncReport` interface (synced_accounts, total_synced, total_failed)
  - `AccountSyncResult` interface (account_id, account_name, provider_type, previous_balance, new_value, adjustment_amount, adjustment_transaction_id?, status, error?)

#### 1.2 Update existing types

- [ ] Add `PORTFOLIO_SYNC = 'PORTFOLIO_SYNC'` to `JobType` enum in `frontend/src/types/jobs.ts`
- [ ] Add `export * from './investmentProvider'` to `frontend/src/types/index.ts`

#### 1.3 Create API service

- [ ] Create `frontend/src/services/investmentProviderService.ts`
  - `connectProvider(request)` → `POST /investment-providers`
  - `listProviders()` → `GET /investment-providers`
  - `disconnectProvider(id)` → `DELETE /investment-providers/:id`
  - `startPortfolioSync(request)` → `POST /portfolio-sync`
  - `getPortfolioSyncJob(jobId)` → `GET /portfolio-sync/:jobId`
  - `retryPortfolioSync(jobId)` → `POST /portfolio-sync/:jobId/retry`

### Phase 2: Hooks

#### 2.1 Create API hooks

- [ ] Create `frontend/src/hooks/api/useInvestmentProviders.ts`
  - `useInvestmentProviders()` — useQuery with key `['investment-providers']`
  - `useConnectInvestmentProvider()` — useMutation, invalidates `['investment-providers']`
  - `useDisconnectInvestmentProvider()` — useMutation, invalidates `['investment-providers']`
- [ ] Create `frontend/src/hooks/api/usePortfolioSync.ts`
  - `useStartPortfolioSync()` — useMutation
  - `usePortfolioSyncJob(jobId, enabled)` — useQuery with polling (refetchInterval while PENDING/RUNNING)
  - `useRetryPortfolioSync()` — useMutation
- [ ] Export new hooks from `frontend/src/hooks/api/index.ts`
- [ ] Export new hooks from `frontend/src/hooks/index.ts`

#### 2.2 Create usecase hooks

- [ ] Create `frontend/src/hooks/usecase/useInvestmentProviderConnection.ts`
  - Takes `accountId` parameter
  - Manages form open/close state, disconnect dialog state (max 2 useState)
  - `handleConnect(apiKey, apiSecret, environment?)` — calls connect mutation, shows toast
  - `handleDisconnect()` — calls disconnect mutation, shows toast
  - Returns: `{ provider, isConnected, isConnecting, isFormOpen, setFormOpen, handleConnect, handleDisconnect, isDisconnecting }`
- [ ] Create `frontend/src/hooks/usecase/usePortfolioSyncTrigger.ts`
  - Takes `accountId` parameter
  - Manages sync job lifecycle: trigger → poll → display result (max 1 useState for jobId)
  - `handleSync()` — calls start mutation, stores jobId, begins polling
  - `handleRetry()` — calls retry mutation
  - Returns: `{ syncJob, isSyncing, handleSync, handleRetry }`
- [ ] Export new hooks from `frontend/src/hooks/usecase/index.ts`

### Phase 3: Components

#### 3.1 Create investment provider components

- [ ] Create `frontend/src/components/accounts/ConnectProviderForm.tsx`
  - Props: `{ onSubmit, isLoading, onCancel }` (3 props — within limit)
  - Form with API Key input, API Secret input (password type), Environment select (Live/Demo)
  - Uses Chakra UI Field, Input, Button, NativeSelect
  - Max 2 useState (form data object + environment)

- [ ] Create `frontend/src/components/accounts/InvestmentProviderCard.tsx`
  - Props: `{ accountId }` (1 prop — within limit)
  - Uses `useInvestmentProviderConnection(accountId)` hook internally
  - When not connected: shows "Connect Brokerage" button → opens ConnectProviderForm in Dialog
  - When connected: shows provider status card with disconnect button → ConfirmDialog
  - Max 0 useState (all state in hook)

- [ ] Create `frontend/src/components/accounts/PortfolioSyncSection.tsx`
  - Props: `{ accountId }` (1 prop — within limit)
  - Uses `usePortfolioSyncTrigger(accountId)` hook internally
  - Shows "Sync Portfolio" button
  - When syncing: shows spinner with status
  - When completed: shows previous balance, new value, adjustment amount
  - When failed: shows error with retry button
  - Max 0 useState (all state in hook)

- [ ] Export new components from `frontend/src/components/accounts/index.ts`

### Phase 4: Page Integration & Existing Component Updates

#### 4.1 Update Account Detail page

- [ ] Modify `frontend/src/pages/AccountDetail.tsx`
  - Import `InvestmentProviderCard` and `PortfolioSyncSection`
  - After `AccountInfoCard`, conditionally render for INVESTMENT accounts:
    ```tsx
    {
      account.account_type === "INVESTMENT" && (
        <>
          <InvestmentProviderCard accountId={account.id} />
          <PortfolioSyncSection accountId={account.id} />
        </>
      );
    }
    ```

#### 4.2 Update Jobs page components

- [ ] Update `frontend/src/pages/Jobs.tsx` — add `{ label: 'Portfolio Sync', value: JobType.PORTFOLIO_SYNC }` to filter options
- [ ] Update `frontend/src/components/jobs/JobTypeBadge.tsx` — add `[JobType.PORTFOLIO_SYNC]: { label: 'Portfolio Sync', colorPalette: 'green' }`
- [ ] Update `frontend/src/components/jobs/JobHistoryList.tsx` — add `[JobType.PORTFOLIO_SYNC]: 'portfolio-sync'` to route mapping and summary formatter

#### 4.3 Update Schedules page components

- [ ] Update `frontend/src/components/schedules/ScheduleFormModal.tsx` — add `PORTFOLIO_SYNC` to job type dropdown options
- [ ] Update `frontend/src/components/schedules/ScheduleCard.tsx` — add `PORTFOLIO_SYNC: { label: 'Portfolio Sync', colorPalette: 'green' }`
- [ ] Update `frontend/src/pages/ScheduleDetail.tsx` — add `PORTFOLIO_SYNC: 'Portfolio Sync'` to job type labels

### Phase 5: Testing

- [ ] TypeScript compiles cleanly (`npm run build`)
- [ ] Test in browser: navigate to an INVESTMENT account detail page
- [ ] Test connect provider flow (will fail with real credentials but form should work)
- [ ] Test disconnect provider flow
- [ ] Test portfolio sync trigger
- [ ] Verify PORTFOLIO_SYNC appears in Jobs page filter
- [ ] Verify PORTFOLIO_SYNC appears in Schedule creation form
- [ ] Frontend testing checklist completed (see .agents/testing/testing-front-end.md)
