# Person Transaction View — Implementation

**Design**: [design.md](./design.md)

---

## Backend Implementation

### Phase 1: Add person_id Filter to Transaction Query

#### 1.1 Update TransactionFilter Model

- [x] Add `person_id: Option<Uuid>` field to `TransactionFilter` struct in `backend/src/models/transaction.rs`

#### 1.2 Update Repository Query Logic

- [x] In `backend/src/repositories/transaction.rs` → `list_transactions()`, add filter logic:
  - When `person_id` is `Some`, use a subquery on `transaction_splits` to find matching `transaction_id` values
  - Apply `query = query.filter(transactions::id.eq_any(split_txn_ids))`
  - Import `transaction_splits` schema if not already imported

#### 1.3 Verify Backend Compiles

- [x] Run `cargo check` to verify the backend compiles cleanly with the new filter

---

## Frontend Implementation

### Phase 2: Types & Service Updates

#### 2.1 Update QueryParams Type

- [x] Add `person_id?: string` to `QueryParams` interface in `frontend/src/types/api.ts`

#### 2.2 Update NavigationSourceType

- [x] Add `PERSON = 'PERSON'` to `NavigationSourceType` enum in `frontend/src/types/navigation.ts`

### Phase 3: Hooks

#### 3.1 Create usePersonDetail Hook

- [x] Create `frontend/src/hooks/usecase/usePersonDetail.ts` following the pattern from `useCategoryDetail.ts`:
  - Use `usePerson(id)` for person data
  - Use `useTransactions({ person_id: id })` for paginated transactions filtered by person
  - Use `useEnrichedTransactions()` for enrichment
  - Manage filter state (`TransactionFilterValues`)
  - Include `useDeletePerson()` mutation
  - Include `useAccounts()` and `useCategories()` for filter dropdowns
  - Apply client-side filters (account, type, date range, amount, paid-by-others)
  - Return: person, isLoading, error, filteredTransactions, isTransactionsLoading, fetchNextPage, hasNextPage, isFetchingNextPage, filters, setFilters, showFilters, toggleFilters, clearFilters, accounts, categories, deleteMutation

#### 3.2 Export usePersonDetail

- [x] Add `usePersonDetail` export to `frontend/src/hooks/usecase/index.ts`
- [x] Add `usePersonDetail` export to `frontend/src/hooks/index.ts` if needed

### Phase 4: Components

#### 4.1 Create PersonInfoCard Component

- [x] Create `frontend/src/components/people/PersonInfoCard.tsx`:
  - Display person name, email, phone, notes
  - Display debt summary (owes me / I owe / net balance) using `formatCurrency`
  - Edit button → calls `onEdit` prop
  - Delete button → calls `onDelete` prop
  - Settle Up button → calls `onSettle` prop (shown only when debt != 0)
  - Transaction count display
  - Follow the pattern of `CategoryInfoCard` / `AccountInfoCard`

#### 4.2 Export PersonInfoCard

- [x] Add `PersonInfoCard` export to `frontend/src/components/people/index.ts`

### Phase 5: Person Detail Page

#### 5.1 Create PersonDetail Page

- [x] Create `frontend/src/pages/PersonDetail.tsx` following `CategoryDetailPage` pattern:
  - Use `useParams` to get person ID from URL
  - Use `usePersonDetail(id)` hook for all data and state
  - Render `PageHeader` with breadcrumbs: People → Person Name
  - Render filter toggle button in header actions
  - Render `PersonInfoCard` with edit/delete/settle handlers
  - Render `PersonFormModal` for editing
  - Render `SettleDebtModal` for settling debts
  - Render `TransactionFilters` when filters are shown
  - Render `TransactionList` with enriched transactions, infinite scroll, and navigation state
  - Render `ConfirmDialog` for delete confirmation
  - Handle loading, error, and not-found states
  - Use `useDocumentTitle` for page title
  - Navigate to `/people` on successful delete

#### 5.2 Add Route

- [x] Add `import { PersonDetailPage } from '@/pages/PersonDetail'` to `frontend/src/App.tsx`
- [x] Add route `<Route path="people/:id" element={<PersonDetailPage />} />` after the `people` route

### Phase 6: Update PersonCard Navigation

#### 6.1 Make PersonCard Navigable

- [x] Update `frontend/src/components/people/PersonCard.tsx`:
  - Add `useNavigate` from react-router-dom
  - Make the person name or card clickable to navigate to `/people/${person.id}`
  - Replace the "View detailed transaction history" placeholder text with a link/button to the detail page
  - Keep existing edit/delete/settle action buttons

### Phase 7: Verification

- [x] TypeScript compiles cleanly (`npx tsc --noEmit` in frontend)
- [x] Backend compiles cleanly (`cargo check`)
- [ ] Frontend testing checklist completed (see .agents/testing/testing-front-end.md)
