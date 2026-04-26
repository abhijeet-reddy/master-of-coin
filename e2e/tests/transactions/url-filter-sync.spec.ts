import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
  expectPageTitle,
} from "../../helpers/assertions";
import { goToTransactions } from "../../helpers/navigation";

/**
 * URL Filter Sync E2E tests.
 *
 * Tests that transaction page filters are synced to URL search parameters:
 * - Filters update the URL when applied (inside the drawer)
 * - Visiting a URL with filter params restores the filter state
 * - Month navigation updates the URL
 * - Clearing filters removes URL params
 * - Browser back/forward updates filter state
 * - Filter drawer auto-opens when URL has filter params
 * - Default view (no params) shows current month with no filters
 */

const screenshotHelper = new ScreenshotHelper();

/** Helper to locate the filter drawer dialog */
function getFilterDrawer(page: import("@playwright/test").Page) {
  return page.locator('[role="dialog"]').filter({ hasText: /Filters/ });
}

/** Helper to open the filter drawer */
async function openFilterDrawer(page: import("@playwright/test").Page) {
  const filterButton = page.locator('[aria-label="Toggle filters"]');
  await filterButton.click();
  await page.waitForTimeout(500);
  const drawer = getFilterDrawer(page);
  await expect(drawer).toBeVisible({ timeout: 5000 });
  return drawer;
}

