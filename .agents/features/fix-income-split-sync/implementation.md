# Fix Income Split Sync — Implementation

**Design**: [design.md](./design.md)
**Requirements**: [requirements.md](./requirements.md)

---

## Cleanup

- [x] Delete `docs/features/split-provider-integration/transaction-types-and-splits.md`

## Backend Implementation

### Phase 1: Add Income Expense User Builder

- [x] In `split_sync_service.rs`, add `build_income_expense_users()` method that treats the split person as the Splitwise payer:
  - Friend: `paid_share = |tx amount|`, `owed_share = 0`
  - Current user: `paid_share = 0`, `owed_share = |tx amount|`
  - This mirrors `build_debt_expense_users()` logic (delegates to it)

### Phase 2: Fix Expense Creation/Update for Income Transactions

- [x] In `sync_splits_group_with_retry_count()` (~line 323): add an `is_income` check (`transaction.amount > BigDecimal::from(0)`) for non-DEBT accounts, and call `build_income_expense_users()` instead of `build_expense_users()`
- [x] In `update_splits_group()` (~line 489): same change — add `is_income` branch to use `build_income_expense_users()`

### Phase 3: Fix Split Comparison for Income Transactions

- [x] In `compare_splits()`: for income transactions, the payer on Splitwise is the friend (not the current user). Added `is_income` branch:
  - For income: checks friend's `owed_share == 0` and current user's `owed_share == |tx amount|`
  - For expense: uses existing logic (unchanged)

### Phase 4: Fix Local Shares in Mismatch Response

- [x] In `sync_transaction()` normal flow: when building `local_shares` for income transactions, swapped the perspective:
  - Current user: `owed_share = |tx amount|` (I received the money)
  - Split person: `owed_share = 0` (they paid)

### Phase 5: Verify No Regression

- [x] Rust compiles cleanly with `cargo check` (no new warnings or errors)
- [x] Verify expense transactions (negative amount, regular account) still sync correctly
- [x] Verify DEBT account transactions still sync correctly
- [x] Verify income transactions with splits now sync without false mismatch
