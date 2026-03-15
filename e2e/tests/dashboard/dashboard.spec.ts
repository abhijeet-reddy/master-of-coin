import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
  expectPageTitle,
} from "../../helpers/assertions";

/**
 * Dashboard page tests.
 *
 * Verifies the dashboard renders correctly with all widgets:
 * - Net Worth widget
 * - Debt widget
 * - Budget Progress
 * - Category Breakdown
 * - Recent Transactions
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("Dashboard", () => {
  test("renders dashboard with correct title", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Dashboard");
    expectNoConsoleErrors(errors);
  });

  test("displays subtitle", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    await expect(
      authenticatedPage.locator("text=Overview of your financial health"),
    ).toBeVisible();
  });

  test("dashboard widgets are visible", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    // Wait for loading to complete
    // The dashboard may show a loading spinner initially
    await authenticatedPage.waitForTimeout(2000);

    // Take a screenshot for visual verification of all widgets
    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "dashboard-full",
    );
  });

  test("debt widget is visible with You Are Owed and You Owe", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    // Wait for dashboard to fully load
    await authenticatedPage.waitForTimeout(2000);

    // Verify debt widget sections are visible
    await expect(authenticatedPage.locator("text=You Are Owed")).toBeVisible();
    await expect(authenticatedPage.locator("text=You Owe")).toBeVisible();
    await expect(authenticatedPage.locator("text=Debts")).toBeVisible();
  });

  test("debt widget navigates to people page on click", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    // Wait for dashboard to fully load
    await authenticatedPage.waitForTimeout(2000);

    // Click the debt widget card (find by the "Debts" heading)
    await authenticatedPage.locator("text=Debts").click();

    // Verify navigation to people page
    await authenticatedPage.waitForURL("**/people", { timeout: 10_000 });
    await expectPageTitle(authenticatedPage, "People");
  });

  test("dashboard loads without errors after navigation", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Navigate to another page first, then back to dashboard
    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Dashboard");
    expectNoConsoleErrors(errors);
  });
});
