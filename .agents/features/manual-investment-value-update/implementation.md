# Manual Investment Value Update — Implementation

**Design**: [design.md](./design.md)

---

## Backend Implementation

### Phase 1: Models & Exports

- [x] Add `SetBalanceRequest` struct to `backend/src/models/account.rs` with `balance: f64` field, with `Deserialize` and `Validate` derives
- [x] Export `SetBalanceRequest` from `backend/src/models/mod.rs`

### Phase 2: Service Layer

- [x] Add `set_balance` function to `backend/src/services/account_service.rs`:
  - Accepts `pool`, `account_id`, `user_id`, and `SetBalanceRequest`
  - Fetches account and verifies ownership
  - Validates account type is `INVESTMENT` (returns 400 otherwise)
  - Calculates current balance from transactions
  - Computes `adjustment = balance - current_balance`
  - If `adjustment != 0`, creates a "Balance Adjustment" transaction
  - Returns `AccountResponse` with updated balance

### Phase 3: Handler & Route

- [x] Add `set_balance` handler to `backend/src/handlers/accounts.rs`:
  - `PUT /accounts/:id/balance`
  - Extracts `Path(id)`, `Extension(auth_context)`, `Json(request)`
  - Calls `account_service::set_balance`
  - Returns `Json<AccountResponse>`
- [x] Register the route in `backend/src/api/routes.rs`:
  - Add `.route("/accounts/:id/balance", put(handlers::accounts::set_balance))` with `Accounts::Write` scope enforcement

### Phase 4: Backend Testing

- [ ] Add integration tests in `backend/tests/integration/api/test_accounts.rs`:
  - Test successful balance update for investment account
  - Test rejection for non-investment account types (400)
  - Test zero-adjustment case (no transaction created)
  - Test ownership verification (403)

---

## Frontend Implementation

### Phase 5: Service & Types

- [x] Add `updateAccountBalance(id: string, balance: number)` function to `frontend/src/services/accountService.ts`

### Phase 6: Hook

- [x] Create `frontend/src/hooks/api/useUpdateAccountBalance.ts`:
  - React Query mutation hook calling `updateAccountBalance`
  - On success: invalidate `['accounts']`, `['accounts', id]`, `['dashboard']`, and `['transactions']` queries
  - Show success/error toaster notifications
  - Export from hooks index

### Phase 7: UI Changes

- [x] Modify `frontend/src/components/accounts/AccountInfoCard.tsx`:
  - Add props: `isInvestment?: boolean`, `onUpdateValue?: (newBalance: number) => void`, `isUpdatingValue?: boolean`
  - When `isInvestment` is true, show a pencil icon next to the balance display
  - Clicking the pencil icon shows an inline input field pre-filled with current balance
  - Submit button calls `onUpdateValue` with the new balance
  - Cancel button or Escape key reverts to display mode
- [x] Modify `frontend/src/pages/AccountDetail.tsx`:
  - Import and use `useUpdateAccountBalance` hook
  - Conditionally hide the "Add Transaction" button and related modal when `isInvestment` is true
  - Pass `isInvestment`, `onUpdateValue`, and `isUpdatingValue` props to `AccountInfoCard`
  - Wire up the mutation: `onUpdateValue` calls `mutate({ id, balance })`

### Phase 8: Frontend Verification

- [x] TypeScript compiles cleanly (`tsc --noEmit`)
- [ ] Frontend testing checklist completed (see `.agents/testing/testing-front-end.md`)
