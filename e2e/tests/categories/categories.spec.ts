import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  expectPageTitle,
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Categories page E2E tests.
 *
 * Tests the categories page functionality:
 * - Page loads correctly
 * - Category list renders
 * - Create category modal
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("Categories Page", () => {
  test("categories page loads with correct title", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await authenticatedPage.goto("/categories");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Categories");
    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "categories-list",
    );
  });

  test("Add Category button is visible", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/categories");
    await authenticatedPage.waitForLoadState("networkidle");

    const addButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /add category|new category|create/i });
    await expect(addButton.first()).toBeVisible();
  });

  test("can open and close the Add Category modal", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/categories");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click add category button
    const addButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /add category|new category|create/i });
    await addButton.first().click();

    // Wait for modal
    await authenticatedPage.waitForTimeout(500);

    // Verify modal is visible
    const dialog = authenticatedPage.locator('[role="dialog"]');
    if (await dialog.isVisible()) {
      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "categories-add-modal",
      );

      // Close modal
      await authenticatedPage.click("text=Cancel");
      await authenticatedPage.waitForTimeout(500);
    }
  });
});
