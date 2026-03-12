# Add Transaction Button on Account Detail — Design

**Requirements**: [requirements.md](./requirements.md)
**GitHub Issue**: [#49](https://github.com/abhijeet-reddy/master-of-coin/issues/49)
**Date**: 2026-03-11

## 1. Overview

Frontend-only change. Add an "Add Transaction" button to the Account Detail page header actions, and open the `TransactionFormModal` with the account pre-selected via a new `defaultAccountId` prop.

## 2. Database Changes

None.

## 3. API Changes

None.

## 4. Frontend Changes

### 4.1 Modified Components

#### `TransactionFormModal` in [`frontend/src/components/transactions/TransactionFormModal.tsx`](frontend/src/components/transactions/TransactionFormModal.tsx)

Add an optional `defaultAccountId?: string` prop. In the form reset `useEffect`, when creating a new transaction (no `transaction` prop), set `account_id` to `defaultAccountId` if provided.

#### `AccountDetailPage` in [`frontend/src/pages/AccountDetail.tsx`](frontend/src/pages/AccountDetail.tsx)

- Add an "Add Transaction" button (FiPlus icon) to the header actions alongside the existing filter toggle
- Add a `TransactionFormModal` with `defaultAccountId={account.id}`
- Fetch categories, people, and create/debt mutations needed by the form
- Handle form submission (create transaction, create debt transaction)

### 4.2 New Hooks/Services

None needed — reuse existing `useCategories`, `usePeople`, `useCreateTransaction`, `useCreateDebtTransaction` hooks.

## 5. Error Handling

Standard form error handling already exists in `TransactionFormModal`.

## 6. Testing Strategy

### E2E Tests

- New test: open Account Detail, click "Add Transaction", verify the account is pre-selected in the form dropdown.
