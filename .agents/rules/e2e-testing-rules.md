# E2E Testing Rules for Agents

## 🎯 Purpose

This file provides rules and patterns for AI agents writing and running Playwright E2E tests against the Master of Coin application.

## Table of Contents

1. [When to Run E2E Tests](#when-to-run-e2e-tests)
2. [How to Run Tests](#how-to-run-tests)
3. [How to Take and View Screenshots](#how-to-take-and-view-screenshots)
4. [How to Write New Tests](#how-to-write-new-tests)
5. [Test Patterns and Conventions](#test-patterns-and-conventions)
6. [Available Helpers](#available-helpers)
7. [Troubleshooting](#troubleshooting)
8. [Checklist](#checklist)

---

## When to Run E2E Tests

**Run E2E tests whenever you:**

- Modify any React component (`frontend/src/components/**/*.tsx`)
- Modify any page (`frontend/src/pages/**/*.tsx`)
- Change routing (`frontend/src/routes/**`)
- Modify styles or layout
- Change API service calls that affect UI rendering
- Add new UI features

**You do NOT need to run E2E tests when:**

- Only modifying backend Rust code (use backend tests instead)
- Only changing documentation files
- Only changing configuration files that don't affect the UI

---

## How to Run Tests

### Prerequisites

Ensure the Docker stack is running and Playwright is installed:

```bash
# First time setup (only once)
cd e2e && npm install && npx playwright install chromium

# Start Docker stack
docker-compose down && docker-compose build && docker-compose up -d
```

### Running Tests

```bash
# All tests
cd e2e && npx playwright test

# Specific test suite
cd e2e && npx playwright test tests/smoke/
cd e2e && npx playwright test tests/accounts/

# Specific test file
cd e2e && npx playwright test tests/smoke/smoke.spec.ts

# Specific test by name
cd e2e && npx playwright test --grep "dashboard loads"

# Convenience script (rebuilds Docker + runs tests)
./e2e/verify.sh
./e2e/verify.sh --skip-build          # Skip Docker rebuild
./e2e/verify.sh tests/smoke/          # Specific suite
```

### Reading Results

Test output appears in the terminal:

- `✓` = passed
- `✗` = failed (with error details)
- Failed test screenshots are in `e2e/test-results/`

---

## How to Take and View Screenshots

### Taking Screenshots

```bash
# Take screenshots of all pages
cd e2e && npm run screenshot

# Or use the convenience script
./e2e/take-screenshots.sh
```

Screenshots are saved to `e2e/screenshots/actual/`.

### Viewing Screenshots

Use the `read_file` tool on the screenshot PNG files. The agent has vision capabilities and can analyze the images:

```
read_file e2e/screenshots/actual/dashboard.png
read_file e2e/screenshots/actual/accounts.png
```

### Updating Baselines

After verifying screenshots look correct:

```bash
./e2e/take-screenshots.sh --update
```

This copies `screenshots/actual/*.png` → `screenshots/baseline/*.png`.

---

## How to Write New Tests

### File Location

Place tests in the appropriate subdirectory:

```
e2e/tests/
├── smoke/          # Quick page-load tests
├── auth/           # Authentication flows
├── dashboard/      # Dashboard-specific tests
├── accounts/       # Account CRUD
├── transactions/   # Transaction CRUD
├── budgets/        # Budget CRUD
├── categories/     # Category CRUD
└── people/         # People management
```

For a new feature, create a new directory: `e2e/tests/<feature-name>/`

### Test File Template

```typescript
import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  expectPageTitle,
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

const screenshotHelper = new ScreenshotHelper();

test.describe("Feature Name", () => {
  test("page loads correctly", async ({ authenticatedPage }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await authenticatedPage.goto("/feature-path");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Expected Title");
    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "feature-name",
    );
  });

  test("can perform action", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/feature-path");
    await authenticatedPage.waitForLoadState("networkidle");

    // Interact with the page
    await authenticatedPage.click("text=Button Text");
    await authenticatedPage.fill('input[name="field"]', "value");

    // Assert result
    await expect(
      authenticatedPage.locator("text=Expected Result"),
    ).toBeVisible();
  });
});
```

### Adding a New Page to Smoke Tests

Edit `e2e/tests/smoke/smoke.spec.ts` and add to the `pages` array:

```typescript
const pages: [string, string, string][] = [
  // ... existing pages ...
  ["/new-page", "New Page Title", "new-page"], // Add this line
];
```

---

## Test Patterns and Conventions

### Naming Conventions

- **Test files:** `<feature>.spec.ts` (e.g., `accounts.spec.ts`)
- **Test descriptions:** Use clear, action-oriented names
  - ✅ `'can create a new account'`
  - ✅ `'accounts page loads with correct title'`
  - ❌ `'test1'`
  - ❌ `'it works'`
- **Screenshot names:** kebab-case (e.g., `accounts-list`, `dashboard-full`)

### Common Selectors

The app uses Chakra UI v3. Common selectors:

| Element            | Selector                                              |
| ------------------ | ----------------------------------------------------- |
| Page title (h1)    | `page.locator('h1').first()`                          |
| Named input        | `page.locator('input[name="fieldName"]')`             |
| Named select       | `page.locator('select[name="fieldName"]')`            |
| Button by text     | `page.locator('button').filter({ hasText: /text/i })` |
| Dialog/Modal       | `page.locator('[role="dialog"]')`                     |
| Sidebar nav link   | `page.click('nav >> text=LinkText')`                  |
| Toast notification | `page.locator('[data-scope="toast"]')`                |
| Alert              | `page.locator('[role="alert"]')`                      |

### Wait Strategies

```typescript
// Wait for network requests to complete
await page.waitForLoadState("networkidle");

// Wait for specific element
await expect(page.locator("text=Expected")).toBeVisible({ timeout: 10_000 });

// Wait for URL change
await page.waitForURL("**/expected-path", { timeout: 10_000 });

// Wait for animations to settle
await page.waitForTimeout(500);
```

### CRUD Test Pattern

```typescript
test.describe("Feature CRUD", () => {
  test("list page loads", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/feature");
    await expectPageTitle(authenticatedPage, "Feature");
  });

  test("can create item", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/feature");
    await authenticatedPage.click("text=Add Item");
    await authenticatedPage.fill('input[name="name"]', "Test Item");
    await authenticatedPage.click('button:has-text("Create")');
    await expect(authenticatedPage.locator("text=Test Item")).toBeVisible();
  });

  test("can open and close modal", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/feature");
    await authenticatedPage.click("text=Add Item");
    await expect(authenticatedPage.locator('[role="dialog"]')).toBeVisible();
    await authenticatedPage.click("text=Cancel");
    await expect(authenticatedPage.locator('[role="dialog"]')).toBeHidden();
  });
});
```

---

## Available Helpers

### Fixtures (`e2e/fixtures/test-fixtures.ts`)

| Fixture             | Description                                           |
| ------------------- | ----------------------------------------------------- |
| `authenticatedPage` | Page with pre-loaded auth state (JWT in localStorage) |
| `screenshotHelper`  | Screenshot capture and management utility             |

### Auth Helpers (`e2e/helpers/auth.ts`)

| Function                         | Description                  |
| -------------------------------- | ---------------------------- |
| `login(page, email?, password?)` | Manual login flow            |
| `logout(page)`                   | Clear auth and go to login   |
| `getAuthToken(page)`             | Get JWT from localStorage    |
| `isAuthenticated(page)`          | Check if page has auth token |

### Navigation Helpers (`e2e/helpers/navigation.ts`)

| Function                         | Description               |
| -------------------------------- | ------------------------- |
| `goToDashboard(page)`            | Navigate to /dashboard    |
| `goToAccounts(page)`             | Navigate to /accounts     |
| `goToTransactions(page)`         | Navigate to /transactions |
| `goToBudgets(page)`              | Navigate to /budgets      |
| `goToCategories(page)`           | Navigate to /categories   |
| `goToPeople(page)`               | Navigate to /people       |
| `goToReports(page)`              | Navigate to /reports      |
| `goToSettings(page)`             | Navigate to /settings     |
| `goToJobs(page)`                 | Navigate to /jobs         |
| `goToSchedules(page)`            | Navigate to /schedules    |
| `waitForPageLoad(page)`          | Wait for network idle     |
| `navigateViaSidebar(page, text)` | Click sidebar link        |

### Assertion Helpers (`e2e/helpers/assertions.ts`)

| Function                                      | Description                     |
| --------------------------------------------- | ------------------------------- |
| `expectPageTitle(page, title)`                | Assert h1/h2 contains title     |
| `collectConsoleErrors(page)`                  | Start collecting console errors |
| `expectNoConsoleErrors(errors)`               | Assert no JS errors occurred    |
| `expectToastMessage(page, msg)`               | Assert toast notification       |
| `expectTableRowCount(page, n)`                | Assert table has n rows         |
| `expectFormValidationError(page, field, msg)` | Assert form error               |
| `waitForLoadingToComplete(page)`              | Wait for spinner to disappear   |
| `expectEmptyState(page, msg?)`                | Assert empty state shown        |
| `expectErrorAlert(page, msg)`                 | Assert error alert shown        |

### Screenshot Helpers (`e2e/helpers/screenshots.ts`)

| Method                                    | Description              |
| ----------------------------------------- | ------------------------ |
| `capturePageScreenshot(page, name)`       | Full-page screenshot     |
| `captureElementScreenshot(locator, name)` | Element screenshot       |
| `captureViewportScreenshot(page, name)`   | Viewport-only screenshot |
| `hasBaseline(name)`                       | Check if baseline exists |
| `updateBaseline(name)`                    | Copy actual → baseline   |
| `listBaselines()`                         | List all baseline files  |
| `listActuals()`                           | List all actual files    |

---

## Troubleshooting

### Tests fail with "App did not become healthy"

The Docker stack isn't running or hasn't finished starting:

```bash
docker-compose up -d
docker-compose logs server  # Check for errors
```

### Tests fail with "Login failed"

The test user may not exist. Check if the database has been seeded:

```bash
docker-compose logs server | grep "seed"
```

### Tests fail with timeout errors

Increase timeouts in `e2e/playwright.config.ts` or in specific tests:

```typescript
await expect(element).toBeVisible({ timeout: 15_000 });
```

### Screenshots are blank or show loading spinners

Add longer waits before capturing:

```typescript
await page.waitForLoadState("networkidle");
await page.waitForTimeout(2000); // Wait for animations
await screenshotHelper.capturePageScreenshot(page, "name");
```

### TypeScript errors in IDE

Run `cd e2e && npm install` to install Playwright types.

---

## Checklist

Before committing UI changes, verify:

- [ ] Docker stack rebuilt and running
- [ ] Smoke tests pass: `cd e2e && npx playwright test tests/smoke/`
- [ ] Relevant feature tests pass
- [ ] Screenshots captured and visually verified
- [ ] No console errors in test output
- [ ] New tests written for new features/pages
- [ ] Test names are descriptive and follow conventions
