# Hide Split Option for Income Transactions — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#53](https://github.com/abhijeet-reddy/master-of-coin/issues/53)

---

## Backend Implementation

### Phase 1: Model Validation — Create

- [x] In `backend/src/models/transaction.rs`, update `validate_transaction_request` to reject splits on income (positive amount):
  - Before the existing split validation block, added a check: if `req.splits` is `Some`, non-empty, and `req.amount > 0.0`, return a `ValidationError` with code `"splits_on_income"` and message `"Splits are not allowed on income transactions"`
- [x] Verify `cargo clippy` passes with no warnings
- [x] Verify `cargo fmt` produces no changes

### Phase 2: Service Validation — Update

- [x] In `backend/src/services/transaction_service.rs`, in the `update_transaction` function, added validation after ownership checks:
  - Determines the effective amount: uses `request.amount` if provided, otherwise parses the existing transaction's BigDecimal amount
  - If splits are provided (`request.splits.is_some()`) and the effective amount is positive, returns `ApiError::Validation("Splits are not allowed on income transactions")`
- [x] Verify `cargo clippy` passes with no warnings
- [x] Verify `cargo fmt` produces no changes

### Phase 3: Backend Integration Tests

- [x] In `backend/tests/integration/api/test_transactions.rs`, added test: `test_create_income_transaction_with_splits_rejected`
  - Creates a person, then attempts to create a transaction with positive amount and splits → asserts 422 response
- [x] In `backend/tests/integration/api/test_transactions.rs`, added test: `test_update_to_income_with_splits_rejected`
  - Creates an expense transaction with splits, then attempts to update the amount to positive with splits → asserts 422 response
- [x] Verify tests compile: `cargo test --test integration_api --no-run`

---

## Frontend Implementation

### Phase 4: New Hook — `useTransactionSplitState`

- [x] Created `frontend/src/hooks/usecase/useTransactionSplitState.ts`:
  - Accepts props: `transactionType`, `payerMode`, `isDebtTransaction`
  - Manages `isSplitEnabled` and `splits` state (2 useState)
  - Derives `canSplit`: `transactionType === 'expense' && payerMode === 'self' && !isDebtTransaction`
  - Implements `toggleSplit()`: toggles `isSplitEnabled`, clears splits when disabling
  - Implements `clearSplits()`: sets `isSplitEnabled` to false and `splits` to empty array
  - Implements `setSplits()`: updates splits array
  - Implements `initFromTransaction()`: initializes from existing transaction data
  - `useEffect` on `canSplit`: when it becomes false, auto-clears splits
- [x] Exported from `frontend/src/hooks/usecase/index.ts`

### Phase 5: Integrate Hook into TransactionFormModal

- [x] In `frontend/src/components/transactions/TransactionFormModal.tsx`:
  - Added `const transactionType = watch('transaction_type');` alongside existing watches
  - Replaced `useState` for `isSplitEnabled` and `splits` with `useTransactionSplitState` hook
  - Replaced `handleSplitToggle` with `toggleSplit` from the hook
  - Updated `handlePayerModeChange` to use `clearSplits()` from hook
  - Updated the split toggle render condition from `payerMode === 'self'` to `canSplit`
  - Updated the split form render condition from `isSplitEnabled && payerMode === 'self'` to `isSplitEnabled && canSplit`
  - Removed the now-unused inline `handleSplitToggle` function
  - Removed unused `TransactionSplitRequest` import (now managed by hook)
- [x] TypeScript compiles cleanly: `cd frontend && npx tsc --noEmit`

### Phase 6: E2E Tests

- [x] Created `e2e/tests/transactions/split-income.spec.ts` with 4 tests:
  - `split toggle is hidden when transaction type is income`
  - `split toggle is visible when transaction type is expense`
  - `switching from expense to income clears split state`
  - `switching back to expense restores split toggle`
- [x] Run E2E tests: `cd e2e && npx playwright test tests/transactions/split-income.spec.ts`
- [x] Capture screenshots for visual verification

### Phase 7: Frontend Manual Testing

- [x] Docker stack rebuilt and running
- [x] Smoke tests pass: `cd e2e && npx playwright test tests/smoke/`
- [x] Existing transaction E2E tests pass: `cd e2e && npx playwright test tests/transactions/`
- [x] Screenshots captured and visually verified
- [x] No console errors in test output
