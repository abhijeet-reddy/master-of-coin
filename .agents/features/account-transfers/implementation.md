# Account-to-Account Transfers — Implementation

**Design**: [design.md](./design.md)

---

## Backend Implementation

### Phase 1: Database & Models

#### 1.1 Migration

- [x] Create migration directory `backend/migrations/2026-02-23-000000_create_transfers_table/`
- [x] Write `up.sql`: CREATE TABLE transfers with FKs, indexes, and unique constraint
- [x] Write `down.sql`: DROP TABLE transfers
- [x] Run `diesel migration run` and verify `backend/src/schema.rs` is updated with the `transfers` table
- [x] Add `transfers` to `diesel::allow_tables_to_appear_in_same_query!` and joinable macros in schema.rs (auto-generated)

#### 1.2 Models

- [x] Create `backend/src/models/transfer.rs` with:
  - `Transfer` struct (Queryable, Selectable, Identifiable)
  - `NewTransfer` struct (Insertable)
  - `CreateTransferRequest` struct (Deserialize, Validate) with from_account_id, to_account_id, from_amount, to_amount, exchange_rate, title, date, notes, category_id
  - `TransferResponse` struct (Serialize) with id, from_transaction, to_transaction, exchange_rate, created_at
  - `TransferInfo` struct (Serialize) with transfer_id, linked_account_id, linked_account_name — used in transaction listing
- [x] Register module in `backend/src/models/mod.rs`:
  - Add `pub mod transfer;`
  - Add re-exports: `Transfer`, `NewTransfer`, `CreateTransferRequest`, `TransferResponse`, `TransferInfo`

### Phase 2: Repository

#### 2.1 Transfer Repository

- [x] Create `backend/src/repositories/transfer.rs` with:
  - `create_transfer_atomic(pool, from_txn: NewTransaction, to_txn: NewTransaction, exchange_rate: BigDecimal) -> Result<(Transfer, Transaction, Transaction), ApiError>` — uses a single DB connection with `conn.transaction(|conn| { ... })` to atomically insert both transactions and the transfer link
  - `find_transfer_by_transaction_id(pool, transaction_id) -> Result<Option<Transfer>, ApiError>` — queries transfers table where from_transaction_id = id OR to_transaction_id = id
  - `find_transfer_by_id(pool, transfer_id) -> Result<Transfer, ApiError>`
  - `find_transfer_info_for_transactions(pool, transaction_ids: &[Uuid]) -> Result<HashMap<Uuid, TransferInfo>, ApiError>` — batch query to get transfer info for a list of transaction IDs (used in transaction listing). INNER JOINs transfers → transactions → accounts to get linked_account_name.
  - `delete_transfer_and_transactions(pool, transfer: &Transfer) -> Result<(), ApiError>` — deletes both transactions in a DB transaction (transfer row auto-cascades)
- [x] Register module in `backend/src/repositories/mod.rs`: add `pub mod transfer;`

### Phase 3: Service & Handler

#### 3.1 Transfer Service

- [ ] Create `backend/src/services/transfer_service.rs` with:
  - `create_transfer(pool, user_id, request: CreateTransferRequest) -> Result<TransferResponse, ApiError>`:
    1. Validate request (validator)
    2. Verify both accounts belong to user
    3. Verify from_account_id != to_account_id
    4. Fetch both accounts to get currencies
    5. Resolve amounts and exchange rate (same-currency vs cross-currency logic from design section 4.2)
    6. Build NewTransaction for from-side (negative amount, title defaults to "Transfer to {to_account.name}")
    7. Build NewTransaction for to-side (positive amount, title defaults to "Transfer from {from_account.name}")
    8. Build NewTransfer with exchange_rate
    9. Call repository `create_transfer_atomic`
    10. Build and return TransferResponse
- [ ] Register module in `backend/src/services/mod.rs`: add `pub mod transfer_service;`

#### 3.2 Transfer Handler

- [ ] Create `backend/src/handlers/transfers.rs` with:
  - `create(State, Extension<AuthContext>, Json<CreateTransferRequest>) -> Result<(StatusCode::CREATED, Json<TransferResponse>), ApiError>`
- [ ] Register module in `backend/src/handlers/mod.rs`: add `pub mod transfers;`

#### 3.3 Route Registration

- [ ] Add transfer route to `backend/src/api/routes.rs`:
  - `POST /transfers` → `handlers::transfers::create` with `Transactions:Write` scope

#### 3.4 Modify Transaction Delete (Cascading Transfer Delete)

