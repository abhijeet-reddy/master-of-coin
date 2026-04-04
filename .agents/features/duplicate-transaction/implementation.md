# Duplicate Transaction — Implementation

**Design**: [design.md](./design.md)

---

## Frontend Implementation

### Phase 1: Types & Utility

- [x] Add `TransactionFormDefaultValues` interface to [`frontend/src/types/models.ts`](frontend/src/types/models.ts)
- [x] Export `TransactionFormDefaultValues` from [`frontend/src/types/index.ts`](frontend/src/types/index.ts) (auto-exported via `export * from './models'`)
- [x] Create [`frontend/src/utils/transactionDuplicate.ts`](frontend/src/utils/transactionDuplicate.ts) with `buildDuplicateDefaults(transaction: EnrichedTransaction): TransactionFormDefaultValues` utility function

### Phase 2: Core Component Changes

#### 2.1 TransactionFormModal — Accept `defaultValues` prop

- [x] Add optional `defaultValues?: TransactionFormDefaultValues` prop to `TransactionFormModalProps` in [`TransactionFormModal.tsx`](frontend/src/components/transactions/TransactionFormModal.tsx)
- [x] Update the `useEffect` that resets the form on open: when `!transaction && defaultValues`, use `defaultValues` to populate the form fields (title, amount, transaction_type, account_id, category_id, notes, payer_mode, payer_person_id, payer_currency) with date/time set to now
- [x] Verify the modal title still shows "Add Transaction" (not "Edit") when `defaultValues` is provided without `transaction`

#### 2.2 TransactionRow — Add duplicate button

- [x] Add `onDuplicate?: (transaction: EnrichedTransaction) => void` prop to `TransactionRowProps` in [`TransactionRow.tsx`](frontend/src/components/transactions/TransactionRow.tsx)
- [x] Add a copy icon button (using `FiCopy` from `react-icons/fi`) next to the existing delete button
- [x] Only render the duplicate button when `onDuplicate` is provided AND the transaction is NOT a transfer (`!transaction.transfer_info`)
- [x] Wire the button's `onClick` to call `onDuplicate(transaction)` with `e.stopPropagation()` to prevent row navigation

#### 2.3 TransactionList — Thread `onTransactionDuplicate`

- [x] Add `onTransactionDuplicate?: (transaction: EnrichedTransaction) => void` prop to `TransactionListProps` in [`TransactionList.tsx`](frontend/src/components/transactions/TransactionList.tsx)
- [x] Pass `onDuplicate={onTransactionDuplicate}` to each `TransactionRow`

#### 2.4 TransactionActions — Add duplicate button on detail page

- [x] Add `onDuplicate?: () => void` prop to `TransactionActionsProps` in [`TransactionActions.tsx`](frontend/src/components/transactions/detail/TransactionActions.tsx)
- [x] Render a "Duplicate" button (with `FiCopy` icon) between Edit and Delete buttons, only when `onDuplicate` is provided

### Phase 3: Page Integration — Pages with existing TransactionFormModal

#### 3.1 Transactions Page

- [x] Add `duplicateTransaction` state: `useState<EnrichedTransaction | null>(null)` in [`Transactions.tsx`](frontend/src/pages/Transactions.tsx)
- [x] Add `handleDuplicateTransaction` callback that sets `duplicateTransaction` state and opens the modal
- [x] Pass `onTransactionDuplicate={handleDuplicateTransaction}` to `TransactionList`
- [x] Compute `defaultValues` using `buildDuplicateDefaults()` when `duplicateTransaction` is set
- [x] Pass `defaultValues` to `TransactionFormModal`
- [x] Clear `duplicateTransaction` state in `handleModalClose`

#### 3.2 Account Detail Page

- [x] Add `duplicateTransaction` state in [`AccountDetail.tsx`](frontend/src/pages/AccountDetail.tsx)
- [x] Add `handleDuplicateTransaction` callback
- [x] Pass `onTransactionDuplicate={handleDuplicateTransaction}` to `TransactionList`
- [x] Compute and pass `defaultValues` to the existing `TransactionFormModal`
- [x] Clear `duplicateTransaction` on modal close

#### 3.3 Transaction Detail Page

