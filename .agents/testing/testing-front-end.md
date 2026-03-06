# Frontend Testing Guidelines

## 🚨 NON-NEGOTIABLE REQUIREMENT

**ALL UI changes MUST be tested before committing.**

For AI agents: Use the automated Playwright E2E testing workflow (primary method).
For humans: Use either Playwright tests or manual browser testing.

---

## 🤖 Automated Testing with Playwright (Primary — For Agents)

### Overview

The project includes a full Playwright E2E testing suite in the `e2e/` directory. This enables AI agents to autonomously verify UI changes by running headless browser tests and viewing screenshots.

### Prerequisites

- Docker and Docker Compose installed
- Node.js installed locally
- Playwright browsers installed: `cd e2e && npm install && npx playwright install chromium`

### Quick Start — Agent Workflow

#### 1. After making UI changes, rebuild and start Docker:

```bash
docker-compose down && docker-compose build && docker-compose up -d
```

#### 2. Run all E2E tests:

```bash
cd e2e && npx playwright test
```

#### 3. Run specific test suites:

```bash
cd e2e && npx playwright test tests/smoke/          # Quick smoke tests
cd e2e && npx playwright test tests/auth/            # Auth flow tests
cd e2e && npx playwright test tests/dashboard/       # Dashboard tests
cd e2e && npx playwright test tests/accounts/        # Account CRUD tests
cd e2e && npx playwright test tests/transactions/    # Transaction tests
cd e2e && npx playwright test tests/budgets/         # Budget tests
cd e2e && npx playwright test tests/categories/      # Category tests
cd e2e && npx playwright test tests/people/          # People tests
```

#### 4. Take screenshots for visual verification:

```bash
cd e2e && npm run screenshot
```

Screenshots are saved to `e2e/screenshots/actual/`. The agent can view these image files to visually confirm the UI looks correct.

#### 5. One-liner convenience script:

```bash
./e2e/verify.sh                        # Full rebuild + all tests
./e2e/verify.sh tests/smoke/           # Full rebuild + smoke tests only
./e2e/verify.sh --skip-build           # Skip rebuild (if Docker is already running)
./e2e/verify.sh --skip-build tests/smoke/  # Skip rebuild + specific tests
```

### What the Tests Verify

| Test Suite            | What It Checks                                              |
| --------------------- | ----------------------------------------------------------- |
| `tests/smoke/`        | All pages load, no console errors, sidebar navigation works |
| `tests/auth/`         | Login/logout flows, error handling, redirect behavior       |
| `tests/dashboard/`    | Dashboard widgets render, correct title and subtitle        |
| `tests/accounts/`     | Account list, create/edit/delete, form modal                |
| `tests/transactions/` | Transaction list, month navigator, filters, form modal      |
| `tests/budgets/`      | Budget list, create modal, progress display                 |
| `tests/categories/`   | Category list, create modal                                 |
| `tests/people/`       | People list, create modal, debt summary                     |

### Reading Test Results

**Pass/Fail output** appears directly in the terminal:

```
  ✓ Dashboard page loads at /dashboard (2.1s)
  ✓ Accounts page loads at /accounts (1.8s)
  ✗ Transactions page loads at /transactions (5.0s)
    Error: Expected "Transactions" to be visible
```

**Failed test screenshots** are automatically saved to `e2e/test-results/`.

**HTML report** (for detailed analysis):

```bash
cd e2e && npx playwright show-report
```

### Writing New Tests

When adding new UI features, create or update tests following these patterns:

1. **New page?** Add it to `e2e/tests/smoke/smoke.spec.ts` pages array
2. **New CRUD feature?** Create `e2e/tests/<feature>/<feature>.spec.ts`
3. **Use the `authenticatedPage` fixture** for tests that need login
4. **Take screenshots** for visual verification: `screenshotHelper.capturePageScreenshot(page, 'name')`
5. **Check console errors** with `collectConsoleErrors()` / `expectNoConsoleErrors()`

See `.agents/rules/e2e-testing-rules.md` for detailed patterns and conventions.

### Agent Testing Checklist

Before committing frontend changes:

- [ ] Docker containers rebuilt with latest changes (`docker-compose build`)
- [ ] Application starts without errors (`docker-compose up -d`)
- [ ] Smoke tests pass (`cd e2e && npx playwright test tests/smoke/`)
- [ ] Relevant feature tests pass (e.g., `tests/accounts/` for account changes)
- [ ] Screenshots captured and visually verified for changed pages
- [ ] No console errors in test output
- [ ] New tests written for any new UI features or pages

---

## 🐳 Manual Browser Testing (Supplementary — For Humans)

### Prerequisites

- Docker and Docker Compose installed
- Project repository cloned locally

### Testing Workflow

1. **Stop any running containers:**

   ```bash
   docker-compose down
   ```

2. **Rebuild the containers with your changes:**

   ```bash
   docker-compose build
   ```

3. **Start the application:**

   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Open your browser
   - Navigate to `http://localhost:13153`

5. **Login with test credentials:**
   - **Email:** `test@local.com`
   - **Password:** `test@password`

### What to Test

When testing UI changes, verify:

- ✅ **Visual Appearance:** Does the UI look correct across different screen sizes?
- ✅ **Functionality:** Do all interactive elements work as expected?
- ✅ **Navigation:** Can users navigate between pages without issues?
- ✅ **Forms:** Do forms submit correctly and show appropriate validation?
- ✅ **Data Display:** Is data rendered correctly from the backend?
- ✅ **Error Handling:** Are errors displayed appropriately to users?
- ✅ **Responsive Design:** Does the UI work on mobile, tablet, and desktop viewports?
- ✅ **Browser Console:** Are there any JavaScript errors or warnings?
- ✅ **Network Tab:** Are API calls succeeding and returning expected data?

### Browser Testing Checklist

Before committing frontend changes:

- [ ] Docker containers rebuilt with latest changes
- [ ] Application starts without errors
- [ ] Successfully logged in with test credentials
- [ ] All modified components/pages tested manually
- [ ] Tested on at least one modern browser (Chrome, Firefox, Safari, or Edge)
- [ ] No console errors or warnings
- [ ] All interactive features work as expected
- [ ] Responsive design verified (if applicable)
- [ ] Cross-browser compatibility checked (if significant changes)

## 🔄 Quick Test Cycle

For rapid iteration during development:

```bash
# One-liner to restart with fresh build
docker-compose down && docker-compose build && docker-compose up
```

## 📝 Notes

- The test account credentials are hardcoded for local development testing
- Always test with a clean browser session or incognito mode to avoid cache issues
- Document any browser-specific issues you encounter
- The application runs on port 13153 in the Docker environment

## ⚠️ Remember

**No UI changes should be committed without testing. This ensures quality and prevents broken user experiences from reaching the codebase.**
