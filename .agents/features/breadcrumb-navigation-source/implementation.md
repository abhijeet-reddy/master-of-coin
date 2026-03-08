# Breadcrumb Navigation Source — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#52](https://github.com/abhijeet-reddy/master-of-coin/issues/52)

---

## Frontend Implementation

### Phase 1: Types

- [x] Create `frontend/src/types/navigation.ts` with `NavigationSourceType` enum and `TransactionNavigationState` interface
- [x] Export the new type from `frontend/src/types/index.ts`

### Phase 2: TransactionRow & TransactionList — Pass Navigation State

- [x] Add `navigationState?: TransactionNavigationState` prop to `TransactionRow` in `frontend/src/components/transactions/TransactionRow.tsx`
- [x] Update `handleClick` and `handleKeyDown` in `TransactionRow` to pass `{ state: navigationState }` to `navigate()`
- [x] Add `navigationState?: TransactionNavigationState` prop to `TransactionList` in `frontend/src/components/transactions/TransactionList.tsx`
- [x] Pass `navigationState` from `TransactionList` to each `TransactionRow`

### Phase 3: Source Pages — Provide Navigation State

- [x] Update `AccountDetailPage` (`frontend/src/pages/AccountDetail.tsx`) to pass `navigationState={{ from: { type: NavigationSourceType.ACCOUNT, id: account.id, name: account.name } }}` to `TransactionList`
- [x] Update `CategoryDetailPage` (`frontend/src/pages/CategoryDetail.tsx`) to pass `navigationState={{ from: { type: NavigationSourceType.CATEGORY, id: category.id, name: category.name } }}` to `TransactionList`
- [x] Update `BudgetDetailPage` (`frontend/src/pages/BudgetDetail.tsx`) to pass `navigationState={{ from: { type: NavigationSourceType.BUDGET, id: budget.id, name: budget.name } }}` to `TransactionList`
- [x] Verify `TransactionsPage` (`frontend/src/pages/Transactions.tsx`) — no `navigationState` needed (default breadcrumb applies)
- [x] Verify `RecentTransactions` (`frontend/src/components/dashboard/RecentTransactions.tsx`) — no changes needed (uses `<Link>` without state, default breadcrumb applies)

### Phase 4: TransactionDetailPage — Read State & Build Breadcrumbs

- [x] Import `useLocation` from `react-router-dom` in `TransactionDetailPage` (`frontend/src/pages/TransactionDetail.tsx`)
- [x] Read `location.state` and cast to `TransactionNavigationState | null`
- [x] Create `buildBreadcrumbs()` helper function that returns breadcrumb array based on navigation state
- [x] Create `getDeleteRedirect()` helper function that returns the correct redirect path
- [x] Replace all hardcoded breadcrumb arrays with calls to `buildBreadcrumbs()`
- [x] Update `handleConfirmDelete` to navigate to the source page instead of always `/transactions`

### Phase 5: Verification & Testing

- [x] TypeScript compiles cleanly (`tsc -b --noEmit`)
- [ ] Frontend testing checklist completed (see `.agents/testing/testing-front-end.md`)
  - [ ] Navigate from Account Detail → Transaction Detail: breadcrumb shows `Accounts > [Account Name] > [Transaction Title]`
  - [ ] Navigate from Transactions list → Transaction Detail: breadcrumb shows `Transactions > [Transaction Title]`
  - [ ] Navigate from Category Detail → Transaction Detail: breadcrumb shows `Categories > [Category Name] > [Transaction Title]`
  - [ ] Navigate from Budget Detail → Transaction Detail: breadcrumb shows `Budgets > [Budget Name] > [Transaction Title]`
  - [ ] Navigate from Dashboard → Transaction Detail: breadcrumb shows `Transactions > [Transaction Title]`
  - [ ] Direct URL access shows default breadcrumb
  - [ ] Clicking breadcrumb links navigates to correct source page
  - [ ] Delete from account-sourced transaction redirects back to account detail
