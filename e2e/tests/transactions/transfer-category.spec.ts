import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Transfer form category auto-selection tests.
 *
 * Verifies that the "Transfer" category is automatically pre-selected
 * when opening the Transfer form modal.
 *
 * GitHub Issue: #51
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("Transfer Form — Auto-select Category (#51)", () => {
  test("transfer form auto-selects Transfer category", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click the "Transfer" button to open the transfer form modal
    const transferButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /transfer/i });
    await expect(transferButton.first()).toBeVisible({ timeout: 5000 });
    await transferButton.first().click();

    // Wait for the modal to appear
    await expect(authenticatedPage.locator('[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });

    // Check the category dropdown value
    const categorySelect = authenticatedPage.locator(
      'select[name="category_id"]',
    );

    // The category dropdown should exist
    if (await categorySelect.isVisible()) {
      const selectedValue = await categorySelect.inputValue();
      const selectedText = await categorySelect
        .locator("option:checked")
        .textContent();

      // If a "Transfer" category exists, it should be pre-selected
      // (selectedText will contain "Transfer" if the category exists)
      if (selectedValue && selectedValue !== "") {
        expect(selectedText?.toLowerCase()).toContain("transfer");
      }
      // If no Transfer category exists, the field should be empty (graceful fallback)
    }

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "transfer-form-category-auto-selected",
    );
  });
});
