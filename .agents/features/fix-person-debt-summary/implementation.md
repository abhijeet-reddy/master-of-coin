# Fix Person Debt Summary — Implementation

**Design**: [design.md](./design.md)

---

## Affected Pages

- **People page** — uses `GET /people` via `usePeople()` hook → `PersonCard` component shows balance
- **Person Detail page** — also uses `GET /people` via `usePeople()` hook (cached) → `PersonInfoCard` component shows Owes Me / I Owe / Net Balance
- Both pages read `debt_summary` and `transaction_count` from the person object, which the backend currently does not return

---

## Backend Implementation

### Phase 1: Model Changes

- [x] Add `DebtSummaryResponse` struct to `backend/src/models/person.rs` with fields: `owes_me: String`, `i_owe: String`, `net: String`
- [x] Add `debt_summary: Option<DebtSummaryResponse>` field to `PersonResponse`
- [x] Add `transaction_count: i64` field to `PersonResponse`
- [x] Update `From<Person> for PersonResponse` impl to default `debt_summary` to `None` and `transaction_count` to `0`
- [x] Export `DebtSummaryResponse` from `backend/src/models/mod.rs`

### Phase 2: Repository — Batch Splits Query

- [x] Add `list_splits_for_people` function to `backend/src/repositories/person.rs` that fetches all splits for multiple person IDs in a single query using `WHERE person_id = ANY(ids)`

### Phase 3: Handler Changes

- [x] Update `list` handler in `backend/src/handlers/people.rs`:
  - Fetch all people (1 query)
  - Fetch all splits for all people in one batch query via `list_splits_for_people` (1 query)
  - Group splits by `person_id` using a `HashMap`
  - For each person, calculate `owes_me`, `i_owe`, `net` from their grouped splits using BigDecimal
  - Count distinct `transaction_id` values per person for `transaction_count`
  - Populate `debt_summary` and `transaction_count` on each `PersonResponse`
- [x] Update `get` handler in `backend/src/handlers/people.rs`:
  - Fetch the person (1 query)
  - Fetch their splits via existing `list_splits_for_person` (1 query)
  - Calculate and populate `debt_summary` and `transaction_count`
- [x] Add private `calculate_debt_summary` helper function for reuse between `list` and `get`
- [x] Verify backend compiles cleanly with `cargo check`

### Phase 4: Verification

- [ ] Test manually in browser: People page shows correct balances per person
- [ ] Test manually in browser: Person Detail page shows correct Owes Me / I Owe / Net Balance
- [ ] Verify Settle Up button appears for people with non-zero balances
- [ ] Existing E2E tests still pass