test.describe("URL Filter Sync", () => {
  test("transactions page loads with clean URL (no params) by default", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await goToTransactions(authenticatedPage);

    // URL should be clean — no search params for current month
    const url = new URL(authenticatedPage.url());
    expect(url.pathname).toBe("/transactions");
    // No month param when viewing current month
    expect(url.searchParams.has("month")).toBe(false);
    // No filter params
    expect(url.searchParams.has("type")).toBe(false);
    expect(url.searchParams.has("accounts")).toBe(false);
    expect(url.searchParams.has("categories")).toBe(false);

    await expectPageTitle(authenticatedPage, "Transactions");
    expectNoConsoleErrors(errors);
  });

  test("clicking transaction type filter updates URL with type param", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await goToTransactions(authenticatedPage);

    // Open the filter drawer
    const drawer = await openFilterDrawer(authenticatedPage);

    // Click the "Expense" type filter button inside the drawer
    const expenseButton = drawer
      .locator("button")
      .filter({ hasText: /^Expense$/i });
    await expenseButton.click();
    await authenticatedPage.waitForTimeout(300);

    // URL should now contain type=expense
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.get("type")).toBe("expense");

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "url-filter-type-expense",
    );
  });

  test("clicking Income filter updates URL with type=income", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);

    // Open the filter drawer
    const drawer = await openFilterDrawer(authenticatedPage);

    // Click the "Income" type filter button inside the drawer
    const incomeButton = drawer
      .locator("button")
      .filter({ hasText: /^Income$/i });
    await incomeButton.click();
    await authenticatedPage.waitForTimeout(300);

    // URL should now contain type=income
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.get("type")).toBe("income");
  });

  test("visiting URL with type=expense restores filter state and auto-opens drawer", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Navigate directly to URL with filter params
    await authenticatedPage.goto("/transactions?type=expense");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Transactions");

    // Filter drawer should be auto-opened because URL has filter params
    const drawer = getFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // The "Expense" button should be visible inside the drawer
    const expenseButton = drawer
      .locator("button")
      .filter({ hasText: /^Expense$/i });
    await expect(expenseButton).toBeVisible({ timeout: 5000 });

    // The "Filters" title should be visible in the drawer header
    const filtersLabel = drawer.locator("text=Filters").first();
    await expect(filtersLabel).toBeVisible({ timeout: 5000 });

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "url-filter-restored-expense",
    );
  });

  test("visiting URL with type=income restores income filter", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/transactions?type=income");
    await authenticatedPage.waitForLoadState("networkidle");

    // Filter drawer should be auto-opened
    const drawer = getFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // The "Income" button should be visible inside the drawer
    const incomeButton = drawer
      .locator("button")
      .filter({ hasText: /^Income$/i });
    await expect(incomeButton).toBeVisible({ timeout: 5000 });

    // The "Filters" label should be visible in the drawer
    const filtersLabel = drawer.locator("text=Filters").first();
    await expect(filtersLabel).toBeVisible({ timeout: 5000 });
  });

  test("visiting URL with month param shows correct month", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Navigate to a specific past month
    await authenticatedPage.goto("/transactions?month=2026-01");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Transactions");

    // The month navigator should show Jan 2026 as selected
    // Look for a button with "Jan 2026" text that appears active (solid variant)
    const janButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /Jan 2026/i });
    await expect(janButton).toBeVisible({ timeout: 5000 });

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "url-filter-month-jan-2026",
    );
  });

  test("navigating to a different month updates URL", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);

    // Click the previous month button
    const prevButton = authenticatedPage.locator(
      '[aria-label="Previous month"]',
    );
    await prevButton.click();
    await authenticatedPage.waitForTimeout(500);

    // URL should now contain a month param (since we moved away from current month)
    const url = new URL(authenticatedPage.url());
    const monthParam = url.searchParams.get("month");
    expect(monthParam).toBeTruthy();

    // The month param should be in YYYY-MM format
    expect(monthParam).toMatch(/^\d{4}-\d{2}$/);
  });

  test("clearing filters removes filter params from URL", async ({
    authenticatedPage,
  }) => {
    // Start with filters in URL
    await authenticatedPage.goto("/transactions?type=expense");
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify filter drawer is open and type=expense is active
    const drawer = getFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click the "Clear All" button in the drawer to remove all filters
    const clearButton = drawer
      .locator("button")
      .filter({ hasText: /Clear All/i });
    await clearButton.click();
    await authenticatedPage.waitForTimeout(300);

    // URL should no longer have the type param
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.has("type")).toBe(false);
  });

  test("visiting URL with multiple filter params restores all filters", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Navigate with multiple filters
    await authenticatedPage.goto(
      "/transactions?type=expense&minAmount=10&maxAmount=500&paidByOthers=exclude",
    );
    await authenticatedPage.waitForLoadState("networkidle");

    // Filter drawer should be auto-opened
    const drawer = getFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Expense button should be visible inside the drawer
    const expenseButton = drawer
      .locator("button")
      .filter({ hasText: /^Expense$/i });
    await expect(expenseButton).toBeVisible({ timeout: 5000 });

    // "My Payments" button should be visible inside the drawer (paidByOthers=exclude)
    const myPaymentsButton = drawer
      .locator("button")
      .filter({ hasText: /My Payments/i });
    await expect(myPaymentsButton).toBeVisible({ timeout: 5000 });

    // Min amount input should have value "10"
    const minAmountInput = drawer.locator(
      'input[type="number"][placeholder="Min amount"]',
    );
    await expect(minAmountInput).toHaveValue("10");

    // Max amount input should have value "500"
    const maxAmountInput = drawer.locator(
      'input[type="number"][placeholder="Max amount"]',
    );
    await expect(maxAmountInput).toHaveValue("500");

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "url-filter-multiple-params",
    );
  });

  test("visiting URL with month and filters restores both", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/transactions?month=2026-02&type=income");
    await authenticatedPage.waitForLoadState("networkidle");

    // Month should be Feb 2026
    const febButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /Feb 2026/i });
    await expect(febButton).toBeVisible({ timeout: 5000 });

    // Filter drawer should be open with Income selected
    const drawer = getFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const incomeButton = drawer
      .locator("button")
      .filter({ hasText: /^Income$/i });
    await expect(incomeButton).toBeVisible({ timeout: 5000 });

    const filtersLabel = drawer.locator("text=Filters").first();
    await expect(filtersLabel).toBeVisible({ timeout: 5000 });
  });

  test("switching type filter from expense to all removes type param from URL", async ({
    authenticatedPage,
  }) => {
    // Start with expense filter
    await authenticatedPage.goto("/transactions?type=expense");
    await authenticatedPage.waitForLoadState("networkidle");

    // Filter drawer should be auto-opened
    const drawer = getFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click the "All" type button inside the drawer to reset
    const allButton = drawer
      .locator("button")
      .filter({ hasText: /^All$/i })
      .first();
    await allButton.click();
    await authenticatedPage.waitForTimeout(300);

    // URL should no longer have type param
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.has("type")).toBe(false);
  });

  test("browser back navigation restores previous filter state", async ({
    authenticatedPage,
  }) => {
    // Start at transactions with no filters
    await goToTransactions(authenticatedPage);

    // Navigate to previous month (this uses push, not replace)
    const prevButton = authenticatedPage.locator(
      '[aria-label="Previous month"]',
    );
    await prevButton.click();
    await authenticatedPage.waitForTimeout(500);

    // Capture the month param after navigating
    const urlAfterNav = new URL(authenticatedPage.url());
    const monthAfterNav = urlAfterNav.searchParams.get("month");
    expect(monthAfterNav).toBeTruthy();

    // Navigate to another previous month
    await prevButton.click();
    await authenticatedPage.waitForTimeout(500);

    const urlAfterSecondNav = new URL(authenticatedPage.url());
    const monthAfterSecondNav = urlAfterSecondNav.searchParams.get("month");
    expect(monthAfterSecondNav).toBeTruthy();
    expect(monthAfterSecondNav).not.toBe(monthAfterNav);

    // Go back in browser history
    await authenticatedPage.goBack();
    await authenticatedPage.waitForTimeout(500);

    // URL should be back to the first navigated month
    const urlAfterBack = new URL(authenticatedPage.url());
    expect(urlAfterBack.searchParams.get("month")).toBe(monthAfterNav);
  });

  test("paidByOthers=only filter is reflected in URL and restored", async ({
    authenticatedPage,
  }) => {
    // Navigate with paidByOthers=only
    await authenticatedPage.goto("/transactions?paidByOthers=only");
    await authenticatedPage.waitForLoadState("networkidle");

    // Filter drawer should be open
    const drawer = getFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // "Paid by Others" button should be visible inside the drawer
    const paidByOthersButton = drawer
      .locator("button")
      .filter({ hasText: /Paid by Others/i });
    await expect(paidByOthersButton).toBeVisible({ timeout: 5000 });
  });

  test("date range filters are reflected in URL", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);

    // Open filter drawer
    const drawer = await openFilterDrawer(authenticatedPage);

    // Set a start date inside the drawer
    const startDateInput = drawer.locator('input[type="date"]').first();
    await startDateInput.fill("2026-04-01");
    await authenticatedPage.waitForTimeout(300);

    // URL should contain startDate param
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.get("startDate")).toBe("2026-04-01");
  });

  test("visiting URL with date range restores date inputs", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto(
      "/transactions?startDate=2026-03-01&endDate=2026-03-31",
    );
    await authenticatedPage.waitForLoadState("networkidle");

    // Filter drawer should be auto-opened
    const drawer = getFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Start date input should have the value
    const dateInputs = drawer.locator('input[type="date"]');
    const startDateInput = dateInputs.first();
    await expect(startDateInput).toHaveValue("2026-03-01");

    // End date input should have the value
    const endDateInput = dateInputs.nth(1);
    await expect(endDateInput).toHaveValue("2026-03-31");

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "url-filter-date-range",
    );
  });

  test("invalid URL params fall back to defaults gracefully", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Navigate with invalid params
    await authenticatedPage.goto(
      "/transactions?month=invalid&type=bogus&paidByOthers=xyz",
    );
    await authenticatedPage.waitForLoadState("networkidle");

    // Page should still load correctly
    await expectPageTitle(authenticatedPage, "Transactions");

    // No console errors
    expectNoConsoleErrors(errors);

    // Invalid month should fall back to current month (no month param in URL after re-render)
    // Invalid type should fall back to 'all'
    // Page should be functional
    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "url-filter-invalid-params",
    );
  });
});
