# UI v2 (Telemetry) — Design

**Requirements**: [requirements.md](./requirements.md)
**Capability source**: [parity-inventory.md](./parity-inventory.md)
**Visual reference**: [mocks/c-telemetry/](./mocks/c-telemetry/)
**GitHub Issue**: none yet
**Date**: 2026-09-27
**Status**: Approved 2026-09-27

## 1. Overview

- **Frontend:** the UI layer (pages, components, layout, styling) is rewritten from scratch in the existing `frontend/` package. The data layer (API calls, types, React Query hooks) is kept, merged into one clean module, and trimmed of dead code.
- **Chakra UI, Emotion and react-datepicker are removed.** In their place: our own design tokens in plain CSS, CSS Modules per component, and Radix primitives for accessible behaviour.
- **Backend:** new endpoints are added only where v2 needs data the API doesn't expose. Each one builds on an existing service or repository.
- **Database:** two changes, both approved. Accounts get an archived flag. User preferences get their own table.

The build goes page by page on `feat/ui-v2`. Each v1 page and its e2e tests are deleted in the same commit as the v2 page that replaces them. The branch stays shippable after every page, and v1 and v2 never run side by side.

## 2. Architecture

```
frontend/src/
  app/            router, providers, AppShell (sidebar, status strip, page frame)
  design/         tokens.css, reset.css, global.css, theme switching
  ui/             primitives: Button, IconButton, Field, Input, Select, Combobox,
                  Checkbox, Switch, Dialog, Drawer, Sheet, Menu, Tabs, Toast,
                  Tooltip, Table, Badge, Chip, Meter, Money, Stat, Skeleton,
                  EmptyState, ErrorState, ConfirmDialog, DatePicker, Pagination
  charts/         Sparkline, AreaChart, BarChart, Donut, PaceChart (SVG, d3-scale/d3-shape)
  api/            client.ts (single axios instance), queryClient.ts, keys.ts,
                  one module per domain (transactions.ts, accounts.ts, ...),
                  types/ (moved from src/types, pruned)
  features/
    auth/ dashboard/ transactions/ accounts/ budgets/ categories/ people/
    reports/ jobs/ schedules/ trash/ settings/
      each: pages/, components/, hooks/, (forms/ with zod schemas)
  lib/            format (money, dates, numbers from preferences), fx, url-state
```

The rule is one-way dependencies: `features` can import `ui`, `charts`, `api` and `lib`, but `ui` never imports `features` or `api`.

### 2.1 Library choices

| Need | Choice | Why |
|---|---|---|
| Styling | Plain CSS custom properties (tokens) plus CSS Modules | No runtime cost, built into Vite, and Telemetry's square hairline look is easier written directly than overriding a component kit |
| Accessible primitives | Radix UI (dialog, dropdown-menu, popover, tabs, switch, checkbox, select, toast, tooltip, toggle-group) | Unstyled, handles focus and ARIA correctly, and each piece installs separately |
| Command menu / combobox | `cmdk` | Person, category and account pickers with type-ahead |
| Date picker | `react-day-picker` | Unstyled and easy to theme. Replaces react-datepicker |
| Tables | `@tanstack/react-table` (kept) plus `@tanstack/react-virtual` | Long transaction lists and bulk selection |
| Forms | `react-hook-form` plus `zod` (kept) | Already used, works well |
| Server state | TanStack Query (kept) | Already used |
| Charts | Own SVG components on `d3-scale` and `d3-shape` | The mocks' charts are hand-built SVG. Recharts is removed |
| Motion | CSS transitions, plus `motion` (the successor to framer-motion) for enter/exit only | Drawer, sheet and toast presence animations |
| Icons | `lucide-react` | Consistent stroke icons that suit the terminal look. Replaces react-icons |
| Fonts | Self-hosted via `@fontsource`: JetBrains Mono (figures and labels) and Inter (body) | No network fetches, and tabular numerals |

**Removed:** `@chakra-ui/*`, `@emotion/*`, `react-datepicker`, `@types/react-datepicker`, `recharts`, `react-icons`, and `framer-motion` (replaced by `motion`). React Query devtools are loaded in dev builds only.

### 2.2 Design tokens

These come from the Telemetry mock (`mocks/c-telemetry/style.css`). Dark is the default. Light has its own values for every token.

- **Surfaces:** `--bg #0A0A0A`, `--panel #121212`, `--line` (hairline). Grids use `gap:1px` over the line colour.
- **Accent and signal colours:** accent `#FFD400` (hazard yellow, never used to mean error). Positive `#4ADE80`. Negative and critical have their own red, distinct from the accent.
- **Type:** mono for figures, labels and the status strip. Sans for longer text. Tabular numerals everywhere.
- **Shape and space:** radius 0, spacing on a 4px scale.
- **Motion:** durations of 100, 200, 300, 400 and 600ms, with the flow curve `cubic-bezier(0.22,0,0.12,1)`.
- **Reduced motion:** a `:root.rm` class mirrors `prefers-reduced-motion` and turns off every transform.

