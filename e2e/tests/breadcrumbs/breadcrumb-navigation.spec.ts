import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Breadcrumb Navigation Source E2E tests — Issue #52.
 *
 * Verifies that the Transaction Detail page breadcrumbs reflect
 * the navigation source (Account, Category, Budget, or Transactions list).
 */

const screenshotHelper = new ScreenshotHelper();

/**
 * Helper: Get the breadcrumb text content as an array of crumb labels.
 * Chakra Breadcrumb renders items inside a <nav> with <ol>/<li> elements.
 */
async function getBreadcrumbLabels(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  // Breadcrumb.Root renders a <nav>, items are <li> elements inside <ol>
  const breadcrumbItems = page.locator("nav ol li");
  const count = await breadcrumbItems.count();
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await breadcrumbItems.nth(i).textContent();
    if (text?.trim()) {
      labels.push(text.trim());
    }
  }
  return labels;
}

test.describe("Breadcrumb Navigation Source — Issue #52", () => {
  test("transaction detail from Transactions list shows default breadcrumbs", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Go to transactions list
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click the first transaction row (TransactionRow has role="button")
    const firstTransaction = authenticatedPage
      .locator('[role="button"][aria-label^="View transaction"]')
      .first();

    if (await firstTransaction.isVisible({ timeout: 5_000 })) {
      await firstTransaction.click();
      await authenticatedPage.waitForLoadState("networkidle");
      await authenticatedPage.waitForTimeout(500);

      // Verify we're on a transaction detail page
      expect(authenticatedPage.url()).toMatch(/\/transactions\/[a-f0-9-]+/);

      // Verify breadcrumbs: should be "Transactions > [Transaction Title]"
      const labels = await getBreadcrumbLabels(authenticatedPage);
      expect(labels.length).toBeGreaterThanOrEqual(2);
      expect(labels[0]).toBe("Transactions");

      // The first breadcrumb should be a link to /transactions
      const firstCrumbLink = authenticatedPage.locator("nav ol li a").first();
      const href = await firstCrumbLink.getAttribute("href");
      expect(href).toBe("/transactions");

      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "breadcrumb-from-transactions",
      );
    }

    expectNoConsoleErrors(errors);
  });

  test("transaction detail from Account Detail shows account breadcrumbs", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // Go to accounts list
    await authenticatedPage.goto("/accounts");
    await authenticatedPage.waitForLoadState("networkidle");

    // Click on the first individual account card (not the Total Balance card).
    // Account cards have a cursor:pointer style and contain a Badge with the
    // account type (Savings, Checking, Credit Card, etc.).
    // We find cards that have "Balance" but NOT "Total Balance".
    const accountCards = authenticatedPage
      .locator('[class*="chakra-card"]')
      .filter({ hasText: /^(?!.*Total Balance).*Balance/ });

    if ((await accountCards.count()) === 0) {
      test.skip();
      return;
    }

    // Click the first account card
    await accountCards.first().click();
    await authenticatedPage.waitForURL(/\/accounts\/[a-f0-9-]+/, {
      timeout: 5_000,
    });
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Verify we're on an account detail page
    expect(authenticatedPage.url()).toMatch(/\/accounts\/[a-f0-9-]+/);

    // Capture the account name from the breadcrumb
    const accountBreadcrumbs = await getBreadcrumbLabels(authenticatedPage);
    const accountName =
      accountBreadcrumbs.length >= 2 ? accountBreadcrumbs[1] : "Account";

    // Now click the first transaction in the account's transaction list
    const firstTransaction = authenticatedPage
      .locator('[role="button"][aria-label^="View transaction"]')
      .first();

    if (!(await firstTransaction.isVisible({ timeout: 5_000 }))) {
      // No transactions in this account — skip
      test.skip();
      return;
    }

    await firstTransaction.click();
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Verify we're on a transaction detail page
    expect(authenticatedPage.url()).toMatch(/\/transactions\/[a-f0-9-]+/);

    // Verify breadcrumbs: should be "Accounts > [Account Name] > [Transaction Title]"
    const labels = await getBreadcrumbLabels(authenticatedPage);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels[0]).toBe("Accounts");
    expect(labels[1]).toBe(accountName);

    // The first breadcrumb link should point to /accounts
    const breadcrumbLinks = authenticatedPage.locator("nav ol li a");
    const firstHref = await breadcrumbLinks.first().getAttribute("href");
    expect(firstHref).toBe("/accounts");

    // The second breadcrumb link should point to the account detail page
    const secondHref = await breadcrumbLinks.nth(1).getAttribute("href");
    expect(secondHref).toMatch(/\/accounts\/[a-f0-9-]+/);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "breadcrumb-from-account",
    );

    expectNoConsoleErrors(errors);
  });

  test("transaction detail via direct URL shows default breadcrumbs", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    // First, discover a valid transaction URL by navigating from the list
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");

    const firstTransaction = authenticatedPage
      .locator('[role="button"][aria-label^="View transaction"]')
      .first();

    if (!(await firstTransaction.isVisible({ timeout: 5_000 }))) {
      test.skip();
      return;
    }

    await firstTransaction.click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Capture the transaction detail URL
    const detailUrl = authenticatedPage.url();
    expect(detailUrl).toMatch(/\/transactions\/[a-f0-9-]+/);

    // Now navigate directly to that URL (simulating bookmark/direct access)
    await authenticatedPage.goto(detailUrl);
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Verify default breadcrumbs: "Transactions > [Transaction Title]"
    const labels = await getBreadcrumbLabels(authenticatedPage);
    expect(labels.length).toBeGreaterThanOrEqual(2);
    expect(labels[0]).toBe("Transactions");

    // The first breadcrumb should link to /transactions
    const firstCrumbLink = authenticatedPage.locator("nav ol li a").first();
    const href = await firstCrumbLink.getAttribute("href");
    expect(href).toBe("/transactions");

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "breadcrumb-direct-url",
    );

    expectNoConsoleErrors(errors);
  });

  test("breadcrumb link navigates back to source page", async ({
    authenticatedPage,
  }) => {
    // Navigate from transactions list to a transaction detail
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");

    const firstTransaction = authenticatedPage
      .locator('[role="button"][aria-label^="View transaction"]')
      .first();

    if (!(await firstTransaction.isVisible({ timeout: 5_000 }))) {
      test.skip();
      return;
    }

    await firstTransaction.click();
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Verify we're on transaction detail
    expect(authenticatedPage.url()).toMatch(/\/transactions\/[a-f0-9-]+/);

    // Click the "Transactions" breadcrumb link to go back
    const transactionsCrumb = authenticatedPage.locator(
      'nav ol li a[href="/transactions"]',
    );
    await expect(transactionsCrumb).toBeVisible();
    await transactionsCrumb.click();
    await authenticatedPage.waitForLoadState("networkidle");

    // Verify we navigated back to the transactions list
    expect(authenticatedPage.url()).toContain("/transactions");
    expect(authenticatedPage.url()).not.toMatch(/\/transactions\/[a-f0-9-]+/);
  });
});
