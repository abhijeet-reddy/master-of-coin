# Gift Card Account Type — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: [#47](https://github.com/abhijeet-reddy/master-of-coin/issues/47)

---

## Backend Implementation

### Phase 1: Database Migration

- [ ] Create migration directory: `backend/migrations/<timestamp>_add_gift_card_account_type/`
- [ ] Write `up.sql`: `ALTER TYPE account_type ADD VALUE 'GIFT_CARD';`
- [ ] Write `down.sql`: comment explaining PostgreSQL cannot remove enum values
- [ ] Run migration: `cd backend && diesel migration run`

### Phase 2: Rust Enum

- [ ] In `backend/src/types/account_type.rs`:
  - Add `GiftCard` variant to the `AccountType` enum (after `Debt`)
  - Add `AccountType::GiftCard => out.write_all(b"GIFT_CARD")?` to `ToSql` impl
  - Add `b"GIFT_CARD" => Ok(AccountType::GiftCard)` to `FromSql` impl
- [ ] `cargo clippy --lib` passes
- [ ] `cargo fmt -- --check` passes

### Phase 3: Backend Integration Test

- [ ] Add test to account integration tests: create a Gift Card account and verify it succeeds
- [ ] Verify all existing account tests still pass

---

## Frontend Implementation

### Phase 4: TypeScript Enum

- [ ] In `frontend/src/types/models.ts`:
  - Add `GIFT_CARD = 'GIFT_CARD'` to the `AccountType` enum

### Phase 5: Account Components — Icon and Color

- [ ] In `frontend/src/components/accounts/AccountCard.tsx`:
  - Import `FaGift` from `react-icons/fa`
  - Add `case AccountType.GIFT_CARD: return FaGift;` to `getAccountIcon`
  - Add `case AccountType.GIFT_CARD: return 'pink';` to `getColorScheme`
- [ ] In `frontend/src/components/accounts/AccountInfoCard.tsx`:
  - Import `FaGift` from `react-icons/fa`
  - Add `case AccountType.GIFT_CARD: return FaGift;` to `getAccountIcon`
  - Add `case AccountType.GIFT_CARD: return 'pink';` to `getColorScheme`
- [ ] In `frontend/src/components/dashboard/AccountSummary.tsx`:
  - Import `FaGift` from `react-icons/fa`
  - Add Gift Card case to `getAccountIcon` and `getAccountColor`
- [ ] TypeScript compiles cleanly: `cd frontend && npx tsc --noEmit`

### Phase 6: Commit and Push

- [ ] `git add . && git commit -m "feat: add Gift Card account type (closes #47)" && git push origin main`
