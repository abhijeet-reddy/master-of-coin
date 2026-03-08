# Fix Budget Spending Split Calculation — Implementation

**Design**: [design.md](./design.md)

---

## Backend Implementation

### Phase 1: New Repository Function

#### 1.1 Add `CurrencySpending` struct

- [x] In `backend/src/repositories/budget.rs`, add a `CurrencySpending` struct with fields `currency: CurrencyCode` and `total_user_spending: BigDecimal`
- [x] Implement `QueryableByName` for the struct (needed for `diesel::sql_query`)

#### 1.2 Add `calculate_spending_by_currency` function

- [x] In `backend/src/repositories/budget.rs`, add a new async function `calculate_spending_by_currency(pool, user_id, category_id, account_id, start_date, end_date) -> Result<Vec<CurrencySpending>, ApiError>`
- [x] Implement the SQL query using `diesel::sql_query` with the correlated subquery pattern
- [x] Bind the filter parameters (user_id, category_id, start_date, end_date, account_id) using `.bind::<>()` calls

### Phase 2: Update Budget Service

#### 2.1 Refactor `get_budget()` spending calculation

- [x] In `backend/src/services/budget_service.rs`, replace the spending loop in `get_budget()` with a call to `repositories::budget::calculate_spending_by_currency()`
- [x] Loop over the returned `Vec<CurrencySpending>` and convert each currency total to primary currency using `ExchangeRateService`
- [x] Sum the converted totals into `current_spending`
- [x] Remove the now-unused `repositories::transaction::list_transactions` call and the per-transaction account lookup

#### 2.2 Refactor `calculate_budget_status()` spending calculation

- [x] In the same file, replace the spending loop in `calculate_budget_status()` with the same pattern as 2.1
- [x] Ensure both functions use the identical approach for consistency

### Phase 3: Add Debt Transaction Test

#### 3.1 Write debt transaction + budget test

- [x] In `backend/tests/integration/api/test_budget_spending.rs`, add `test_budget_spending_with_debt_transaction`:
  - Create a budget with a category filter
  - Create a debt transaction (via `POST /api/v1/debt-transactions`) with the same category
  - Create a regular split transaction with the same category
  - Verify the budget's `current_spending` includes the debt transaction's full amount (€30) + regular user share (€12) = €42
  - Verify the negative split is NOT subtracted

### Phase 4: Verify Tests

#### 4.1 Run budget spending tests

- [x] Run `cd backend && cargo test --test integration_api test_budget_spending -- --nocapture`
- [x] Verify `test_budget_spending_accounts_for_splits` PASSES ✅
- [x] Verify `test_budget_spending_mixed_splits` PASSES ✅
- [x] Verify `test_budget_spending_without_splits` PASSES ✅
- [x] Verify `test_budget_spending_with_debt_transaction` PASSES ✅
- [x] Verify `test_budget_detail_shows_matching_transactions` PASSES ✅
- [x] Verify `test_budget_transactions_include_split_data` PASSES ✅

#### 4.2 Run all budget tests (regression)

- [x] Run `cd backend && cargo test --test integration_api test_budget`
- [x] Verify all 36 budget tests pass (30 existing + 6 new)

#### 4.3 Run full test suite

- [x] Run `cd backend && cargo test --test integration_api --test integration_database --lib`
- [x] Verify all 66 tests pass with no regressions
- [x] Note: 2 pre-existing doctest failures in `superjson.rs` are unrelated to this change
