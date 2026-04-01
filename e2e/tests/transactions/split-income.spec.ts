import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Split payment visibility tests for income and expense transactions.
 *
 * Verifies that the "Enable Split Payment" button is:
 * - Visible when transaction type is "Income" (splits allowed on income)
 * - Visible when transaction type is "Expense"
 * - Preserved when switching between Income and Expense
 *
 * GitHub Issue: #53, #59
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

test.describe("Split Payment - Income Transactions (#53, #59)", () => {
  test("split toggle is visible when transaction type is income", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await openAddTransactionModal(authenticatedPage);

    // Select "Income" type
    await selectTransactionType(authenticatedPage, "income");
    await authenticatedPage.waitForTimeout(300);

    // The "Enable Split Payment" button should be visible (splits allowed on income)
    const splitButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /split payment/i });
    await expect(splitButton).toBeVisible({ timeout: 5000 });

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "split-income-visible",
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

  test("split toggle remains visible when switching from expense to income", async ({
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

    // The button should now say "Disable"
    const disableButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /disable split/i });
    await expect(disableButton).toBeVisible();

    // Now switch to "Income"
    await selectTransactionType(authenticatedPage, "income");
    await authenticatedPage.waitForTimeout(300);

    // Split toggle should still be visible (splits allowed on income)
    const splitButtonAfterSwitch = authenticatedPage
      .locator("button")
      .filter({ hasText: /split payment/i });
    await expect(splitButtonAfterSwitch).toBeVisible({ timeout: 5000 });

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "split-visible-after-income-switch",
    );
  });

  test("split toggle stays visible when switching between types", async ({
    authenticatedPage,
  }) => {
    await openAddTransactionModal(authenticatedPage);

    // Switch to Income
    await selectTransactionType(authenticatedPage, "income");
    await authenticatedPage.waitForTimeout(300);

    // Verify split toggle is visible for income
    const splitButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /split payment/i });
    await expect(splitButton).toBeVisible({ timeout: 5000 });

    // Switch back to Expense
    await selectTransactionType(authenticatedPage, "expense");
    await authenticatedPage.waitForTimeout(300);

    // Split toggle should still be visible
    await expect(splitButton).toBeVisible({ timeout: 5000 });

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "split-visible-after-type-switch",
    );
  });
});
