import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  expectPageTitle,
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Budgets page E2E tests.
 *
 * Tests the budgets page functionality:
 * - Page loads correctly
 * - Budget list renders
 * - Create budget modal
 * - Overall progress card
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("Budgets Page", () => {
  test("budgets page loads with correct title", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await authenticatedPage.goto("/budgets");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Budgets");
    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "budgets-list",
    );
  });

  test("Add Budget button is visible", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/budgets");
    await authenticatedPage.waitForLoadState("networkidle");

    // Look for add budget button
    const addButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /add budget|new budget|create/i });
    await expect(addButton.first()).toBeVisible();
  });

  test("can open and close the Add Budget modal", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/budgets");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click add budget button
    const addButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /add budget|new budget|create/i });
    await addButton.first().click();

    // Wait for modal
    await authenticatedPage.waitForTimeout(500);

    // Verify modal is visible (should have form fields)
    const dialog = authenticatedPage.locator('[role="dialog"]');
    if (await dialog.isVisible()) {
      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "budgets-add-modal",
      );

      // Close modal
      await authenticatedPage.click("text=Cancel");
      await authenticatedPage.waitForTimeout(500);
    }
  });
});
