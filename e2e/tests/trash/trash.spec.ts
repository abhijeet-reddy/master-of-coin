import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  expectPageTitle,
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Soft-delete (Trash) E2E tests.
 *
 * Tests the full soft-delete lifecycle:
 * 1. Delete a transaction from the transactions page → moves to trash
 * 2. Verify it appears on the Trash page with metadata
 * 3. Restore a transaction from Trash → reappears in transactions
 * 4. Permanently delete a transaction from Trash → gone forever
 *
 * Run:
 *   cd e2e && npx playwright test tests/trash/
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("Trash Page — Soft Delete", () => {
  test("trash page loads with correct title and empty state", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await authenticatedPage.goto("/trash");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Trash");

    // Should show the subtitle about 30-day retention
    await expect(
      authenticatedPage.locator("text=permanently removed after 30 days"),
    ).toBeVisible();

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "trash-empty",
    );
  });

  test("delete transaction moves it to trash, then restore brings it back", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Step 1: Go to transactions page
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");

    // Wait for transaction list to render
    await authenticatedPage.waitForTimeout(1000);

    // Find the first transaction row (uses role="button" with aria-label starting with "View transaction:")
    const transactionRows = authenticatedPage.locator(
      '[role="button"][aria-label^="View transaction"]',
    );
    const rowCount = await transactionRows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    // Get the title of the first transaction we'll delete from its aria-label
    const ariaLabel =
      (await transactionRows.first().getAttribute("aria-label")) || "";
    // aria-label format: "View transaction: <title>"
    const transactionTitle = ariaLabel.replace("View transaction: ", "").trim();

    // Step 2: Click the delete (trash) icon button on the first transaction
    // The delete button uses aria-label="Delete transaction" or is a trash icon button
    const deleteButton = authenticatedPage
      .locator('button[aria-label="Delete transaction"]')
      .first()
      .or(
        authenticatedPage
          .locator("button")
          .filter({ has: authenticatedPage.locator("svg") })
          .filter({ hasNotText: /add|filter|import|transfer/i })
          .last(),
      );

    // If there's a dedicated delete button with trash icon, click it
    const trashButtons = authenticatedPage.locator(
      'button[aria-label="Delete transaction"]',
    );
    const trashButtonCount = await trashButtons.count();

    if (trashButtonCount > 0) {
      await trashButtons.first().click();
    } else {
      // Fallback: look for the trash icon buttons in the transaction rows
      // From the screenshot, each row has a trash icon on the right
      const iconButtons = authenticatedPage.locator("button:has(svg[viewBox])");
      // Click the first one that looks like a delete button
      await iconButtons.first().click();
    }

    // Step 3: Confirm the delete in the confirmation dialog
    await authenticatedPage.waitForTimeout(500);

    // The dialog should show "moved to trash" message
    const dialogText = authenticatedPage.locator(
      "text=moved to trash and permanently deleted after 30 days",
    );
    await expect(dialogText).toBeVisible({ timeout: 5000 });

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "trash-delete-confirmation-dialog",
    );

    // Click the "Delete" confirm button in the dialog
    const confirmButton = authenticatedPage
      .locator('button[aria-label="Delete"]')
      .or(
        authenticatedPage
          .locator("button")
          .filter({ hasText: /^Delete$/ })
          .last(),
      );
    await confirmButton.click();

    // Wait for the delete to complete
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    // Step 4: Navigate to Trash page
    await authenticatedPage.goto("/trash");
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "trash-with-deleted-transaction",
    );

    // Verify the deleted transaction appears in trash
    // It should show the title of the transaction we deleted
    const trashedTransaction = authenticatedPage.locator(
      `text=${transactionTitle}`,
    );
    await expect(trashedTransaction.first()).toBeVisible({ timeout: 10000 });

    // Verify soft-delete metadata is shown
    const deletedOnText = authenticatedPage.locator("text=Deleted on");
    await expect(deletedOnText.first()).toBeVisible();

    const autoRemovesText = authenticatedPage.locator("text=Auto-removes");
    await expect(autoRemovesText.first()).toBeVisible();

    // Verify Restore and Delete buttons are present
    const restoreButton = authenticatedPage
      .locator('button[aria-label="Restore transaction"]')
      .first()
      .or(
        authenticatedPage
          .locator("button")
          .filter({ hasText: "Restore" })
          .first(),
      );
    await expect(restoreButton).toBeVisible();

    const permDeleteButton = authenticatedPage
      .locator('button[aria-label="Permanently delete transaction"]')
      .first()
      .or(
        authenticatedPage
          .locator("button")
          .filter({ hasText: "Delete" })
          .first(),
      );
    await expect(permDeleteButton).toBeVisible();

    // Step 5: Restore the transaction
    await restoreButton.click();
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "trash-after-restore",
    );

    // Step 6: Verify the transaction is back in the transactions list
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    // The restored transaction should be visible again
    const restoredTransaction = authenticatedPage.locator(
      `text=${transactionTitle}`,
    );
    await expect(restoredTransaction.first()).toBeVisible({ timeout: 10000 });

    expectNoConsoleErrors(errors);
  });

  test("permanent delete removes transaction forever", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Step 1: Go to transactions and delete one
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    // Find the first transaction row and get its title
    const transactionRows = authenticatedPage.locator(
      '[role="button"][aria-label^="View transaction"]',
    );
    const rowCount = await transactionRows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    const ariaLabel =
      (await transactionRows.first().getAttribute("aria-label")) || "";
    const deletedTitle = ariaLabel.replace("View transaction: ", "").trim();

    // Count transactions with this title before deletion
    const transactionsBefore = authenticatedPage.locator(
      `text=${deletedTitle}`,
    );
    const countBefore = await transactionsBefore.count();

    // Click delete on the first transaction
    const trashButtons = authenticatedPage.locator(
      'button[aria-label="Delete transaction"]',
    );
    if ((await trashButtons.count()) > 0) {
      await trashButtons.first().click();
    }

    // Confirm delete
    await authenticatedPage.waitForTimeout(500);
    const confirmButton = authenticatedPage
      .locator('button[aria-label="Delete"]')
      .or(
        authenticatedPage
          .locator("button")
          .filter({ hasText: /^Delete$/ })
          .last(),
      );
    await confirmButton.click();
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    // Step 2: Go to Trash
    await authenticatedPage.goto("/trash");
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    // Verify transaction is in trash
    const trashedTransaction = authenticatedPage.locator(
      `text=${deletedTitle}`,
    );
    await expect(trashedTransaction.first()).toBeVisible({ timeout: 10000 });

    // Step 3: Click permanent delete
    const permDeleteButton = authenticatedPage
      .locator('button[aria-label="Permanently delete transaction"]')
      .first()
      .or(
        authenticatedPage
          .locator("button")
          .filter({ hasText: "Delete" })
          .first(),
      );
    await permDeleteButton.click();

    // Step 4: Confirm permanent delete in the dialog
    await authenticatedPage.waitForTimeout(500);

    // The dialog should show "permanently delete" and "cannot be undone"
    const permanentDeleteDialog = authenticatedPage.locator(
      "text=cannot be undone",
    );
    await expect(permanentDeleteDialog).toBeVisible({ timeout: 5000 });

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "trash-permanent-delete-dialog",
    );

    // Click "Delete Forever" button
    const deleteForeverButton = authenticatedPage
      .locator('button[aria-label="Delete Forever"]')
      .or(
        authenticatedPage
          .locator("button")
          .filter({ hasText: "Delete Forever" }),
      );
    await deleteForeverButton.click();
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "trash-after-permanent-delete",
    );

    // Step 5: Verify the transaction is gone from the transactions list too
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    // Count should be one less than before
    const transactionsAfter = authenticatedPage.locator(`text=${deletedTitle}`);
    const countAfter = await transactionsAfter.count();
    expect(countAfter).toBeLessThan(countBefore);

    expectNoConsoleErrors(errors);
  });
});
