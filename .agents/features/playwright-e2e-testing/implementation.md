# Playwright E2E Testing — Implementation Plan

## Phase 1: Project Setup

### Task 1.1: Create `e2e/` directory structure

- Create `e2e/` at project root
- Create subdirectories: `auth/`, `fixtures/`, `helpers/`, `tests/`, `screenshots/baseline/`, `screenshots/actual/`, `screenshots/diff/`

### Task 1.2: Initialize `e2e/package.json`

```json
{
  "name": "master-of-coin-e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test tests/smoke/",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:ui": "playwright test --ui",
    "report": "playwright show-report",
    "screenshot": "playwright test tests/smoke/smoke.spec.ts --grep screenshot",
    "update-snapshots": "playwright test --update-snapshots"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "typescript": "~5.9.3"
  }
}
```

### Task 1.3: Create `e2e/tsconfig.json`

- Extend from base TypeScript config
- Target ES2020, module ESNext
- Include `tests/**/*.ts`, `fixtures/**/*.ts`, `helpers/**/*.ts`

### Task 1.4: Create `e2e/playwright.config.ts`

- baseURL: `http://localhost:13153`
- headless: true
- Single Chromium project
- globalSetup pointing to `global-setup.ts`
- globalTeardown pointing to `global-teardown.ts`
- storageState for authenticated tests
- Screenshot on failure
- Trace on failure
- 1 worker (sequential for DB consistency)
- 30s timeout
- Output directory: `test-results/`

### Task 1.5: Install Playwright and browsers

```bash
cd e2e && npm install && npx playwright install chromium
```

### Task 1.6: Update `.gitignore`

Add entries for:

- `e2e/auth/storage-state.json`
- `e2e/screenshots/actual/`
- `e2e/screenshots/diff/`
- `e2e/test-results/`
- `e2e/node_modules/`
- `e2e/playwright-report/`

---

## Phase 2: Authentication & Setup Infrastructure

### Task 2.1: Create `e2e/global-setup.ts`

- Poll `http://localhost:13153/health` until healthy (max 60s, retry every 2s)
- Launch Chromium browser
- Navigate to `/login`
- Fill email: `test@local.com`, password: `test@password`
- Click Sign In button
- Wait for redirect to `/dashboard`
- Save storage state to `e2e/auth/storage-state.json`
- Close browser

### Task 2.2: Create `e2e/global-teardown.ts`

- Clean up any test artifacts if needed
- (Minimal for now — Docker cleanup is manual)

### Task 2.3: Create `e2e/fixtures/test-fixtures.ts`

- Export custom `test` extending base Playwright test
- `authenticatedPage` fixture — creates browser context with saved storage state
- `screenshotHelper` fixture — provides screenshot capture utilities

---

## Phase 3: Helper Utilities

### Task 3.1: Create `e2e/helpers/auth.ts`

- `login(page, email, password)` — manual login flow for tests that need fresh auth
- `logout(page)` — logout helper
- `getAuthToken()` — extract JWT from storage state

### Task 3.2: Create `e2e/helpers/navigation.ts`

- `goToDashboard(page)`
- `goToAccounts(page)`
- `goToTransactions(page)`
- `goToBudgets(page)`
- `goToCategories(page)`
- `goToPeople(page)`
- `goToReports(page)`
- `goToSettings(page)`
- `waitForPageLoad(page)` — waits for network idle + main content visible

### Task 3.3: Create `e2e/helpers/assertions.ts`

- `expectPageTitle(page, title)` — asserts page header text
- `expectNoConsoleErrors(page)` — collects and asserts no JS errors
- `expectToastMessage(page, message)` — asserts toast notification appeared
- `expectTableRowCount(page, count)` — asserts table has N rows
- `expectFormValidationError(page, fieldName, message)` — asserts form error

### Task 3.4: Create `e2e/helpers/screenshots.ts`

- `capturePageScreenshot(page, name)` — saves to `screenshots/actual/{name}.png`
- `captureElementScreenshot(page, selector, name)` — captures specific element
- `compareWithBaseline(page, name, threshold)` — compares against `screenshots/baseline/{name}.png`

---

## Phase 4: Core Test Suites

### Task 4.1: Create `e2e/tests/smoke/smoke.spec.ts`

Quick smoke tests that verify all major pages load:

