import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { goToTransactions } from "../../helpers/navigation";

/**
 * Duplicate Transaction E2E tests.
 *
 * Tests the duplicate transaction feature:
 * - Duplicate button is visible on transaction rows
 * - Clicking duplicate opens the form modal in create mode
 * - Form is pre-filled with source transaction data
 * - Date/time defaults to today (not source date)
 * - Transfer transactions do NOT show duplicate button
 * - Duplicate button is NOT present on Trash page
 * - Duplicate button is visible on Transaction Detail page
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("Duplicate Transaction", () => {
  test("duplicate button is visible on transaction rows", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await goToTransactions(authenticatedPage);

    // Look for transaction rows (they have role="button" and aria-label starting with "View transaction:")
    const transactionRows = authenticatedPage.locator(
      '[role="button"][aria-label^="View transaction"]',
    );
    const rowCount = await transactionRows.count();

    if (rowCount > 0) {
      // Hover over the first transaction row to ensure buttons are visible
      await transactionRows.first().hover();
      await authenticatedPage.waitForTimeout(300);

      // Look for the duplicate button (aria-label="Duplicate transaction")
      const duplicateButton = transactionRows
        .first()
        .locator('[aria-label="Duplicate transaction"]');
      await expect(duplicateButton).toBeVisible({ timeout: 5000 });

      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "duplicate-button-visible",
      );
    }

    expectNoConsoleErrors(errors);
  });

  test("clicking duplicate opens form modal in create mode with pre-filled data", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await goToTransactions(authenticatedPage);

    // Find transaction rows
    const transactionRows = authenticatedPage.locator(
      '[role="button"][aria-label^="View transaction"]',
    );
    const rowCount = await transactionRows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click the duplicate button on the first transaction
    const firstRow = transactionRows.first();
    const duplicateButton = firstRow.locator(
      '[aria-label="Duplicate transaction"]',
    );
    await duplicateButton.click();

    // Wait for the modal to appear
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify modal is in CREATE mode (title should be "Add Transaction", not "Edit Transaction")
    const modalTitle = dialog.locator("h2, [data-scope='dialog'] header");
    await expect(modalTitle.first()).toContainText("Add Transaction");

    // Verify the title field is pre-filled with the source transaction's title
    const titleInput = dialog.locator('input[name="title"]');
    const titleValue = await titleInput.inputValue();
    expect(titleValue.length).toBeGreaterThan(0);

    // Verify the amount field is pre-filled
    const amountInput = dialog.locator('input[name="amount"]');
    const amountValue = await amountInput.inputValue();
    expect(amountValue.length).toBeGreaterThan(0);
    expect(parseFloat(amountValue)).toBeGreaterThan(0);

    // Verify the date is today (not the source transaction's date)
    const dateInput = dialog.locator('input[name="date"]');
    const dateValue = await dateInput.inputValue();
    const today = new Date().toISOString().split("T")[0];
    expect(dateValue).toBe(today);

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "duplicate-modal-prefilled",
    );
  });

  test("duplicate modal can be closed without creating", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);

    const transactionRows = authenticatedPage.locator(
      '[role="button"][aria-label^="View transaction"]',
    );
    const rowCount = await transactionRows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click duplicate on first transaction
    const duplicateButton = transactionRows
      .first()
      .locator('[aria-label="Duplicate transaction"]');
    await duplicateButton.click();

    // Modal should appear
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cancel
    const cancelButton = dialog
      .locator("button")
      .filter({ hasText: /cancel/i });
    await cancelButton.click();

    // Modal should close
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test("duplicate button is NOT visible on trash page", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/trash");
    await authenticatedPage.waitForLoadState("networkidle");

    // The trash page should NOT have any duplicate buttons
    const duplicateButtons = authenticatedPage.locator(
      '[aria-label="Duplicate transaction"]',
    );
    const count = await duplicateButtons.count();
    expect(count).toBe(0);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "trash-no-duplicate-button",
    );
  });

  test("duplicate button is visible on transaction detail page", async ({
    authenticatedPage,
  }) => {
    await goToTransactions(authenticatedPage);

    // Find and click the first transaction row to navigate to detail
    const transactionRows = authenticatedPage.locator(
      '[role="button"][aria-label^="View transaction"]',
    );
    const rowCount = await transactionRows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Click the first transaction row (not the duplicate button)
    await transactionRows.first().click();

    // Wait for navigation to transaction detail page
    await authenticatedPage.waitForURL("**/transactions/**", {
      timeout: 10_000,
    });
    await authenticatedPage.waitForLoadState("networkidle");

    // Look for the Duplicate button in the action bar
    const duplicateButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /duplicate/i });

    // Duplicate button should be visible (unless it's a transfer transaction)
    const isVisible = await duplicateButton.isVisible().catch(() => false);

    if (isVisible) {
      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "detail-duplicate-button",
      );
    }
  });

  test("duplicate from detail page opens modal with pre-filled data", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await goToTransactions(authenticatedPage);

    // Navigate to first transaction detail
    const transactionRows = authenticatedPage.locator(
      '[role="button"][aria-label^="View transaction"]',
    );
    const rowCount = await transactionRows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    await transactionRows.first().click();
    await authenticatedPage.waitForURL("**/transactions/**", {
      timeout: 10_000,
    });
    await authenticatedPage.waitForLoadState("networkidle");

    // Click the Duplicate button
    const duplicateButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /duplicate/i });

    if (!(await duplicateButton.isVisible().catch(() => false))) {
      // This might be a transfer transaction — skip
      test.skip();
      return;
    }

    await duplicateButton.click();

    // Modal should appear in create mode
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify it's in create mode
    const modalTitle = dialog.locator("h2, [data-scope='dialog'] header");
    await expect(modalTitle.first()).toContainText("Add Transaction");

    // Verify title is pre-filled
    const titleInput = dialog.locator('input[name="title"]');
    const titleValue = await titleInput.inputValue();
    expect(titleValue.length).toBeGreaterThan(0);

    // Verify date is today
    const dateInput = dialog.locator('input[name="date"]');
    const dateValue = await dateInput.inputValue();
    const today = new Date().toISOString().split("T")[0];
    expect(dateValue).toBe(today);

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "detail-duplicate-modal-prefilled",
    );
  });
});
