# Fix Income Split Sync — Design

**Requirements**: [requirements.md](./requirements.md)
**Date**: 2026-04-12

## 1. Overview

The fix is entirely in the backend [`split_sync_service.rs`](../../backend/src/services/split_sync_service.rs). When a transaction on a regular account has a **positive amount** (income) and splits, the sync needs to treat the **split person as the Splitwise payer** instead of the current user.

Three areas need changes:

1. **Building expense users** for creating/updating Splitwise expenses
2. **Comparing splits** when checking if local and external data match
3. **Building local shares** for the mismatch response display

No database changes, no API changes, no frontend changes needed.

## 2. Architecture

### 2.1 Transaction Direction Detection

Add a simple check: if `transaction.amount > 0` (income) on a regular (non-DEBT) account, the split person is the payer on Splitwise.

```
Is DEBT account?
  → Yes: use build_debt_expense_users() [existing, works]
  → No: Is income (amount > 0)?
    → Yes: use build_income_expense_users() [NEW]
    → No: use build_expense_users() [existing, works]
```

### 2.2 How Income Splits Map to Splitwise

For an income transaction: I receive EUR 87.05, split with Ly for -87.05.

**Local data:**

- Transaction amount: +87.05
- Split: Ly = -87.05 (negative = reduces Ly's debt to me)

**Correct Splitwise representation:**

- cost: "87.05"
- Ly: paid_share = "87.05", owed_share = "0.00" (Ly paid)
- Me: paid_share = "0.00", owed_share = "87.05" (I "owe" the payment amount)

This is the same structure as `build_debt_expense_users()` — the friend is the payer.

## 3. Database Changes

None.

## 4. API Changes

None.

## 5. Backend Changes

### 5.1 New Function: `build_income_expense_users()`

In [`split_sync_service.rs`](../../backend/src/services/split_sync_service.rs), add a new method similar to `build_debt_expense_users()`:

```rust
fn build_income_expense_users(
    &self,
    transaction: &Transaction,
    splits: &[(TransactionSplit, PersonSplitConfig)],
    current_user_external_id: &str,
) -> ApiResult<Vec<ExpenseUser>>
```

Logic:

- The split person is the payer: `paid_share = |tx amount|`, `owed_share = 0`
- The current user owes: `paid_share = 0`, `owed_share = |tx amount|`

This is essentially the same as `build_debt_expense_users()`.

### 5.2 Modify `sync_splits_group_with_retry_count()`

Currently at [line 279](../../backend/src/services/split_sync_service.rs:279), the code checks `is_debt` to choose between `build_debt_expense_users()` and `build_expense_users()`. Add a third branch:

```
if is_debt {
    build_debt_expense_users()
} else if transaction.amount > 0 {
    build_income_expense_users()  // NEW
} else {
    build_expense_users()
}
```

Same change needed in `update_splits_group()` at [line 448](../../backend/src/services/split_sync_service.rs:448).

### 5.3 Modify `sync_transaction()` — Normal Flow

In the normal (non-debt) sync flow starting at [line 1094](../../backend/src/services/split_sync_service.rs:1094), the local shares are built assuming the current user is the payer. For income transactions, the local shares should show:

- Current user: `owed_share = |tx amount|`
- Split person: `owed_share = 0`

### 5.4 Modify `compare_splits()`

The [`compare_splits()`](../../backend/src/services/split_sync_service.rs:1566) method compares local splits against external expense users. For income transactions, the payer on Splitwise is the friend (not the current user), so the comparison logic needs to account for this:

- The split person's `owed_share` on Splitwise should be 0 (they paid)
- The current user's `owed_share` on Splitwise should be `|tx amount|`

## 6. Frontend Changes

None. The mismatch modal already displays whatever the backend sends. Once the backend sends correct local shares, the display will be correct.

## 7. Error Handling

No new error cases. The existing error handling in `build_expense_users()` and `build_debt_expense_users()` applies.

## 8. Testing Strategy

- Verify income + split transactions sync without false mismatch
- Verify expense + split transactions still work (regression)
- Verify DEBT account transactions still work (regression)
- Test via the app: create an income transaction with a split, sync it, confirm no mismatch
