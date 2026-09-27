# UI v2 Parity Inventory (current React frontend)

Source: `frontend/src/{App.tsx,pages,components,hooks,services}`. Endpoints are relative to `/api/v1` unless noted.

## Global

### Routing
- Public routes: `/login` and `/register`.
- Every other route sits inside `ProtectedRoute` and `Layout`.
- `/` redirects to `/dashboard`.
- `*` shows `PlaceholderPage` as the 404 page. It reads "{title} page will be implemented in {phase}".

### Auth and session
- The JWT is stored in localStorage under `auth_token`.
- On app load, if a token exists the app calls `GET /auth/me`. If that fails, the token is cleared.
- Login calls `POST /auth/login`. Register calls `POST /auth/register`. Both store the token and the user.
- Logout clears local state first, then calls `POST /auth/logout` and ignores any error.
- `ProtectedRoute` shows a spinner while auth loads. Unauthenticated users go to `/login` with `state.from`, so login can return them to where they were.
- The axios client sends a Bearer token, has a 10s timeout and uses `VITE_API_URL` (default `http://localhost:8080/api/v1`).
  - Any 401 clears the token and hard-redirects to `/login`, except when already on `/login` or `/register`.
  - Other errors are normalized into an error object with default messages for network errors, 403, 404, 409, 422 and 5xx.
- There is no refresh token, no expiry warning, no "remember me" and no onboarding flow.

### Shell
- Header:
  - Mobile menu button and a desktop sidebar-collapse toggle.
  - Page title, which is always "Dashboard" (see Quirks).
  - Light/dark toggle.
  - User menu with Settings and Logout.
- Sidebar:
  - Collapsed by default on desktop. On mobile it becomes a drawer.
  - Nav items: Dashboard, Transactions, Accounts, Budgets, Categories, People, Reports, Jobs, Schedules, Trash, Settings.
  - Footer shows user initials, name and email, plus `v{version}` from `GET /version`.
- Browser tab title is "{page} | Master of Coin".
- Theme comes from localStorage `chakra-ui-color-mode`, falling back to the system preference.

### Toasts and errors
- Toasts appear top-right and pause while the page is idle.
- A global ErrorBoundary shows the error message with "Reload Page" and "Try Again" buttons.

### Missing shell features
- No command palette.
- No global keyboard shortcuts. The only shortcut is shift+click or shift+Enter on a transaction row, which opens edit.
- No global search.
- No notifications center.

### Shared components
- `PageHeader`: title, subtitle, breadcrumbs, action buttons.
- `ConfirmDialog`: generic delete/confirm dialog.
- `ErrorAlert`, `EmptyState`, `LoadingSpinner`.

### Shared transaction list (used on Transactions, Account, Budget, Category and Person detail)
- Rows are grouped by date. Each date header shows an FX-converted daily total.
- Each row shows:
  - Title and amount (colored by sign).
  - Account badge (hidden for DEBT accounts).
  - Transfer badge (→ or ← with the linked account).
  - Category badge.
  - "Paid by X" badge for debt transactions.
  - Split badge, with a per-split sync status.
  - Debt effect ("your share" or amount owed).
- Row actions: duplicate (not shown for transfers) and delete (Transactions page only).
- Clicking a row opens the detail page and passes navigation state so breadcrumbs point back to the source.
- Infinite scroll: 50 per page, loaded via an IntersectionObserver.

### Shared filter drawer
- Opens from the right on desktop and as a bottom sheet on mobile.
- Shows an active-filter count and has Clear All and Done buttons.
- Filters:
  - Type: All / Income / Expense.
  - Paid by others: All / Paid by Others / My Payments.
  - Date range (from/to).
  - Amount range (min/max, compared to the absolute amount).
  - Account checkboxes.
  - Category checkboxes, including "Uncategorised".
- All filtering happens client-side on pages already loaded.

### Split sync status badge (one per split)
- Data: `GET /splits/:id/sync-status`.
- States:
  - synced: links to the external expense.
  - pending.
  - failed: has a Retry button, which calls `POST /splits/:id/retry-sync`.
  - not synced.

### Cross-page modals

