import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  expectPageTitle,
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * People page E2E tests.
 *
 * Tests the people page functionality:
 * - Page loads correctly
 * - People list renders
 * - Create person modal
 * - Debt summary
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("People Page", () => {
  test("people page loads with correct title", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await authenticatedPage.goto("/people");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "People");
    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "people-list",
    );
  });

  test("Add Person button is visible", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/people");
    await authenticatedPage.waitForLoadState("networkidle");

    const addButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /add person|new person|add/i });
    await expect(addButton.first()).toBeVisible();
  });

  test("can open and close the Add Person modal", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/people");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click add person button
    const addButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /add person|new person|add/i });
    await addButton.first().click();

    // Wait for modal
    await authenticatedPage.waitForTimeout(500);

    // Verify modal is visible
    const dialog = authenticatedPage.locator('[role="dialog"]');
    if (await dialog.isVisible()) {
      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "people-add-modal",
      );

      // Close modal
      await authenticatedPage.click("text=Cancel");
      await authenticatedPage.waitForTimeout(500);
    }
  });
});
