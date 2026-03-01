# Account Detail View — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#43](https://github.com/abhijeet-reddy/master-of-coin/issues/43)

---

## Frontend Implementation

### Phase 1: Types & Service Layer

- [x] Add `account_id?: string` to `QueryParams` in `frontend/src/types/api.ts`

### Phase 2: Custom Hook

- [x] Create `frontend/src/hooks/usecase/useAccountDetail.ts`
  - [x] Accept `id: string` parameter
  - [x] Use `useAccount(id)` to fetch account data
  - [x] Use `useTransactions({ account_id: id })` to fetch transactions with infinite scroll
  - [x] Use `useEnrichedTransactions` to enrich raw transactions
  - [x] Manage filter state (TransactionFilterValues)
  - [x] Manage showFilters toggle
  - [x] Manage delete mutation
  - [x] Return all data and handlers
- [x] Export `useAccountDetail` from `frontend/src/hooks/usecase/index.ts`

### Phase 3: New Components

- [x] Create `frontend/src/components/accounts/AccountInfoCard.tsx`
  - [x] Props: `account: Account`, `onEdit`, `onDelete`
  - [x] Display account icon based on type (using AccountType enum values)
  - [x] Display account name, type badge, currency
  - [x] Display balance with color coding (green positive, red negative)
  - [x] Display notes if present
  - [x] Edit and Delete action buttons
- [x] Export `AccountInfoCard` from `frontend/src/components/accounts/index.ts`

### Phase 4: Account Detail Page

- [x] Create `frontend/src/pages/AccountDetail.tsx`
  - [x] Use `useParams` to get account ID from URL
  - [x] Use `useAccountDetail(id)` hook for all data and state
  - [x] Render PageHeader with breadcrumbs: Accounts > Account Name
  - [x] Render AccountInfoCard
  - [x] Render filter toggle button
  - [x] Render TransactionFilters when showFilters is true
  - [x] Render TransactionList with infinite scroll props
  - [x] Render AccountFormModal for editing
  - [x] Render ConfirmDialog for deletion
  - [x] Handle loading, error, and not-found states
  - [x] Navigate back to /accounts after successful delete

### Phase 5: Routing & Navigation

- [x] Add route `accounts/:id` in `frontend/src/App.tsx` pointing to AccountDetailPage
- [x] Add `onClick` prop to `AccountCard` in `frontend/src/components/accounts/AccountCard.tsx`
  - [x] Make the card body clickable (cursor pointer, onClick handler)
  - [x] Keep edit/delete buttons with stopPropagation
- [x] Add `onAccountClick` prop to `AccountList` in `frontend/src/components/accounts/AccountList.tsx`
  - [x] Pass onClick to each AccountCard
- [x] Update `Accounts.tsx` page to navigate to `/accounts/${account.id}` on card click
- [x] Fix enum string literal eslint errors in AccountCard.tsx (use AccountType enum values)

### Phase 6: Testing & Polish

- [x] TypeScript compiles cleanly (`npx tsc --noEmit`)
- [ ] Frontend testing checklist completed (see `.agents/testing/testing-front-end.md`)
  - [ ] Navigate from Accounts page to Account Detail by clicking a card
  - [ ] Verify account info displays correctly (name, type, balance, currency, notes)
  - [ ] Verify transactions load and display with infinite scroll
  - [ ] Verify transaction filters work (category, type, date range, amount)
  - [ ] Verify edit account opens modal and saves changes
  - [ ] Verify delete account shows confirmation and navigates back
  - [ ] Verify breadcrumb navigation works
  - [ ] Verify loading and error states display correctly
  - [ ] Verify edit/delete buttons on AccountCard still work without navigating