#### TransactionFormModal (add, edit, duplicate)
- Fields and validation (zod):
  - Title: required.
  - Type: Expense or Income.
  - Amount: required, > 0.
  - "Who paid?": I paid / Someone else paid. Create mode only.
  - If I paid: Account is required.
  - If someone else paid:
    - "Paid by" person is required.
    - Currency (default EUR).
    - Note shown: "This won't affect any account balance. A debt will be tracked."
  - Category: optional.
  - Date: required, cannot be in the future.
  - Time: required.
  - Notes.
- Split Payment section (only when I paid, and not for debt transactions):
  - Add people. The amount is re-split equally each time someone is added.
  - Each person's amount can be edited.
  - Shows Total, Others' share and My share.
  - Error: "Total splits cannot exceed the transaction amount".
- Editing a debt transaction that has participants:
  - Shows a participants editor: name, owed share, Paid/You badges, add/remove, total cost.
  - Amount becomes read-only and is set from the user's share.
  - Save calls `PUT /debt-transactions/:id/metadata {total_cost, expense_participants}`, then `PUT /transactions/:id`.
- Endpoints:
  - Normal create/update: `POST /transactions` or `PUT /transactions/:id`, with a signed amount and `splits[{person_id, amount}]`.
  - Debt create: `POST /debt-transactions {payer_person_id, currency, title, amount, date, category_id, notes}`.
- Duplicate copies title, absolute amount, type, account (not for debt), category, notes, payer mode, payer person and currency. Date is reset to now.

#### TransferFormModal
- Endpoint: `POST /transfers`.
- Fields:
  - From account: required, DEBT accounts excluded, currency shown.
  - To account: required, cannot be the From account.
  - Amount: > 0.
  - Cross-currency: "To amount" and "Exchange rate", each recalculated from the other.
  - Same currency: "Amount received" checkbox that reveals a to-amount field. A soft warning appears when the two amounts differ by more than 20%.
  - Date and time.
  - Title (placeholder "Transfer to X").
  - Notes.
  - Category, auto-selected if one is named "transfer".
- Toast on success: "Transfer Created".

#### ConvertToTransferModal (from transaction detail)
- Available only when the transaction has no splits and is not already a transfer.
- Shows a direction hint.
- Counterpart account is required: not DEBT and not the same account.
- Suggested matches come from `GET /transactions` with:
  - `account_id`, `exclude_id`, opposite sign
  - `closest_to=|amount|`, date within ±1 day
  - `in_transfer=false`, `has_splits=false`, `is_deleted=false`
  - `limit=5`
- Optional search box (400ms debounce, limit 20, total taken from the `x-total-count` header).
- Match badges: "Exact match" or "X less" / "X more".
- Or "Create a new transaction instead", with cross-currency amount/rate, a "different amount" checkbox and the 20% warning.
- Endpoint: `POST /transactions/:id/convert-to-transfer {account_id, counterpart_transaction_id | counterpart_amount, exchange_rate}`.
- Button reads "Link Transactions" or "Convert". Toasts on success and failure.

#### ImportStatementModal (CSV import, also reused for bank-sync import)
- Step 1, upload:
  - Account: required, active accounts only.
  - File: `.csv`, max 5MB.
  - Expected format `id,time,merchant,type,amount,card` with a header row.
  - "Parse CSV" calls `POST /transactions/import/parse` (multipart: file, account_id).
- Step 2, preview (edit before import):
  - Row checkboxes and select-all. Valid, non-duplicate rows start selected.
  - Date, title and amount can be edited inline. Category can be picked per row.
  - Duplicate badge with HIGH/MEDIUM/LOW confidence. Invalid rows get a badge.
  - Rows are tinted yellow (duplicate) or red (invalid).
  - Summary: selected count, income, expenses, duplicates.
  - "Import N Transactions" calls `POST /transactions/bulk-create {account_id, transactions, bank_sync_metadata?}`.
- Step 3, result: created and failed counts, then Done.

#### SplitMismatchModal
- Opens when a split sync reports a mismatch.
- Shows local vs external splits side by side, with a warning if the totals differ.
- "Push Local" or "Pull External" calls `POST /transactions/:id/resolve-split-mismatch`.

#### ConfirmDialog
- Used for every delete action, plus Splitwise/SplitPro disconnect.

---

## /login
- **Purpose:** sign in.
- **Form:**
  - Email (type email, required).
  - Password (required).
- **Error state:** inline API error message.
- **On success:** go to `state.from`, or `/dashboard` if there is none.
- **Links:** to `/register`.
- **Endpoint:** `POST /auth/login`.

