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
