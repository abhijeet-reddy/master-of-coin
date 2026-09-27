# UI v2 (Telemetry) — Implementation

**Design**: [design.md](./design.md)
**GitHub Issue**: none yet

Mark each item `[x]` the moment it is done.

---

## Backend Implementation

### Phase 1: Database & Models

#### 1.1 Account archive

- [x] `diesel migration generate add_archived_at_to_accounts` (column + partial index, reversible down.sql)
- [x] Update `schema.rs`, `Account` model, `AccountResponse` (`archivedAt`, derived `isActive`)
- [x] Run migrations and verify: `diesel migration run` / `diesel migration revert` / run again

#### 1.2 User preferences

- [x] `diesel migration generate create_user_preferences` (defaults: EUR, DD/MM/YYYY, en-US, week_start 1)
- [x] Models: `UserPreferences`, `NewUserPreferences`, `UpdateUserPreferences`, `UserPreferencesResponse`
- [x] Repository: `get_or_default`, `upsert`
- [x] `user_primary_currency(user_id)` helper (falls back to EUR)

#### 1.3 Search indexes

- [x] `diesel migration generate transaction_search_indexes` (`pg_trgm` extension, trigram GIN on title/notes, partial `(user_id, date DESC) WHERE is_deleted = false`)

### Phase 2: Services & Handlers

#### 2.1 Accounts

- [x] `POST /accounts/:id/archive`, `POST /accounts/:id/unarchive`
- [x] `GET /accounts` excludes archived by default, `?include_archived=true`, includes `balance`
- [x] Grouped balance query (remove per-account N+1)
- [x] Provider sync refused for archived accounts
- [x] Account type validation matches the UI enum (no LOAN)

#### 2.2 Transactions

- [x] `GET /transactions`: `paid_by_others=only|exclude`, `category_id=uncategorised`, comma-separated `account_id` / `category_id`
- [x] `POST /transactions/bulk-delete` (max 500, one DB transaction)
- [x] CORS exposes `X-Total-Count`

#### 2.3 Budgets

- [x] Deterministic active range (latest start_date covering today)
- [x] Overlap check on create range (409)
- [x] `GET /budgets/:id/ranges`, `PUT /budgets/:id/ranges/:rangeId`, `DELETE /budgets/:id/ranges/:rangeId` (cannot delete last)
- [x] `GET /budgets` includes active range, spent, remaining, percentage, status, days left

#### 2.4 Analytics & dashboard

- [x] `GET /analytics/net-worth-history?from&to&interval`
- [x] `GET /analytics/monthly?months=`
- [x] `GET /analytics/spending-trend?from&to`
- [x] Dashboard: totals in user default currency, real budget periods, remove per-budget N+1
- [x] Replace `PRIMARY_CURRENCY` usages with `user_primary_currency`

#### 2.5 Auth, profile & preferences

- [x] `PATCH /auth/me` (name, email; 409 on duplicate email)
- [x] `POST /auth/change-password`
- [x] `GET /preferences`, `PUT /preferences`

#### 2.6 Jobs & schedules

- [x] Move `build_job_input` from `bin/worker.rs` into `schedule_service`
- [x] `POST /schedules/:id/run`
- [x] `GET /jobs/:id`
- [x] `scheduleId` on job responses (from `input.schedule_id`)

#### 2.7 Money serialization

- [x] Remove lossy BigDecimal to f64 conversions that fall back to 0.0

### Phase 3: Backend testing

- [x] `integration_api` tests for every new/modified endpoint (success, validation, ownership, API key scope)
- [x] `integration_database` tests: archive filter, preferences defaults/upsert, range overlap + active range, net worth history arithmetic
- [ ] `cargo fmt`, `cargo clippy` clean, `cargo test` green (fmt and tests done, 448+79 green; clippy has 176 pre-existing warnings, none on v2 lines)
- [ ] Close the matching children of the backend findings task on the board

---

## Frontend Implementation

### Phase 4: Foundation

- [x] Remove Chakra, Emotion, react-datepicker, recharts, react-icons, framer-motion; add Radix pieces, cmdk, react-day-picker, d3-scale, d3-shape, lucide-react, @fontsource fonts (removals done in Phase 6; @tanstack/react-virtual, motion, @tanstack/react-table, date-fns, toggle-group and visually-hidden were never imported and were dropped too)
- [x] `design/`: tokens.css (dark + light), reset, global, theme switching, reduced motion class
- [x] `ui/` primitives (see design 2): Button, IconButton, Field, Input, Select, Combobox, Checkbox, Switch, Dialog, Drawer, Sheet, Menu, Tabs, Toast, Tooltip, Table, Badge, Chip, Meter, Money, Stat, Skeleton, EmptyState, ErrorState, ConfirmDialog, DatePicker, Pagination
- [x] `charts/`: AreaChart, BarChart, Donut, PaceChart (Sparkline was never used and was removed in Phase 6)
- [x] `api/`: single client, query keys, per-domain modules, pruned types; delete `services/api.ts` and duplicate query client
- [x] `lib/`: formatters from preferences, FX helpers, `useUrlState`
- [x] App shell: sidebar / bottom bar, status strip, page frame, breadcrumbs, error boundaries
- [x] Auth pages: `/login`, `/register`
- [x] Smoke e2e tests rewritten with role/label selectors (not yet run: needs a Docker stack serving this build)

### Phase 5: Pages (each replaces v1 page + its e2e tests in the same commit)

- [x] Dashboard
- [x] Transactions (filter rail, drawer, bulk select) + `/transactions/:id`
- [x] Accounts + `/accounts/:id` (archive, bank/portfolio sync)
- [x] Budgets + `/budgets/:id` (edit, range history)
- [x] Categories + `/categories/:id`
- [x] People + `/people/:id` (settle, split provider link)
- [x] Trash
- [x] Jobs + `/jobs/:type/:id` (sync wizard, bank sync import)
- [x] Schedules + `/schedules/:id` (run now, delete, pause)
- [x] Reports (URL tabs, date range, server aggregates)
- [x] Settings (profile, preferences, security, integrations, API keys, about)

### Phase 6: Polish & verification

- [x] All v1 `components/`, `pages/`, `theme/` and dead hooks removed
- [x] `npm run build` and `npm run lint` clean; Vitest for `lib/` and status strip (build, lint 0 warnings, format and 260 Vitest tests clean)
- [x] Full e2e suite green (184 passed, 1 skipped, 0 failed on an isolated stack, 27/09/2026)
- [x] Screenshots 1440 / 390, dark / light, every page, reviewed (`screenshots/final/README.md`)
- [x] Grep UI copy for arrow glyphs and en/em dashes (scripted sweep; negative money now uses ASCII hyphen-minus, `-€420.00`)
- [ ] Beta deploy (dispatch beta-image.yml, then recreate) and integration checks with real credentials
