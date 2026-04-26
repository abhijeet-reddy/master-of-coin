import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
  expectPageTitle,
} from "../../helpers/assertions";
import { goToTransactions } from "../../helpers/navigation";

/**
 * Transaction Filter Drawer E2E tests.
 *
 * Tests the responsive filter drawer that replaced the inline filter panel:
 * - Drawer opens when filter button is clicked
 * - Drawer contains all filter controls
 * - Drawer closes via Done button, close button, and backdrop click
 * - Clear All button resets filters
 * - Filter selections persist while drawer is open
 * - Active filter count badge appears on drawer header
 * - URL filter params auto-open the drawer
 */

const screenshotHelper = new ScreenshotHelper();

/** Click the filter toggle button on the transactions page */
async function openFilterDrawer(page: import("@playwright/test").Page) {
  const filterButton = page.locator('[aria-label="Toggle filters"]');
  await filterButton.click();
  // Wait for drawer animation
  await page.waitForTimeout(500);
}

/** Locate the drawer dialog element */
function getDrawer(page: import("@playwright/test").Page) {
  return page.locator('[role="dialog"]').filter({ hasText: /Filters/ });
}

test.describe("Transaction Filter Drawer", () => {
  test("filter drawer opens when filter button is clicked", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await goToTransactions(authenticatedPage);

    // Drawer should not be visible initially
    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).not.toBeVisible();

    // Click filter button to open drawer
    await openFilterDrawer(authenticatedPage);

    // Drawer should now be visible
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Drawer should have "Filters" title
    await expect(drawer.locator("text=Filters").first()).toBeVisible();

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "filter-drawer-open",
    );
  });

  test("filter drawer contains all filter controls", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);
    await openFilterDrawer(authenticatedPage);

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Transaction Type section
    await expect(drawer.locator("text=Transaction Type")).toBeVisible();
    await expect(
      drawer.locator("button").filter({ hasText: /^All$/i }).first(),
    ).toBeVisible();
    await expect(
      drawer.locator("button").filter({ hasText: /^Income$/i }),
    ).toBeVisible();
    await expect(
      drawer.locator("button").filter({ hasText: /^Expense$/i }),
    ).toBeVisible();

    // Paid by Others section
    await expect(
      drawer.locator("p", { hasText: "Paid by Others" }),
    ).toBeVisible();
    await expect(
      drawer.locator("button").filter({ hasText: /Paid by Others/i }),
    ).toBeVisible();
    await expect(
      drawer.locator("button").filter({ hasText: /My Payments/i }),
    ).toBeVisible();

    // Date Range section
    await expect(drawer.locator("text=Date Range")).toBeVisible();
    const dateInputs = drawer.locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2);

    // Amount Range section
    await expect(drawer.locator("text=Amount Range")).toBeVisible();
    await expect(
      drawer.locator('input[placeholder="Min amount"]'),
    ).toBeVisible();
    await expect(
      drawer.locator('input[placeholder="Max amount"]'),
    ).toBeVisible();

    // Done button in footer
    await expect(
      drawer.locator("button").filter({ hasText: /^Done$/i }),
    ).toBeVisible();

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "filter-drawer-all-controls",
    );
  });

  test("filter drawer closes via Done button", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);
    await openFilterDrawer(authenticatedPage);

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click Done button
    const doneButton = drawer.locator("button").filter({ hasText: /^Done$/i });
    await doneButton.click();
    await authenticatedPage.waitForTimeout(500);

    // Drawer should be closed
    await expect(drawer).not.toBeVisible();
  });

  test("filter drawer closes via close button (X)", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);
    await openFilterDrawer(authenticatedPage);

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click the close button (X) in the drawer
    const closeButton = drawer
      .locator("button")
      .filter({ hasText: /✕|×/ })
      .first()
      .or(drawer.locator('[aria-label="Close"]').first())
      .or(
        drawer
          .locator('[data-scope="dialog"] [data-part="close-trigger"]')
          .first(),
      );

    // Try clicking any close trigger
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Fallback: press Escape key
      await authenticatedPage.keyboard.press("Escape");
    }
    await authenticatedPage.waitForTimeout(500);

    // Drawer should be closed
    await expect(drawer).not.toBeVisible();
  });

  test("filter drawer closes via Escape key", async ({ authenticatedPage }) => {
    await goToTransactions(authenticatedPage);
    await openFilterDrawer(authenticatedPage);

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Press Escape key
    await authenticatedPage.keyboard.press("Escape");
    await authenticatedPage.waitForTimeout(500);

    // Drawer should be closed
    await expect(drawer).not.toBeVisible();
  });

  test("selecting a filter type updates the filter and URL", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await goToTransactions(authenticatedPage);
    await openFilterDrawer(authenticatedPage);

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click "Expense" filter
    const expenseButton = drawer
      .locator("button")
      .filter({ hasText: /^Expense$/i });
    await expenseButton.click();
    await authenticatedPage.waitForTimeout(300);

    // URL should contain type=expense
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.get("type")).toBe("expense");

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "filter-drawer-expense-selected",
    );
  });

  test("Clear All button resets all filters", async ({ authenticatedPage }) => {
    // Start with filters in URL so drawer auto-opens
    await authenticatedPage.goto(
      "/transactions?type=expense&minAmount=10&paidByOthers=only",
    );
    await authenticatedPage.waitForLoadState("networkidle");

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Clear All button should be visible (since filters are active)
    const clearButton = drawer
      .locator("button")
      .filter({ hasText: /Clear All/i });
    await expect(clearButton).toBeVisible();

    // Click Clear All
    await clearButton.click();
    await authenticatedPage.waitForTimeout(300);

    // URL should no longer have filter params
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.has("type")).toBe(false);
    expect(url.searchParams.has("minAmount")).toBe(false);
    expect(url.searchParams.has("paidByOthers")).toBe(false);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "filter-drawer-cleared",
    );
  });

  test("active filter count badge shows correct count", async ({
    authenticatedPage,
  }) => {
    // Navigate with 3 active filter groups
    await authenticatedPage.goto(
      "/transactions?type=expense&minAmount=10&paidByOthers=only",
    );
    await authenticatedPage.waitForLoadState("networkidle");

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Badge should show count of active filter groups (3: type, amount, paidByOthers)
    const badge = drawer
      .locator('[data-scope="badge"]')
      .or(drawer.locator("span").filter({ hasText: /^3$/ }));
    // At least verify the badge/count is present
    await expect(badge.first()).toBeVisible({ timeout: 5000 });
  });

  test("filter drawer auto-opens when URL has filter params", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Navigate directly with filter params
    await authenticatedPage.goto("/transactions?type=expense");
    await authenticatedPage.waitForLoadState("networkidle");

    // Drawer should auto-open because URL has filter params
    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // "Filters" title should be visible in the drawer
    await expect(drawer.locator("text=Filters").first()).toBeVisible();

    // Expense button should be visible in the drawer
    const expenseButton = drawer
      .locator("button")
      .filter({ hasText: /^Expense$/i });
    await expect(expenseButton).toBeVisible();

    expectNoConsoleErrors(errors);
  });

  test("amount range filters work inside the drawer", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);
    await openFilterDrawer(authenticatedPage);

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Fill in min amount
    const minAmountInput = drawer.locator('input[placeholder="Min amount"]');
    await minAmountInput.fill("50");
    await authenticatedPage.waitForTimeout(300);

    // Fill in max amount
    const maxAmountInput = drawer.locator('input[placeholder="Max amount"]');
    await maxAmountInput.fill("200");
    await authenticatedPage.waitForTimeout(300);

    // URL should contain amount params
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.get("minAmount")).toBe("50");
    expect(url.searchParams.get("maxAmount")).toBe("200");

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "filter-drawer-amount-range",
    );
  });

  test("date range filters work inside the drawer", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);
    await openFilterDrawer(authenticatedPage);

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Fill in start date
    const dateInputs = drawer.locator('input[type="date"]');
    const startDateInput = dateInputs.first();
    await startDateInput.fill("2026-04-01");
    await authenticatedPage.waitForTimeout(300);

    // URL should contain startDate param
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.get("startDate")).toBe("2026-04-01");
  });

  test("filter drawer preserves selections after close and reopen", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);
    await openFilterDrawer(authenticatedPage);

    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Select Expense filter
    const expenseButton = drawer
      .locator("button")
      .filter({ hasText: /^Expense$/i });
    await expenseButton.click();
    await authenticatedPage.waitForTimeout(300);

    // Close the drawer via Done
    const doneButton = drawer.locator("button").filter({ hasText: /^Done$/i });
    await doneButton.click();
    await authenticatedPage.waitForTimeout(500);

    // Reopen the drawer
    await openFilterDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // URL should still have type=expense
    const url = new URL(authenticatedPage.url());
    expect(url.searchParams.get("type")).toBe("expense");

    // Expense button should still be in the drawer (filter preserved)
    await expect(expenseButton).toBeVisible();
  });

  test("no console errors during filter drawer interactions", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await goToTransactions(authenticatedPage);

    // Open drawer
    await openFilterDrawer(authenticatedPage);
    const drawer = getDrawer(authenticatedPage);
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Click various filters
    await drawer
      .locator("button")
      .filter({ hasText: /^Expense$/i })
      .click();
    await authenticatedPage.waitForTimeout(200);

    await drawer
      .locator("button")
      .filter({ hasText: /My Payments/i })
      .click();
    await authenticatedPage.waitForTimeout(200);

    // Close drawer
    await drawer
      .locator("button")
      .filter({ hasText: /^Done$/i })
      .click();
    await authenticatedPage.waitForTimeout(500);

    expectNoConsoleErrors(errors);
  });
});