- [x] Import `buildDuplicateDefaults` in [`TransactionDetail.tsx`](frontend/src/pages/TransactionDetail.tsx)
- [x] Add `useDisclosure` for a duplicate modal and create/debt mutations
- [x] Add `handleDuplicate` callback that opens the duplicate modal
- [x] Pass `onDuplicate={handleDuplicate}` to `TransactionActions` (hide for transfer transactions)
- [x] Add a second `TransactionFormModal` instance for duplicate (in create mode with `defaultValues`)
- [x] Wire up `onSubmit` and `onSubmitDebt` to the create mutations

### Phase 4: Page Integration — Pages needing new TransactionFormModal

#### 4.1 Category Detail Page

- [x] Import `TransactionFormModal`, `useAccounts`, `useCategories`, `usePeople`, `useCreateTransaction`, `useCreateDebtTransaction`, `useDisclosure`, and `buildDuplicateDefaults` in [`CategoryDetail.tsx`](frontend/src/pages/CategoryDetail.tsx)
- [x] Add `duplicateTransaction` state and disclosure for the modal
- [x] Add `handleDuplicateTransaction` and `handleDuplicateSubmit` / `handleDuplicateDebtSubmit` callbacks
- [x] Pass `onTransactionDuplicate` to `TransactionList`
- [x] Add `TransactionFormModal` instance with `defaultValues`

#### 4.2 Person Detail Page

- [x] Import `TransactionFormModal`, `useAccounts`, `useCategories`, `usePeople`, `useCreateTransaction`, `useCreateDebtTransaction`, `useDisclosure`, and `buildDuplicateDefaults` in [`PersonDetail.tsx`](frontend/src/pages/PersonDetail.tsx)
- [x] Add `duplicateTransaction` state and disclosure for the modal
- [x] Add `handleDuplicateTransaction` and `handleDuplicateSubmit` / `handleDuplicateDebtSubmit` callbacks
- [x] Pass `onTransactionDuplicate` to `TransactionList`
- [x] Add `TransactionFormModal` instance with `defaultValues`

#### 4.3 Budget Detail Page

- [x] Import `TransactionFormModal`, `useAccounts`, `usePeople`, `useCreateTransaction`, `useCreateDebtTransaction`, `useDisclosure`, and `buildDuplicateDefaults` in [`BudgetDetail.tsx`](frontend/src/pages/BudgetDetail.tsx)
- [x] Add `duplicateTransaction` state and disclosure for the modal
- [x] Add `handleDuplicateTransaction` and `handleDuplicateSubmit` / `handleDuplicateDebtSubmit` callbacks
- [x] Pass `onTransactionDuplicate` to `TransactionList`
- [x] Add `TransactionFormModal` instance with `defaultValues`

### Phase 5: Exports & Cleanup

- [x] `TransactionFormDefaultValues` type auto-exported via `export * from './models'` in [`frontend/src/types/index.ts`](frontend/src/types/index.ts)
- [x] TypeScript compiles cleanly (`npx tsc --noEmit` — exit code 0)
- [x] ESLint passes (`npx eslint` — 0 errors, 1 pre-existing warning)

### Phase 6: Testing

- [x] E2E test created: [`e2e/tests/transactions/duplicate-transaction.spec.ts`](e2e/tests/transactions/duplicate-transaction.spec.ts)
  - [x] Duplicate button visible on transaction rows
  - [x] Clicking duplicate opens modal in create mode with pre-filled data
  - [x] Date defaults to today
  - [x] Modal can be closed without creating
  - [x] Duplicate button NOT visible on Trash page
  - [x] Duplicate button visible on Transaction Detail page
  - [x] Duplicate from detail page opens modal with pre-filled data
- [x] E2E test compiles cleanly (`npx tsc --noEmit` — exit code 0)
- [ ] Manual testing: Duplicate from Transactions page — verify pre-fill and create
- [ ] Manual testing: Duplicate from Account Detail page
- [ ] Manual testing: Duplicate from Category Detail page
- [ ] Manual testing: Duplicate from Person Detail page
- [ ] Manual testing: Duplicate from Budget Detail page
- [ ] Manual testing: Duplicate from Transaction Detail page
- [ ] Manual testing: Verify transfer transactions do NOT show duplicate button
- [ ] Manual testing: Verify Trash page does NOT show duplicate button
- [ ] Manual testing: Verify debt transaction duplicate pre-fills payer mode
- [ ] Manual testing: Verify date/time defaults to now, not source date
- [ ] Frontend testing checklist completed (see .agents/testing/testing-front-end.md)