## /register
- **Purpose:** create an account.
- **Form (all fields required):**
  - Username.
  - Email.
  - Full name.
  - Password, minimum 8 characters ("Password must be at least 8 characters long").
  - Confirm password ("Passwords do not match").
- **Error state:** inline API error.
- **On success:** go to `/dashboard`.
- **Links:** to `/login`.
- **Endpoint:** `POST /auth/register`.

## /dashboard
- **Purpose:** financial overview.
- **Data:** `GET /dashboard`, which returns net_worth, budget_statuses, category_breakdown, debt_overview and recent_transactions (the last 10).
- **Widgets:**
  - Net Worth.
  - Budget Progress:
    - Status is OK below 80%, WARNING from 80%, EXCEEDED from 100%.
    - Each card shows a progress bar and spent vs limit.
    - Click a card to open `/budgets/:id`.
  - Category Breakdown: pie chart of this month's spending, tooltip shows % of total.
  - Debt widget: "You Are Owed" and "You Owe". Click to open `/people`.
  - Recent Transactions: rows open `/transactions/:id`, "View all" opens `/transactions`.
- **States:**
  - Loading: "Loading dashboard...".
  - Error: "Error loading dashboard".
  - No data: "No dashboard data available".
  - Empty widgets: "No budgets set", "No transactions yet".

## /transactions
- **Purpose:** monthly ledger.
- **Data:** `GET /transactions?start_date&end_date&limit=50&offset` for the selected month (infinite scroll), plus accounts, categories, people and `GET /exchange-rates?base=`.
- **URL params:**
  - `month=YYYY-MM` (left out for the current month). Changing month adds a history entry.
  - `accounts` (comma-separated).
  - `categories` (comma-separated, can include `uncategorised`).
  - `type=income|expense`.
  - `startDate`, `endDate`.
  - `minAmount`, `maxAmount`.
  - `paidByOthers=only|exclude`.
  - Filter changes replace the history entry. The drawer opens automatically if any filter param is present.
- **Month navigator:** previous/next buttons and chips for the last 12 months.
- **Month summary:** Income, Expenses and Net, FX-converted, leaving out categories marked "excluded from analysis".
- **Actions:**
  - Filter toggle.
  - Transfer.
  - Import CSV.
  - Add Transaction, plus a floating button on mobile.
  - Row duplicate and row delete.
  - Shift+click a row to edit it.
- **Delete:** confirm dialog says the transaction is "moved to trash and permanently deleted after 30 days". Calls `DELETE /transactions/:id`.
- **States:** skeletons while loading; "No transactions found" when empty.
- **Missing:** no text search, no sorting, no bulk select.

## /transactions/:id
- **Data:** `GET /transactions/:id`, joined client-side with accounts, categories and people.
- **Breadcrumbs:** depend on where the user came from (account, category, budget or person page), otherwise Transactions. After delete, the user is sent back to that source page.
- **Actions:**
  - Edit.
  - Menu: Convert to transfer (only if no splits and not already a transfer), Duplicate (not for transfers), Delete.
  - If the transaction is deleted, all actions are hidden and a banner shows "Deleted on X, will be purged on Y" with Restore (`POST /transactions/:id/restore`).
- **Detail content:**
  - Amount (struck through if deleted), debt effect, "Your share".
  - Details: account or "Paid by", category or Uncategorized, full date, currency, created and updated times.
  - Notes.
  - Transfer details: transfer ID with copy button (and toast), linked account, and Sent / Received / Discount-or-Fee when the two legs differ.
  - Full expense participants.
  - Splitwise Sync card.
  - Split breakdown, with a sync badge per split.
- **Sync:** `POST /transactions/:id/sync-split`.
  - Results synced, linked and created each show a toast.
  - A mismatch result opens SplitMismatchModal.
- **States:**
  - Loading: "Loading transaction...".
  - Error: "Failed to load transaction".
  - Not found message.

## /accounts
- **Data:** `GET /accounts` and exchange rates.
- **Shows:**
  - Total Balance card (FX-converted, with the account count).
  - Account cards: type icon, name, type, balance, notes preview, edit and delete buttons. Click a card to open its detail page.
- **Actions:** Add Account. Edit and delete open AccountFormModal or a confirm dialog.
- **Delete:** confirm says "cannot be undone". Calls `DELETE /accounts/:id`. Errors show as an alert.
- **States:** skeletons while loading; "No accounts yet" when empty.

