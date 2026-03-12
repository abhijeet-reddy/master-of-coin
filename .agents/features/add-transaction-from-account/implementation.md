# Add Transaction Button on Account Detail — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#49](https://github.com/abhijeet-reddy/master-of-coin/issues/49)

---

## Frontend Implementation

### Phase 1: Add `defaultAccountId` prop to TransactionFormModal

- [x] In `frontend/src/components/transactions/TransactionFormModal.tsx`:
  - Added `defaultAccountId?: string` to `TransactionFormModalProps`
  - Destructured `defaultAccountId` in the component
  - In the form reset for new transactions, set `account_id` default to `defaultAccountId || ''`
- [x] TypeScript compiles cleanly

### Phase 2: Add button and modal to AccountDetailPage

- [x] In `frontend/src/pages/AccountDetail.tsx`:
  - Imported `TransactionFormModal`, `useDisclosure`, `useAccounts`, `usePeople`, `useCreateTransaction`, `useCreateDebtTransaction`, `FiPlus`
  - Added disclosure state for the transaction modal
  - Added "Add Transaction" button (FiPlus icon + text) to the header actions HStack
  - Added `TransactionFormModal` with `defaultAccountId={account.id}`
  - Implemented `handleCreateSubmit` and `handleDebtSubmit` using the create mutations
- [x] TypeScript compiles cleanly

### Phase 3: E2E Tests

- [x] Created `e2e/tests/accounts/add-transaction-from-account.spec.ts`:
  - `Add Transaction button is visible on account detail page`
  - `clicking Add Transaction opens form with account pre-selected`
- [x] Run E2E tests: 28/28 passed
- [x] No regressions in smoke or accounts tests

### Phase 4: Commit and Push

- [x] Committed and pushed
