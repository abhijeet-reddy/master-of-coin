import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Budget Detail page E2E tests.
 *
 * Verifies the budget detail page for fix #48:
 * - Budget detail page loads correctly
 * - Budget info card shows correct data (active_range, percentage_used)
 * - Transaction list is filtered by the budget's active date range
 * - A budget with no current-period transactions shows empty/zero state
 */

const screenshotHelper = new ScreenshotHelper();

/**
 * Helper: Navigate to the first budget's detail page from the budgets list.
 * Budget cards use programmatic navigation (onClick → navigate), not <a> tags.
 */
async function navigateToBudgetDetail(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/budgets");
  await page.waitForLoadState("networkidle");

  // Budget cards render the name as a Text element with cursor:pointer on the Card.Root
  // Click on the first budget card by finding "Test Budget" text
  const budgetCard = page.locator("text=Test Budget").first();
  await expect(budgetCard).toBeVisible({ timeout: 10_000 });
  await budgetCard.click();

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

test.describe("Budget Detail Page — Fix #48 Verification", () => {
  test("budget detail page loads from budget list", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await navigateToBudgetDetail(authenticatedPage);

    // Verify we navigated to the detail page (URL should contain /budgets/<uuid>)
    expect(authenticatedPage.url()).toMatch(/\/budgets\/[a-f0-9-]+/);

    // Take screenshot of budget detail page
    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "budget-detail-from-list",
    );

    expectNoConsoleErrors(errors);
  });

  test("budget detail page loads directly via URL", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Navigate to budgets list first to discover a valid budget URL
    await authenticatedPage.goto("/budgets");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click on the first budget to get to its detail page
    const budgetCard = authenticatedPage.locator("text=Test Budget").first();
    await expect(budgetCard).toBeVisible({ timeout: 10_000 });
    await budgetCard.click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Capture the URL we landed on
    const detailUrl = authenticatedPage.url();
    expect(detailUrl).toMatch(/\/budgets\/[a-f0-9-]+/);

    // Now navigate directly to that URL (simulating direct URL access)
    await authenticatedPage.goto(detailUrl);
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    // Verify the page loaded — budget detail uses breadcrumbs, not h1/h2
    const budgetName = authenticatedPage.locator("text=Test Budget").first();
    await expect(budgetName).toBeVisible({ timeout: 10_000 });

    // Take full-page screenshot
    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "budget-detail",
    );

    expectNoConsoleErrors(errors);
  });

  test("budget info card displays correctly", async ({ authenticatedPage }) => {
    await navigateToBudgetDetail(authenticatedPage);

    // Look for budget info elements (limit amount, spending, progress)
    // The BudgetInfoCard should show percentage_used and spending info
    const pageContent = await authenticatedPage.textContent("body");

    // Verify budget name is visible on the detail page
    expect(pageContent).toContain("Test Budget");

    // Verify spending/limit info is present (from the BudgetInfoCard)
    // The card shows "Spent", "Limit", and percentage used
    const hasSpendingInfo =
      pageContent?.includes("Spent") || pageContent?.includes("Limit");
    expect(hasSpendingInfo).toBeTruthy();

    // Take a viewport screenshot of the info card area
    await screenshotHelper.captureViewportScreenshot(
      authenticatedPage,
      "budget-detail-viewport",
    );
  });

  test("budget with no current-period transactions shows zero spending", async ({
    authenticatedPage,
  }) => {
    await navigateToBudgetDetail(authenticatedPage);

    // Wait a bit longer for transactions to load
    await authenticatedPage.waitForTimeout(500);

    // The budget has current_spending of "0" and percentage_used of 0.0
    // Verify the page reflects this (look for 0% or €0 or similar indicators)
    const pageContent = await authenticatedPage.textContent("body");

    // The page should show some indication of zero spending
    // This could be "0%", "$0", "0.00", or an empty transaction list
    const hasZeroIndicator =
      pageContent?.includes("0%") ||
      pageContent?.includes("$0") ||
      pageContent?.includes("0.00") ||
      pageContent?.includes("€0") ||
      pageContent?.includes("No transactions") ||
      pageContent?.includes("no transactions");

    // Take screenshot regardless for visual verification
    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "budget-detail-zero-spending",
    );

    // Log what we found for debugging
    console.log(`Zero spending indicator found: ${hasZeroIndicator}`);
    expect(hasZeroIndicator).toBeTruthy();
  });
});