- [ ] Modify `backend/src/services/transaction_service.rs` `delete_transaction()`:
  - After verifying ownership, check if transaction is part of a transfer via `repositories::transfer::find_transfer_by_transaction_id()`
  - If transfer found, identify the linked transaction ID (the other one)
  - Delete both transactions using `repositories::transfer::delete_transfer_and_transactions()`
  - If not a transfer, proceed with existing delete logic

#### 3.5 Modify Transaction Listing (Transfer Info)

- [x] Add `transfer_info: Option<TransferInfo>` field to `TransactionResponse` in `backend/src/models/transaction.rs`
- [x] Modify `backend/src/services/transaction_service.rs` `list_transactions()`:
  - After fetching transactions, collect all transaction IDs
  - Batch-fetch transfer info via `repositories::transfer::find_transfer_info_for_transactions()`
  - Populate `transfer_info` on each TransactionResponse that has a match
- [x] Modify `backend/src/services/transaction_service.rs` `get_transaction()`:
  - After fetching the transaction, check for transfer info and populate it

### Phase 4: Backend Testing

- [ ] Create `backend/tests/integration/api/test_transfers.rs` with tests:
  - `test_create_same_currency_transfer` — verify both transactions created with correct amounts and signs
  - `test_create_cross_currency_transfer_with_to_amount` — verify exchange rate computed correctly
  - `test_create_cross_currency_transfer_with_exchange_rate` — verify to_amount computed correctly
  - `test_create_transfer_same_account_fails` — verify 422 error
  - `test_create_transfer_wrong_ownership_fails` — verify 401 error
  - `test_create_cross_currency_transfer_missing_rate_fails` — verify 422 error
  - `test_delete_transaction_cascades_transfer` — delete one side, verify both transactions and transfer are gone
  - `test_list_transactions_includes_transfer_info` — verify transfer_info populated in listing
- [ ] Register test module in `backend/tests/integration/api/mod.rs`
- [ ] All tests passing

---

## Frontend Implementation

### Phase 5: Types & Services

- [x] Add `TransferInfo` interface to `frontend/src/types/models.ts`:
  - `transfer_id: string`, `linked_account_id: string`, `linked_account_name: string`
- [x] Add `transfer_info?: TransferInfo` to the existing `Transaction` interface in `frontend/src/types/models.ts`
- [x] Add `transfer_info?: TransferInfo` to the existing `EnrichedTransaction` interface in `frontend/src/types/models.ts`
- [x] Add `CreateTransferRequest` interface to `frontend/src/types/models.ts`
- [x] Add `TransferResponse` interface to `frontend/src/types/models.ts`
- [x] Create `frontend/src/services/transferService.ts` with:
  - `createTransfer(data: CreateTransferRequest): Promise<TransferResponse>`

### Phase 6: Transfer Form Modal

- [x] Create `frontend/src/components/transactions/TransferFormModal.tsx`:
  - From Account dropdown (filtered to user accounts, excludes DEBT accounts)
  - To Account dropdown (excludes selected from-account and DEBT accounts)
  - Amount field (from_amount, always positive)
  - Cross-currency section (shown when from/to accounts have different currencies):
    - To Amount field (editable)
    - Exchange Rate field (editable, auto-computed)
    - Bidirectional computation: changing to_amount recomputes rate, changing rate recomputes to_amount
  - Date picker and time picker
  - Optional title field (placeholder: "Transfer to {to_account_name}")
  - Optional notes textarea
  - Optional category dropdown
  - Zod validation schema
  - Submit calls `createTransfer()` and invalidates transaction queries
- [x] Export from `frontend/src/components/transactions/index.ts`

### Phase 7: Transaction Row & Page Integration

- [x] Modify `frontend/src/components/transactions/TransactionRow.tsx`:
  - When `transaction.transfer_info` is present, show a "Transfer" badge with an arrow icon (e.g., FiArrowRight or FiRepeat)
  - Show linked account name in the badge (e.g., "Transfer → Savings" or "Transfer ← Checking")
  - Use amount sign to determine direction: negative = outgoing arrow, positive = incoming arrow
- [x] Modify `frontend/src/pages/Transactions.tsx`:
  - Add a "Transfer" button next to the existing "Add Transaction" button
  - Add useDisclosure for transfer modal
  - Render `TransferFormModal` with accounts, categories data
  - On successful transfer creation, invalidate transaction queries to refresh the list
- [x] TypeScript compiles cleanly
- [ ] Frontend testing checklist completed (see .agents/testing/testing-front-end.md)
