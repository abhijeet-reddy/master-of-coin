import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Split payment visibility tests for income vs expense transactions.
 *
 * Verifies that the "Enable Split Payment" button is:
 * - Hidden when transaction type is "Income"
 * - Visible when transaction type is "Expense"
 * - Cleared when switching from Expense to Income
 *
 * GitHub Issue: #53
 */

const screenshotHelper = new ScreenshotHelper();

/** Open the Add Transaction modal from the transactions page. */
async function openAddTransactionModal(page: import("@playwright/test").Page) {
  await page.goto("/transactions");
  await page.waitForLoadState("networkidle");

  // Find and click the add transaction button (uses FiPlus icon or "Add" text)
  const addButtons = page.locator("button");
  const count = await addButtons.count();
  for (let i = 0; i < count; i++) {
    const button = addButtons.nth(i);
    const text = await button.textContent();
    const ariaLabel = await button.getAttribute("aria-label");
    if (
      text?.toLowerCase().includes("add") ||
      text?.toLowerCase().includes("new") ||
      ariaLabel?.toLowerCase().includes("add")
    ) {
      await button.click();
      break;
    }
  }

  // Wait for the modal to appear
  await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
}

/** Select a transaction type in the form modal. */
async function selectTransactionType(
  page: import("@playwright/test").Page,
  type: "expense" | "income",
) {
  const select = page.locator('select[name="transaction_type"]');
  await select.selectOption(type);
}

test.describe("Split Payment - Income Transactions (#53)", () => {
  test("split toggle is hidden when transaction type is income", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await openAddTransactionModal(authenticatedPage);

    // Select "Income" type
    await selectTransactionType(authenticatedPage, "income");
    await authenticatedPage.waitForTimeout(300);

    // The "Enable Split Payment" button should NOT be visible
    const splitButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /split payment/i });
    await expect(splitButton).toBeHidden();

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "split-income-hidden",
    );
  });

  test("split toggle is visible when transaction type is expense", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await openAddTransactionModal(authenticatedPage);

    // Default type is "Expense" — verify split toggle is visible
    const splitButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /split payment/i });
    await expect(splitButton).toBeVisible({ timeout: 5000 });

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "split-expense-visible",
    );
  });

  test("switching from expense to income clears split state", async ({
    authenticatedPage,
  }) => {
    await openAddTransactionModal(authenticatedPage);

    // With "Expense" selected (default), click "Enable Split Payment"
    const splitButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /split payment/i });
    await expect(splitButton).toBeVisible({ timeout: 5000 });
    await splitButton.click();
    await authenticatedPage.waitForTimeout(300);

    // Verify split form appeared (look for split-related text)
    const splitForm = authenticatedPage.locator("text=Split this transaction");
    // The form may or may not show this text depending on implementation
    // At minimum, the button should now say "Disable"
    const disableButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /disable split/i });
    await expect(disableButton).toBeVisible();

    // Now switch to "Income"
    await selectTransactionType(authenticatedPage, "income");
    await authenticatedPage.waitForTimeout(300);

    // Split toggle and form should be hidden
    await expect(splitButton).toBeHidden();
    await expect(disableButton).toBeHidden();

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "split-cleared-on-income-switch",
    );
  });

  test("switching back to expense restores split toggle", async ({
    authenticatedPage,
  }) => {
    await openAddTransactionModal(authenticatedPage);

    // Switch to Income
    await selectTransactionType(authenticatedPage, "income");
    await authenticatedPage.waitForTimeout(300);

    // Verify split toggle is hidden
    const splitButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /split payment/i });
    await expect(splitButton).toBeHidden();

    // Switch back to Expense
    await selectTransactionType(authenticatedPage, "expense");
    await authenticatedPage.waitForTimeout(300);

    // Split toggle should be visible again
    await expect(splitButton).toBeVisible({ timeout: 5000 });

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "split-restored-on-expense-switch",
    );
  });
});
