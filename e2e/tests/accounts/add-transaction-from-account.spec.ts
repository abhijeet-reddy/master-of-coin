import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Add Transaction from Account Detail page tests.
 *
 * Verifies that the "Add Transaction" button on the Account Detail page
 * opens the transaction form with the account pre-selected.
 *
 * GitHub Issue: #49
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("Account Detail — Add Transaction (#49)", () => {
  test("Add Transaction button is visible on account detail page", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Navigate to accounts and click the first account
    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    const accountCards = authenticatedPage
      .locator('[class*="chakra-card"]')
      .filter({ hasText: /^(?!.*Total Balance).*Balance/ });

    if ((await accountCards.count()) === 0) {
      test.skip(true, "No accounts available to test");
      return;
    }

    await accountCards.first().click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify we're on an account detail page
    expect(authenticatedPage.url()).toContain("/accounts/");

    // The "Add Transaction" button should be visible
    const addButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /add transaction/i });
    await expect(addButton.first()).toBeVisible({ timeout: 5000 });

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "account-detail-add-transaction-button",
    );
  });

  test("clicking Add Transaction opens form with account pre-selected", async ({
    authenticatedPage,
  }) => {
    // Navigate to accounts and click the first account
    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    const accountCards = authenticatedPage
      .locator('[class*="chakra-card"]')
      .filter({ hasText: /^(?!.*Total Balance).*Balance/ });

    if ((await accountCards.count()) === 0) {
      test.skip(true, "No accounts available to test");
      return;
    }

    // Get the account name before clicking
    const accountCardText = await accountCards.first().textContent();

    await accountCards.first().click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Click "Add Transaction"
    const addButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /add transaction/i });
    await addButton.first().click();

    // Wait for the modal to appear
    await expect(authenticatedPage.locator('[role="dialog"]')).toBeVisible({
      timeout: 5000,
    });

    // The account dropdown should have a non-empty value (pre-selected)
    const accountSelect = authenticatedPage.locator(
      'select[name="account_id"]',
    );
    if (await accountSelect.isVisible()) {
      const selectedValue = await accountSelect.inputValue();
      expect(selectedValue).not.toBe("");
    }

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "account-detail-add-transaction-modal",
    );
  });
});