### 2.3 App shell

- **Sidebar:** the 11 nav items, collapsible. On phones it becomes a bottom bar with a "More" sheet. User block and a version line from `GET /version`.
- **Status strip:** fixed slots for net worth, month net, budgets and last sync, plus the rotating alert slot. It behaves as prototyped in the mock: rotates every 4.5s, holds on hover or focus, has a pause button and respects reduced motion. Slots drop in the order sync, month, net worth and budgets as the window narrows. Its data comes from `GET /dashboard`, `GET /budgets` and the latest sync job. Alerts are worked out on the client.
- **Page frame:** real page title, breadcrumbs built from router links, and a slot for page actions.
- **Errors:** a per-route error boundary with retry, plus a global boundary.

### 2.4 Data layer rules

- **One HTTP client** (`api/client.ts`):
  - Bearer token.
  - A 401 clears the session and sends the user to `/login?from=`.
  - Errors come back as one `ApiError` shape.
  - The second client in `services/api.ts` and the duplicate query client are deleted.
- **Query keys** live in one `keys.ts` factory, so invalidation is consistent.
- **Filters live in the URL** on every list page, through a typed `useUrlState(schema)` hook. The detail pages' transaction lists use the same filter model.
- **Transaction lists use server-side filtering, search and pagination.** The total comes from the `X-Total-Count` header, which CORS must expose (see 4.2).

### 2.5 Transactions page (filter rail)

- **Left rail:** search, month navigation, and every filter: account, category, person, date range, amount range, sign, has splits, in transfer, paid by others.
- **Main column:** a month summary (income, spend and net), then rows grouped by date, with daily subtotals.
- **Row detail:** opens in a right-hand drawer, and the drawer's state is in the URL (`?tx=<id>`). The full page `/transactions/:id` stays for deep links.
- **Bulk select** gives a bottom action bar with delete. It can be extended to "set category" later.
- **Phones:** the rail becomes a filter sheet.

## 3. Database Changes

### 3.1 Accounts: archive

Migration `add_archived_at_to_accounts`:

```sql
ALTER TABLE accounts ADD COLUMN archived_at TIMESTAMPTZ NULL;
CREATE INDEX idx_accounts_user_active ON accounts (user_id) WHERE archived_at IS NULL;
```

A timestamp tells us both whether an account is archived and when. The API's existing `is_active` field becomes `archived_at IS NULL`. That field is currently accepted and then dropped (finding 8d19a8b5).

**How archived accounts behave:**

| Where | Behaviour |
|---|---|
| Account pickers (transaction, transfer, import, settle, budget filters) | Hidden |
| Accounts page | In a collapsed "Archived" group |
| Their transactions | Still listed, searchable and counted in reports for their dates |
| Net worth and totals | Still counted. A non-zero balance is real money. The UI warns when archiving an account whose balance isn't zero |
| Sync | Provider sync is refused for archived accounts |
| Unarchive | Allowed at any time |

### 3.2 User preferences

Migration `create_user_preferences`:

```sql
CREATE TABLE user_preferences (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_currency currency_code NOT NULL DEFAULT 'EUR',
  date_format    VARCHAR(16) NOT NULL DEFAULT 'DD/MM/YYYY',  -- DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD
  number_locale  VARCHAR(16) NOT NULL DEFAULT 'en-US',       -- en-US | de-DE | fr-FR | en-IN
  week_start     SMALLINT    NOT NULL DEFAULT 1,             -- 1 = Monday, 7 = Sunday
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **Lazy creation:** there's no row until the user saves. `GET` returns the defaults when no row exists.
- **Theme** stays on the client, because it's per device.
- **Default currency** does two jobs:
  - It's the display currency.
  - Server-side totals convert into it (dashboard, net worth, budgets, analytics). This replaces the `PRIMARY_CURRENCY` constant through a `user_primary_currency(user_id)` helper, which falls back to EUR.
- `week_start` is new. Weekly budget periods and reports need it. It's small, and it fits in the same table.

### 3.3 Models

- `Account`: add `archived_at: Option<DateTime<Utc>>`. `AccountResponse.is_active` becomes derived instead of hardcoded `true`, and `archived_at` is exposed.
- New `UserPreferences` (Queryable), `NewUserPreferences`/`UpdateUserPreferences` (Insertable/AsChangeset), and `UserPreferencesResponse` (camelCase).

## 4. API Changes

Everything goes under `/api/v1` and is scope checked like its neighbours. The table notes which existing code each endpoint builds on.

### 4.1 New Endpoints

| Method | Path | Description | Request | Response | Reuses |
|---|---|---|---|---|---|
| GET | `/analytics/net-worth-history` | Net worth at each interval point | `?from&to&interval=month\|week` | `[{date, total, byType}]` | `calculate_balance`: current balance minus later transactions, converted at current FX (labelled as such in the UI) |
| GET | `/analytics/monthly` | Income and spend per month | `?months=12` | `[{month, income, spend, net}]` | `analytics_service` totals. Transfers and excluded categories are left out |
| GET | `/analytics/spending-trend` | Daily spend for a range | `?from&to` | `[{date, amount}]` | existing `get_spending_trend` (no route today) |
| GET | `/budgets/:id/ranges` | Range history | | `[BudgetRange]` | `list_ranges_for_budget` |
| PUT | `/budgets/:id/ranges/:rangeId` | Edit a range | `{limitAmount, period, startDate, endDate}` | `BudgetRange` | new repo fn. Overlap check |
| DELETE | `/budgets/:id/ranges/:rangeId` | Remove a range | | 204 | new repo fn. The last range can't be deleted |
| PATCH | `/auth/me` | Update profile | `{name, email}` | `User` | users repo. Email must be unique (409) |
| POST | `/auth/change-password` | Change password | `{currentPassword, newPassword}` | 204 | existing hash/verify helpers |
| GET | `/preferences` | Read preferences | | `UserPreferences` | new |
| PUT | `/preferences` | Save preferences (upsert) | `UserPreferences` | `UserPreferences` | new |
| POST | `/accounts/:id/archive` | Archive | | `Account` | account service |
| POST | `/accounts/:id/unarchive` | Unarchive | | `Account` | account service |
| POST | `/transactions/bulk-delete` | Soft delete many | `{ids: [uuid]}` (max 500) | `{deleted, failed:[{id, error}]}` | existing soft-delete service, called per id in one DB transaction |
| POST | `/schedules/:id/run` | Run now | | `{jobId}` | `build_job_input` moved from the worker binary into `schedule_service` so both can share it |
| GET | `/jobs/:id` | One job (currently 404) | | `Job` | background job repo |

### 4.2 Modified Endpoints

- **`GET /transactions`:**
  - New filter `paid_by_others=only|exclude`, the one v1 filter the server doesn't support yet.
  - `category_id` also accepts `uncategorised`.
  - `account_id` and `category_id` accept comma-separated lists.
  - Search stays as it is (title and notes).
- **`GET /accounts`:**
  - `?include_archived=true`. Archived accounts are left out by default.
  - Each account includes `balance`, `archivedAt` and a correct `isActive`.
  - Balances are loaded in one grouped query. This fixes the N+1 in finding fe3a15db.
- **`GET /budgets`:**
  - Each budget includes its active range, spent, remaining, percentage, status and days left (finding b85adb13).
  - The active range is chosen deterministically: the latest `start_date` that covers today (finding 63592521).
- **`POST /budgets/:id/ranges`:** now rejects a range that overlaps another with 409 (finding 63592521).
- **`GET /jobs` and `GET /schedules/:id` recent jobs:** each job includes `scheduleId`, taken from `input.schedule_id` (finding da9e548f).
- **`GET /dashboard`:**
  - Totals are in the user's default currency.
  - Budget statuses use real periods and dates.
  - The per-budget N+1 is removed (finding fe3a15db).
- **Account types:** the create and update validation matches the enum the UI offers: CHECKING, SAVINGS, CREDIT_CARD, INVESTMENT, CASH, DEBT, GIFT_CARD. LOAN is not offered (finding 42e5bbe5).
- **CORS:** expose `X-Total-Count` (finding 6ecd241a).
- **Balance serialization:** BigDecimal is sent as a string end to end. Nothing falls back silently to `0.0` (finding f0fd3a51).
- **Transaction search indexes (finding 848a713e):**
  - A partial index on `(user_id, date DESC) WHERE is_deleted = false`.
  - A `pg_trgm` GIN index on title and notes.
  - This needs a migration, but it doesn't change the data model.

## 5. Frontend Changes

### 5.1 Pages (all new)

| Route | Notes |
|---|---|
| `/login`, `/register` | Telemetry auth screens. On success, return to `from` |
| `/dashboard` | As mocked, plus net-worth history and monthly income and spend (real endpoints now) |
| `/transactions` | Filter rail layout (2.5), with the row drawer |
| `/transactions/:id` | Full-page detail, same content as the drawer |
| `/accounts`, `/accounts/:id` | As mocked, plus the Archived group, archive/unarchive, bank and portfolio sync with correct labels |
| `/budgets`, `/budgets/:id` | As mocked, plus working edit and range history (list, edit, delete ranges) |
| `/categories`, `/categories/:id` | Grid with colour, icon and the excluded-from-analysis flag |
| `/people`, `/people/:id` | Debt overview from `GET /people` summaries, settle up, split provider link |
| `/reports` | Tabs in the URL (`?tab=`), date range picker, all data from server aggregates, FX-correct |
| `/jobs`, `/jobs/:type/:id` | Type filter in the URL, pagination, schedule badge, sync wizard, bank sync import |
| `/schedules`, `/schedules/:id` | Presets with correct labels, run now, delete, pause |
| `/trash` | Restore, delete forever, bulk restore |
| `/settings` | Tabs in the URL: profile, preferences, security (change password), integrations, API keys, about (real version) |

### 5.2 Hooks

- `useUrlState(schema)`: typed URL search params, with defaults and a replace-or-push policy.
- `usePreferences()`: server preferences plus formatters (`formatMoney`, `formatDate`, `formatNumber`).
- `useStatusStrip()`: builds the slot values and the alert queue.
- One set of query hooks per domain, kept from the current `hooks/api` and renamed into `features/*/hooks` or `api/`.
- `useBulkSelection()`: selection state keyed by id, which survives pagination.

### 5.3 Services

- The `api/*` modules, one per backend domain, all built on the single client.
- New: `analytics.ts`, `preferences.ts`, `budgetRanges.ts`, and the profile and password calls in `auth.ts`.

### 5.4 Removed

The whole v1 `components/`, `pages/` and `theme/` trees, `services/api.ts`, the duplicate `services/queryClient.ts`, the unused hooks and components listed in the inventory, and the unrouted `pages/settings/ApiKeys.tsx`.

## 6. Error Handling

- **Queries:** each query shows its own skeleton, empty state and error state (with retry). A failure in one panel never blanks the whole page.
- **Mutations:**
  - Success and failure show toasts.
  - Destructive actions go through ConfirmDialog, which stays open with a loading state and shows the error inline.
  - Delete and bulk delete show an undo toast, which restores through `POST /transactions/:id/restore`.
- **Form errors:** the server's 422 validation errors appear against the matching fields, and 409 conflicts (duplicate email, overlapping budget range) show as a message on the form.
- **Sessions:** a 401 anywhere ends the session and returns the user to the page they were on after login.
- **Offline:** network errors show one connection banner, not a toast for every query.

## 7. Testing Strategy

**Backend** (following the rule: tests only in `backend/tests/integration/`):
- `integration_api` tests for every new or modified endpoint. They cover the success case, validation, ownership (another user's resources return 404) and API key scope.
- `integration_database` tests for the archive filter, preferences upsert and defaults, the range overlap check and the active range choice, and the net-worth-history arithmetic.
- `cargo clippy` and `cargo fmt` are clean.

**Frontend:**
- `npm run build` (type check) and `npm run lint` pass after every page.
- Vitest covers `lib/` (formatters, FX, URL state) and the status strip alert builder.

**E2E:**
- The current Playwright suite uses CSS and aria-label selectors that will break. Each v2 page ships with its e2e tests rewritten, using role and label queries (`getByRole`, `getByLabel`).
- The smoke suite is updated first, so every commit keeps a green baseline.
- Screenshots at 1440 and 390, in dark and light, for each page, reviewed before the page is marked done.

**Manual:** Splitwise/SplitPro, TrueLayer and Trading 212 flows are checked on beta with real credentials before merge.

## 8. Rollout

1. **Backend first**, in its own commits (migrations, then endpoints and fixes, then tests), so v1 keeps working against it.
2. **Frontend:**
   - Foundation first: tokens, `ui/` primitives, shell, `api/` consolidation, and auth pages.
   - Then pages in this order: Dashboard, Transactions, Accounts, Budgets, Categories, People, Trash, Jobs, Schedules, Reports, Settings.
   - Each page replaces its v1 counterpart and its e2e tests in the same commit.
3. **Beta:** deploy through the usual two manual steps. Check the pages behave correctly and that integrations work.
4. **Merge and release:** through the four-step prod deploy.

## 9. Decisions (approved 2026-09-27)

- Archived accounts keep counting toward net worth; the UI warns when archiving a non-zero balance (3.1).
- The default currency preference replaces the server's fixed EUR for all server-side totals (3.2).
- `week_start` is added to preferences, default Monday (3.2).
- Net worth history uses current FX rates for past points; historical rates are future work (4.1).