### AccountFormModal
- **Fields:**
  - Name: required, max 100.
  - Type: Checking, Savings, Credit Card, Investment, Cash or Loan.
  - Currency.
  - Initial balance: create only, number.
  - Notes: max 500.
- **Endpoints:** `POST /accounts`, or `PUT /accounts/:id` with name, account_type, currency and notes.
- **Investment, create mode:**
  - Shows a "Connect provider" block: Trading 212, API key, API secret, environment (live/demo).
  - After the account is created, calls `POST /investment-providers`.
- **Investment, edit mode:**
  - Shows "connected since".
  - Disconnect calls `DELETE /investment-providers/:id`. Connect is also available.
- **Checking, Savings or Credit Card, edit mode (bank connection):**
  - "Connect Bank" calls `GET /bank-providers/truelayer/auth-url?account_id=` and redirects the browser.
  - When connected, shows provider, connected since and last synced.
  - Disconnect calls `DELETE /bank-providers/:id`.
  - "Select Bank Account" lists `GET /bank-providers/:id/accounts` and links one via `PUT /bank-providers/:id/link-account`.
  - Balance comes from `GET /bank-providers/:id/balance`.

## /accounts/:id
- **Data:** `GET /accounts/:id` plus an infinite `GET /transactions?account_id=`.
- **Info card:**
  - Shows name, type, balance, notes.
  - Actions: Edit, Delete, Sync.
- **Investment accounts:**
  - "Portfolio Value" can be edited inline (Enter to save, Esc to cancel). Calls `PUT /accounts/:id/balance`.
  - "Sync Portfolio" (when a provider is connected):
    - Calls `POST /portfolio-sync {account_id}` and polls `GET /portfolio-sync/:id` every 2s.
    - Shows a toast and refreshes data when done.
    - On failure, an alert links to `/jobs/portfolio-sync/:jobId`.
- **Bank accounts that are connected and linked:**
  - Sync calls `POST /bank-providers/:id/sync`, then navigates to `/jobs/bank-sync/:jobId`.
- **Transactions:**
  - Local filter drawer (not saved in the URL, no account filter).
  - Add Transaction (account preselected) and Duplicate. Both are hidden for investment accounts.

## /budgets
- **Data:** `GET /budgets` plus `GET /dashboard` (for budget_statuses).
- **Overall card:** total spent vs budgeted, number over budget, remaining, "Average Usage".
- **Budget cards:**
  - Sorted EXCEEDED, then WARNING, then OK, then by name.
  - Each shows status, progress, spent/limit and days remaining.
  - Edit is disabled. Delete calls `DELETE /budgets/:id` ("cannot be undone").
- **Actions:** Add Budget.
- **Empty state:** "No budgets yet".

### BudgetFormModal
- **Fields:**
  - Name: required, max 100.
  - Category: required.
  - Accounts: optional multi-select.
  - Limit: required.
  - Period: Daily, Weekly, Monthly, Quarterly or Yearly.
  - Start date: required.
  - End date: filled in automatically.
  - Notes: max 500.
- **Create:** `POST /budgets {name, filters:{category_id, account_ids}}`, then `POST /budgets/:id/ranges {limit_amount, period, start_date, end_date}`.
- **Update:** `PUT /budgets/:id` (the UI never reaches this, because Edit is disabled).

## /budgets/:id
- **Data:** `GET /budgets/:id`, then `GET /transactions` filtered by the budget's category and the active range dates.
- **Info card:** name, period, status, progress, spent/limit, days remaining, Delete. There is no edit.
- **Transactions:** local filters (no "paid by others" filter) and Duplicate.
- **States:**
  - Loading: "Loading budget...".
  - Error alert.
  - Not found: "Budget not found".

## /categories
- **Data:** `GET /categories`.
- **Category cards:** color swatch, icon and name, with edit and delete buttons. Click a card to open its detail page.
- **Actions:** Add Category.
- **Delete:** confirm says "cannot be undone". Calls `DELETE /categories/:id`.
- **States:** spinner while loading; empty state; errors "Failed to load categories" and "Failed to delete category".

### CategoryFormModal
- **Fields:**
  - Category Name: required.
  - Icon: emoji, max 10 characters, default 📁.
  - Color: hex `#RRGGBB` text input plus a native color picker. A random color is prefilled.
  - "Exclude from analysis" switch, edit mode only. Helper text reads either "Not counted. Still visible in the ledger..." or "Counted in breakdowns and budgets."
