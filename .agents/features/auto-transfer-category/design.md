# Auto-set Transfer Category — Design

**Requirements**: [requirements.md](./requirements.md)
**GitHub Issue**: [#51](https://github.com/abhijeet-reddy/master-of-coin/issues/51)
**Date**: 2026-03-11

## 1. Overview

A minimal frontend-only change. The `useTransferForm` hook will accept a `categories` prop and auto-set the `category_id` to the "Transfer" category when the form resets on modal open.

## 2. Architecture

No new components, hooks, services, or database changes needed. This is a single-line logic addition to an existing hook.

## 3. Database Changes

None.

## 4. API Changes

None.

## 5. Frontend Changes

### 5.1 Modified Hook

#### `useTransferForm` in [`frontend/src/hooks/usecase/useTransferForm.ts`](frontend/src/hooks/usecase/useTransferForm.ts)

**Changes:**

1. Add `categories?: Category[]` to the `UseTransferFormOptions` interface
2. In the `useEffect` that resets the form when `open` changes, after `reset(DEFAULT_VALUES)`, find the "Transfer" category by name (case-insensitive) and call `setValue('category_id', transferCategory.id)` if found

This follows React Rule 2 (logic in hooks, not components) — the category auto-selection logic lives in the hook, not the component.

### 5.2 Modified Component

#### `TransferFormModal` in [`frontend/src/components/transactions/TransferFormModal.tsx`](frontend/src/components/transactions/TransferFormModal.tsx)

**Changes:**

1. Pass `categories` to the `useTransferForm` hook call (line 44)

## 6. Error Handling

If no "Transfer" category exists, the `find()` returns `undefined` and the `category_id` stays as `''` (empty). No error is thrown.

## 7. Testing Strategy

### E2E Tests

- Add a test in a new `e2e/tests/transactions/transfer-category.spec.ts` that opens the transfer form and verifies the "Transfer" category is pre-selected.

### Manual Testing

- Open transfer form → verify "Transfer" category is selected
- Change category to something else → verify it works
- Create transfer → verify it saves with the selected category
