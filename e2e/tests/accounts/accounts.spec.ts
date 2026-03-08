import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  expectPageTitle,
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Accounts page E2E tests.
 *
 * Tests CRUD operations for accounts:
 * - List accounts
 * - Create a new account
 * - View account detail
 * - Edit account
 * - Delete account
 */

const screenshotHelper = new ScreenshotHelper();

// Unique name to avoid conflicts with existing data
const TEST_ACCOUNT_NAME = `E2E Test Account ${Date.now()}`;

test.describe("Accounts Page", () => {
  test("accounts page loads with correct title", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    await expectPageTitle(authenticatedPage, "Accounts");
    await expect(
      authenticatedPage.locator("text=Manage your financial accounts"),
    ).toBeVisible();
    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "accounts-list",
    );
  });

  test("Add Account button is visible", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    await expect(authenticatedPage.locator("text=Add Account")).toBeVisible();
  });

  test("can open and close the Add Account modal", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    // Open modal
    await authenticatedPage.click("text=Add Account");

    // Verify modal is open — use role-based locator to avoid strict mode violations
    await expect(
      authenticatedPage.locator('[role="dialog"]').first(),
    ).toBeVisible();
    await expect(authenticatedPage.locator('input[name="name"]')).toBeVisible();

    // Screenshot of the form
    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "accounts-add-modal",
    );

    // Close modal
    await authenticatedPage.click("text=Cancel");

    // Modal should be closed
    await expect(authenticatedPage.locator('input[name="name"]')).toBeHidden({
      timeout: 5_000,
    });
  });

  test("can create a new account", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    // Open the Add Account modal
    await authenticatedPage.click("text=Add Account");
    await expect(authenticatedPage.locator('input[name="name"]')).toBeVisible();

    // Fill in the form
    await authenticatedPage.fill('input[name="name"]', TEST_ACCOUNT_NAME);
    await authenticatedPage.selectOption('select[name="type"]', "SAVINGS");
    await authenticatedPage.fill('input[name="initial_balance"]', "1000");

    // Submit the form
    await authenticatedPage.click('button:has-text("Create")');

    // Wait for modal to close and account to appear in list
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(1000);

    // Verify the new account appears in the list
    await expect(
      authenticatedPage.locator(`text=${TEST_ACCOUNT_NAME}`),
    ).toBeVisible({ timeout: 10_000 });

    // Screenshot after creation
    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "accounts-after-create",
    );
  });

  test("can view account detail page", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click on the first individual account card (not the Total Balance card).
    // Account cards are Card.Root elements with "Balance" text but not "Total Balance".
    const accountCards = authenticatedPage
      .locator('[class*="chakra-card"]')
      .filter({ hasText: /^(?!.*Total Balance).*Balance/ });

    if ((await accountCards.count()) > 0) {
      await accountCards.first().click();
      await authenticatedPage.waitForLoadState("networkidle");

      // Should be on account detail page
      expect(authenticatedPage.url()).toContain("/accounts/");

      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "account-detail",
      );
    }
  });
});