- **Endpoints:** `POST /categories`, or `PUT /categories/:id` including `is_excluded_from_analysis`.

## /categories/:id
- **Data:** the category is found in the `GET /categories` list. Transactions come from an infinite `GET /transactions?category_id=`.
- **Info card:** icon and name, Edit (opens CategoryFormModal), Delete (then goes back to `/categories`).
- **Transactions:** local filter drawer (no category filter) and Duplicate.
- **States:**
  - Loading: "Loading category...".
  - Error: "Failed to load category".
  - Not found: "The category you are looking for does not exist."

## /people
- **Data:** `GET /people` (includes each person's debt_summary and transaction_count).
- **Debt Overview card:**
  - Owed to Me, I Owe, net balance.
  - Number of people with outstanding debts.
  - Worked out client-side from the first page of `GET /transactions`.
- **Person cards:**
  - Name, email, phone.
  - Badge: Owes Me / I Owe / Settled.
  - Absolute debt amount and transaction count.
  - Edit and delete buttons. Click a card to open its detail page.
- **Actions:** Add Person.
- **Delete:** confirm says "cannot be undone". Calls `DELETE /people/:id`.
- **Empty state:** "No people yet".

### PersonFormModal
- **Fields:**
  - Name: required, max 100.
  - Email: must be a valid email if given.
  - Phone: regex `^[+]?[0-9\s\-().]{7,20}$`.
  - Notes: max 500.
- **Endpoints:** `POST /people`, or `PUT /people/:id` (cleared fields are sent as null).
- **Split Provider section (edit mode only):**
  - Shows the current link as "Linked to external user #N", with a clear button (`DELETE /people/:id/split-config`).
  - Provider select (active providers only), then Friend select (`GET /integrations/providers/:id/friends`), then Save (`PUT /people/:id/split-config`).
  - Current link comes from `GET /people/:id/split-config`.

## /people/:id
- **Data:** the person is found in the `GET /people` list. Transactions come from an infinite `GET /transactions?person_id=`.
- **Info card:**
  - Name, email, phone.
  - Owes Me, I Owe, and the net amount with its label.
  - "Settle Up" button (only when the net is not 0), Edit, Delete.
- **SettleDebtModal:**
  - Shows the amount and direction ("owes you" or "you owe") and explains that a transaction will be created.
  - Fields: Settlement Account (required) and Notes (max 500, placeholder "Settlement with X").
  - Always settles the full amount. Calls `POST /people/:id/settle {amount, account_id, notes}`.
- **Transactions:** local filters and Duplicate.
- **States:**
  - Loading: "Loading person...".
  - Error: "Failed to load person".
  - Not found: "Person not found".

## /reports
- **Data:** `GET /dashboard` and `GET /accounts`.
- **Tabs (the selected tab is not kept in the URL):**
  - **Monthly Report:**
    - Total Income, Total Expenses, Net.
    - Income vs Expenses bar chart.
    - Category pie chart and Top Spending Categories.
    - Daily Spending Trend line chart.
    - Built from dashboard `recent_transactions`, which is only the last 10.
  - **Category Analysis:**
    - Total Categories and Total Spending.
    - Horizontal bar chart of top categories.
    - Breakdown table.
  - **Budget Performance:**
    - Total, On Track, Warning, Exceeded.
    - Overall performance.
    - Budget vs Actual bar chart.
    - Details table.
  - **Net Worth:**
    - Assets (Checking, Savings, Investment, Cash), Liabilities (Credit Card, Loan), Net Worth.
    - Assets vs Liabilities chart.
    - Balances by account type.
    - Account details table.
    - "Net Worth Trend" placeholder text.
- **Error state:** "Error loading reports".
- **Missing:** no date range picker and no export.

## /jobs
- **Data:** `GET /jobs?job_type=`.
- **Type filter:** All, Drift Detection, Bulk Sync, Portfolio Sync, Bank Sync. Not saved in the URL.
- **Job history table:**
  - Columns: Type, Status, Created, Summary.
  - Summary text: "N synced, M drifted" for drift jobs, "x/y ok" for bulk sync, or "Error: ..." for failures.
  - A schedule badge links to `/schedules/:id` when the job came from a schedule.
  - Clicking a row opens `/jobs/:type/:id`.
- **States:**
  - Loading: "Loading jobs...".
  - Error: "Failed to load jobs".
  - Empty: "No jobs yet".
- **Missing:** no pagination.

## /jobs/:type/:id
- **`:type` values:** `drift-detection`, `sync`, `portfolio-sync`, `bank-sync`. Anything else shows "Unknown job type".
- **Header card:** title, status badge, Created / Started / Completed times, and duration.
- **Pending or running:** a progress card. The page polls every 2s.
- **Failed:** an error alert plus a Retry button, which navigates to the new job:
  - Drift: `POST /drift-detection/:id/retry`.
  - Bulk sync: `POST /sync/:id/retry`.
  - Portfolio: `POST /portfolio-sync/:id/retry`.
  - Bank sync has no retry.
- **Drift detection, completed (`GET /drift-detection/:id`):**
  - Summary: Synced, Drifted, Missing on External, Missing on Local.
  - Tabs listing each group of items.
  - "Sync" button (shown when there is something to sync) opens the **SyncWizard**:
    - Step 1, Drifted: checkboxes plus a Push or Pull choice per item, with old → new totals and split differences. Select-all picks Pull.
    - Step 2, Missing on external: checkboxes. These are always pushed.
    - Step 3, Missing locally: checkboxes, and an "Unmapped users" warning. These are always pulled.
    - Step 4, Review: Total, Push and Pull counts and item lists.
    - Steps can be skipped (Back / Skip / Next).
    - Submit calls `POST /sync {items}` and navigates to `/jobs/sync/:id`.
- **Bulk sync, completed (`GET /sync/:id`):**
  - Total, Succeeded, Failed.
  - Table: Action, Item, Detail, Status. Statuses: created, synced, linked, imported, not_applicable, already_linked, pushed, pulled.
  - Retry is available.
- **Portfolio sync, completed (`GET /portfolio-sync/:id`):**
  - Table: Account, Previous Balance, New Value, Adjustment, Status (synced, no_change, failed).
- **Bank sync, completed (`GET /bank-providers` job):**
  - Fetched, New and Already-imported counts, the bank balance, and the list of transactions.
  - "Import" opens ImportStatementModal prefilled with those transactions. Title is "merchant - description". Bank sync metadata is attached.

## /schedules
- **Data:** `GET /schedules`.
- **Schedule cards:**
  - Name and job-type badge.
  - Active switch, which calls `PUT /schedules/:id {is_active}`.
  - Edit and delete buttons.
  - Cron description, "Next: X" (red when overdue), "Last: relative time", and a Paused badge.
  - Clicking a card opens its detail page.
- **Actions:** Create Schedule.
- **Delete:** confirm says "Jobs already created by this schedule will not be affected". Calls `DELETE /schedules/:id`.
- **States:**
  - Loading: "Loading schedules...".
  - Error alert.
  - Empty: "No schedules yet".

### ScheduleFormModal (create/edit)
- **Fields:**
  - Schedule Name: required.
  - Job Type: Drift Detection or Portfolio Sync.
  - Lookback Days: drift only, 1–365, default 7.
  - Cron:
    - Preset buttons: Hourly, Daily, Weekly, Monthly.
    - Or the "Advanced" toggle for a free-text 5-field cron (placeholder `0 0 * * 0`).
- **Validation:** the Save button is disabled until name and cron are both non-empty.
- **Endpoints:** `POST /schedules`, or `PUT /schedules/:id {name, cron_expr, parameters}`.

## /schedules/:id
- **Data:** `GET /schedules/:id`, which returns the schedule, recent_jobs and upcoming_runs.
- **Shows:**
  - Name and Active/Paused badge.
  - Job type, cron description, next run, last run.
  - Parameters and the raw cron expression.
  - Upcoming Runs list.
  - Job history (the same table as the Jobs page).
- **Actions:** Edit (opens ScheduleFormModal).
- **Missing:** no delete, pause or "run now" button on this page.
- **States:**
  - Loading: "Loading schedule...".
  - Errors: "Invalid schedule", "Failed to load schedule", "Schedule not found".

## /trash
- **Data:** infinite `GET /transactions?is_deleted=true`, with a "Load more" button.
- **Subtitle:** "Deleted transactions are permanently removed after 30 days".
- **Each row shows:**
  - Title.
  - Account, "Paid by X" and category badges.
  - Date, "Deleted on X", and the purge date.
  - Amount and debt effect.
- **Actions:**
  - Restore: `POST /transactions/:id/restore`.
  - "Delete Forever" (with confirm): `DELETE /transactions/:id?is_permanent=true`.
- **Empty state:** "No deleted transactions".
- **Missing:** no bulk restore, no "empty trash", no filters.

## /settings
- **Tabs:** profile, preferences, security, split, api-keys, about.
  - The starting tab can be set with `?tab=`. Switching tabs does not update the URL.
  - `?status=connected|error` shows a Splitwise connect toast and then clears the params.
- **Profile:**
  - Username (disabled, "cannot be changed"), Full name, Email, Save.
  - Fake save: nothing is sent to the backend.
- **Preferences:**
  - Default currency.
  - Date format: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD.
  - Number format: en-US, de-DE, fr-FR.
  - Theme: Light/Dark. This is the only setting that actually takes effect.
  - Save is fake.
- **Security:**
  - Change password (current, new, confirm; a mismatch shows a browser `alert()`). Fake.
  - "Enable 2FA (Coming Soon)", disabled.
  - Static "Active Sessions" card.
- **Split:**
  - Data: `GET /integrations/providers`.
  - **Splitwise card:**
    - Connected / Not Connected badge, "Connected since".
    - Connect calls `GET /integrations/splitwise/auth-url` and redirects the browser. The OAuth callback returns to `/settings?tab=split&status=connected`.
    - Disconnect (with confirm) calls `DELETE /integrations/providers/:id`.
  - **SplitPro card:**
    - Connect opens a "Your SplitPro Email" form and calls `POST /integrations/splitpro/connect {email}`.
    - Disconnect (with confirm).
    - Toasts on connect and disconnect.
  - **"Run Drift Detection Job"** opens DriftDetectionModal:
    - Start date (default: first of the month) and end date (default: today). Start must be on or before end.
    - Calls `POST /drift-detection`, then navigates to `/jobs/drift-detection/:id`.
- **API Keys:**
  - List from `GET /api-keys`. Each card shows name, status badge, key prefix, scope summary ("All resources", "N resources" or "No permissions"), expiry and last used, with Edit and Revoke buttons.
  - "New API Key" opens a 2-step modal:
    - Step 1: Name (required) and Expiration (30, 60 or 90 days, or Never; default 30).
    - Step 2: Scopes, Read/Write checkboxes for each of transactions, accounts, budgets, categories and people.
    - Calls `POST /api-keys`.
    - Then shows "API Key Created Successfully": the key is shown once, with a copy button and the warning "You won't be able to see it again".
  - Edit: Name, "Update Expiration" and Scopes. Calls `PATCH /api-keys/:id`.
  - Revoke: confirm says "any applications using this key will lose access immediately". Calls `DELETE /api-keys/:id`.
  - Empty state: "No API keys yet".
- **About:**
  - Version shows a hardcoded "1.0.0".
  - Description, Resources links (all point to `#`), tech-stack badges, "© 2026".

---

## Quirks

### Placeholder, fake and dead UI
- The 404 page is `PlaceholderPage`, with its "will be implemented in {phase}" text.
- Settings Profile save, Preferences save and Change Password are all fake (a timeout plus `console.log`). Preferences are not applied anywhere except the theme.
- 2FA is "Coming Soon". Active Sessions is static.
- About shows a hardcoded version "1.0.0" and the sidebar shows the real one from `GET /version`. All About links point to `#`.
- Net Worth report has a "Net Worth Trend" placeholder.
- The dashboard Net Worth change percentage is hardcoded to 0, so it never shows.
- The Budget card Edit button is disabled, and there is no budget edit anywhere. The budget Notes field is never sent to the backend. The update path (`PUT /budgets/:id` with ranges) never runs.

### Wrong or misleading behavior
- The header title is always "Dashboard", because Layout never passes a title.
- The sidebar Dashboard item links to `/` (which redirects), so its active highlight may not match.
- PageHeader breadcrumbs use a plain `href`, so clicking one reloads the whole page.
- ConfirmDialog closes as soon as you confirm. Its loading state never shows, and any error appears after the dialog is gone.
- Transaction date is built as `${date}T${time}:00Z`, so the local time the user enters is stored as if it were UTC.
- The bank-account sync button is labelled "Sync Portfolio".
- Budgets list is built from dashboard budget_statuses, so any budget without a status is hidden.
- The budget status uses placeholder period and date values, so "days remaining" never shows.
- "Average Usage" is calculated as overall % divided by the budget count, which is wrong.
- Reports "Monthly Report" uses only the last 10 dashboard transactions.
- The Net Worth report adds up balances in different currencies without converting them.
- The People "Debt Overview" is calculated from only the first 50 transactions.
- The CSV preview summary uses the original amounts, not the edited ones.
- Editing any title or amount in the CSV preview drops `bank_sync_metadata` for the whole import.
- The schedule preset "Weekly" (`0 0 * * 1`) is described as "Every Sunday", but it runs Monday.
- The Edit API Key expiration dropdown defaults to "Never". Saving an unrelated edit may send `expires_in_days: null`.
- The TrueLayer callback redirects to `/settings?bank_connected=true`, which the frontend ignores: no toast, and it lands on the Profile tab.
- The account type select is missing GIFT_CARD and DEBT, even though both exist in the enum.
- The split sync badge makes one `GET /splits/:id/sync-status` request per split row.

### Filters and search
- Every transaction filter runs client-side on pages already loaded, and there is no text search. Filters on the detail pages are not saved in the URL. Filters on the Jobs, Reports and Settings tabs are not in the URL either.

### Two HTTP clients
- `services/api.ts` defaults to `http://localhost:8000/api`, has no 401 path guard and no error wrapping.
- `exchangeRateService` and `statementImportService` use it. Everything else uses `lib/axios.ts`.
- `services/queryClient.ts` is an unused duplicate of `lib/queryClient`.
- ReactQueryDevtools is bundled.

### Built but not wired to any UI
- Components: `BankSyncReview` (also `useBankSync`'s selection API and from/to dates), dashboard `SpendingChart` and `AccountSummary`, and `pages/settings/ApiKeys.tsx` (not routed; duplicates the tab).
- Hooks: `usePagination`, `useTableSort`, `useFilters`, `useChartData`, `useSplitCalculator`, `useBudgetStatus`, `useAddBudgetRange`, `usePersonDebts` (`GET /people/:id/debts`), `useCategory` and `usePerson`. The detail pages find the item in the full list instead of calling the single-item endpoints.
- Services: `getApiKey` (`GET /api-keys/:id`).
- The `useExchangeRates` hook itself is unused, though `useCurrencyConverter` calls the service directly.

### Backend capabilities with no UI
- Adding budget ranges, and editing budgets.
- Per-person debt detail.
- Partial settle (the full amount is always used).
- Bank-sync retry.
- A Bank Sync schedule job type.
- Run-now or delete from the schedule detail page.
- Job pagination (`limit` and `offset` exist but the UI doesn't use them).

---

## Summary
1. **Routes:** 21 pages (2 public, 19 protected), plus the `/` redirect and the `*` 404 placeholder. There are no Settings sub-routes; Settings has 6 tabs.
2. **Modals:** 17 distinct ones plus the generic ConfirmDialog (used in about 10 places) and 2 drawers (filters, mobile nav). They are: transaction, transfer, convert-to-transfer, CSV import (3 steps), split mismatch, account, budget, category, person, settle debt, schedule, sync wizard (4 steps), drift detection, create API key (2 steps), key created, edit key, revoke key.
3. **Forms:** about 24, and 3 of them are fake (profile, preferences, password).
4. **Fake Settings:** only the theme preference actually works, and 2FA and sessions are static.
5. **Budget editing is missing:** Edit is disabled, Notes are never sent, and the list hides budgets without a status.
6. **Transactions list:** all filters are client-side on loaded pages and there is no text search. The date/time field saves local time as UTC.
7. **Reports use partial data:** Monthly uses only the last 10 transactions, Net Worth sums currencies without FX, and the trend chart is a placeholder.
8. **Two HTTP clients** with different base URLs and error handling. The TrueLayer callback (`?bank_connected=true`) is not handled.
9. **Mislabels and UI bugs:** the header always says "Dashboard", the bank sync button says "Sync Portfolio", the "Weekly" cron is labelled Sunday but runs Monday, breadcrumbs reload the page, and ConfirmDialog closes before the action finishes.
10. **Unused code:** BankSyncReview, SpendingChart, AccountSummary, the unrouted ApiKeys page, 10 hooks and `getApiKey`. There is no command palette, no onboarding, and no token-expiry handling beyond redirecting to login on a 401.