- Login page renders
- Dashboard loads after auth
- Accounts page loads
- Transactions page loads
- Budgets page loads
- Categories page loads
- People page loads
- Reports page loads
- Settings page loads
- Each test takes a full-page screenshot for agent verification

### Task 4.2: Create `e2e/tests/auth/login.spec.ts`

- Successful login with valid credentials
- Failed login with wrong password shows error
- Failed login with non-existent email shows error
- Login form validation (empty fields)
- Redirect to intended page after login

### Task 4.3: Create `e2e/tests/dashboard/dashboard.spec.ts`

- Dashboard renders all widgets (net worth, budget progress, category breakdown, recent transactions)
- Dashboard shows correct page header
- Dashboard widgets are interactive (clickable links)
- Screenshot comparison against baseline

### Task 4.4: Create `e2e/tests/accounts/accounts.spec.ts`

- Accounts list page loads
- Create new account (fill form, submit, verify appears in list)
- View account detail
- Edit account
- Delete account
- Account balance displays correctly

### Task 4.5: Create `e2e/tests/transactions/transactions.spec.ts`

- Transactions list page loads
- Create new transaction
- Transaction filters work (by account, category, date range)
- Month navigator works
- Transaction detail view
- Edit transaction
- Delete transaction

### Task 4.6: Create `e2e/tests/budgets/budgets.spec.ts`

- Budgets list page loads
- Create new budget
- Budget progress displays correctly
- Edit budget
- Delete budget

### Task 4.7: Create `e2e/tests/categories/categories.spec.ts`

- Categories list page loads
- Create new category
- Edit category
- Delete category

### Task 4.8: Create `e2e/tests/people/people.spec.ts`

- People list page loads
- Create new person
- View person detail with debt summary
- Edit person
- Delete person

---

## Phase 5: Agent Workflow Integration

### Task 5.1: Create `e2e/verify.sh` convenience script

```bash
#!/bin/bash
# Usage: ./e2e/verify.sh [test-path]
# Rebuilds Docker, runs tests, reports results
set -e
echo "=== Rebuilding Docker stack ==="
docker-compose down
docker-compose build
docker-compose up -d
echo "=== Waiting for app to be healthy ==="
# Health check loop
for i in $(seq 1 30); do
  if curl -s http://localhost:13153/health > /dev/null 2>&1; then
    echo "App is healthy!"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 2
done
echo "=== Running E2E tests ==="
cd e2e
npx playwright test ${1:-}
echo "=== Done ==="
```

### Task 5.2: Create `e2e/take-screenshots.sh` convenience script

```bash
#!/bin/bash
# Takes screenshots of all major pages for agent visual verification
cd e2e
npx playwright test tests/smoke/smoke.spec.ts
echo "Screenshots saved to e2e/screenshots/actual/"
ls -la screenshots/actual/
```

### Task 5.3: Update `.agents/testing/testing-front-end.md`

- Add "Automated Testing with Playwright" section as the primary method for agents
- Document the agent workflow step-by-step
- Keep manual browser testing as supplementary for humans
- Update the checklist to include running E2E tests
- Add agent-specific instructions for writing new tests

### Task 5.4: Create `.agents/rules/e2e-testing-rules.md`

- When to write E2E tests (any UI change)
- How to run tests
- How to take and view screenshots
- How to add new test files
- Test naming conventions
- Common patterns and helpers available

---

## Phase 6: Baseline Screenshots

### Task 6.1: Generate initial baseline screenshots

- Run smoke tests to capture all page screenshots
- Copy from `screenshots/actual/` to `screenshots/baseline/`
- Commit baselines to the repo

---

## Implementation Order

1. Phase 1 (Setup) — Must be done first
2. Phase 2 (Auth infrastructure) — Depends on Phase 1
3. Phase 3 (Helpers) — Depends on Phase 1
4. Phase 4.1 (Smoke tests) — Depends on Phase 2 + 3, do this first as it validates the setup
5. Phase 4.2-4.8 (Feature tests) — Can be done incrementally
6. Phase 5 (Agent workflow) — Can be done in parallel with Phase 4
7. Phase 6 (Baselines) — Done last after all tests pass

## Estimated Effort

- Phase 1-3: ~1 hour (setup and infrastructure)
- Phase 4.1: ~30 min (smoke tests)
- Phase 4.2-4.8: ~2-3 hours (feature tests)
- Phase 5-6: ~30 min (workflow integration)
- **Total: ~4-5 hours**
