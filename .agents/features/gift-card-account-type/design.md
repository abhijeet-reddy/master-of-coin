# Gift Card Account Type — Design

**Requirements**: [requirements.md](./requirements.md)
**GitHub Issue**: [#47](https://github.com/abhijeet-reddy/master-of-coin/issues/47)
**Date**: 2026-03-12

## 1. Overview

Add `GIFT_CARD` as a new variant to the `account_type` PostgreSQL enum, the Rust `AccountType` enum, and the TypeScript `AccountType` enum. Update all frontend components that switch on account type to handle the new variant with an appropriate icon (FaGift) and color (pink).

## 2. Database Changes

### 2.1 Migration

A new Diesel migration that adds the `GIFT_CARD` value to the existing `account_type` PostgreSQL enum:

```sql
-- up.sql
ALTER TYPE account_type ADD VALUE 'GIFT_CARD';

-- down.sql
-- PostgreSQL does not support removing enum values; no-op
```

## 3. Backend Changes

### 3.1 Rust Enum

In [`backend/src/types/account_type.rs`](backend/src/types/account_type.rs):

- Add `GiftCard` variant to the `AccountType` enum
- Add `AccountType::GiftCard => out.write_all(b"GIFT_CARD")?` to `ToSql`
- Add `b"GIFT_CARD" => Ok(AccountType::GiftCard)` to `FromSql`

## 4. API Changes

None — the API already accepts any valid `AccountType` enum value.

## 5. Frontend Changes

### 5.1 TypeScript Enum

In [`frontend/src/types/models.ts`](frontend/src/types/models.ts:6):

- Add `GIFT_CARD = 'GIFT_CARD'` to the `AccountType` enum

### 5.2 Modified Components

Three components have `switch` statements on `AccountType` that need a new case:

1. [`AccountCard.tsx`](frontend/src/components/accounts/AccountCard.tsx) — `getAccountIcon`, `getColorScheme`
2. [`AccountInfoCard.tsx`](frontend/src/components/accounts/AccountInfoCard.tsx) — `getAccountIcon`, `getColorScheme`
3. [`AccountSummary.tsx`](frontend/src/components/dashboard/AccountSummary.tsx) — `getAccountIcon`, `getAccountColor`

For all three: `GIFT_CARD` → icon `FaGift`, color `pink`.

The account form (`AccountFormModal.tsx`) uses `z.nativeEnum(AccountType)` so it will automatically include the new value — no changes needed there.

## 6. Error Handling

No new error handling needed.

## 7. Testing Strategy

### Backend

- Run migration and verify it succeeds
- Existing account CRUD tests should still pass

### E2E

- Create a Gift Card account via the UI and verify it appears with the correct icon/badge
