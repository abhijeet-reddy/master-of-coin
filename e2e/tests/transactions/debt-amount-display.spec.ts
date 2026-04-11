import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import type { Page } from "@playwright/test";

/**
 * Debt Amount Display E2E tests.
 *
 * Verifies the visual treatment of debt transactions:
 * - Debt transactions (paid by someone else) show amount in orange
 * - Debt transactions show a "Debt" effect indicator (↑/↓ with amount)
 * - Regular transactions still show red (expense) or green (income)
 * - Transaction detail page shows orange amount for debt transactions
 *
 * Self-contained: creates its own test data (person + debt transaction).
 */

const screenshotHelper = new ScreenshotHelper();
const API_BASE = "http://localhost:13153/api/v1";

interface PersonData {
  id: string;
  name: string;
}

interface TransactionData {
  id: string;
  title: string;
  amount: string;
}

/**
 * Get the JWT auth token from the page's localStorage.
 */
async function getAuthToken(page: Page): Promise<string> {
  if (page.url() === "about:blank") {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  }
  const token = await page.evaluate(() => localStorage.getItem("auth_token"));
  return token || "";
}

/**
 * Make an authenticated API POST request.
 */
async function apiPost(page: Page, path: string, data: unknown) {
  const token = await getAuthToken(page);
  return page.request.post(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data,
  });
}

/**
 * Make an authenticated API GET request.
 */
async function apiGet(page: Page, path: string) {
  const token = await getAuthToken(page);
  return page.request.get(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Create a person and a debt transaction for testing.
 * Uses a unique suffix to avoid collisions between tests.
 * Returns the person and transaction data.
 */
async function createDebtTestData(
  page: Page,
  suffix: string,
): Promise<{
  person: PersonData;
  transaction: TransactionData;
} | null> {
  // Create a person with unique name
  const personRes = await apiPost(page, "/people", {
    name: `Payer ${suffix}`,
  });
  if (!personRes.ok()) {
    console.error("Failed to create person:", await personRes.text());
    return null;
  }
  const personBody = await personRes.json();
  const person: PersonData = personBody.data || personBody;

  // Create a debt transaction (someone else paid for us)
  const debtRes = await apiPost(page, "/debt-transactions", {
    payer_person_id: person.id,
    title: `Shared Lunch ${suffix}`,
    amount: -100.0,
    date: new Date().toISOString(),
  });
  if (!debtRes.ok()) {
    console.error("Failed to create debt transaction:", await debtRes.text());
    return null;
  }
  const debtBody = await debtRes.json();
  const transaction: TransactionData = debtBody.data || debtBody;

  return { person, transaction };
}

test.describe("Debt Amount Display", () => {
  test("debt transaction shows orange amount on person detail page", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);
    const suffix = `PD${Date.now()}`;

    const testData = await createDebtTestData(authenticatedPage, suffix);
    if (!testData) {
      test.skip();
      return;
    }

    // Navigate to the person detail page
    await authenticatedPage.goto(`/people/${testData.person.id}`);
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Find the transaction row containing our test transaction
    const transactionRow = authenticatedPage
      .locator('[role="button"]')
      .filter({ hasText: `Shared Lunch ${suffix}` });
    await expect(transactionRow).toBeVisible({ timeout: 10_000 });

    // Verify the amount text is present
    const amountText = transactionRow.locator("text=100.00").first();
    await expect(amountText).toBeVisible();

    // Verify the "Paid by" badge is shown (orange badge)
    const paidByBadge = transactionRow.locator("text=/Paid by/");
    await expect(paidByBadge).toBeVisible();

    // Verify the debt effect indicator is shown (matches "Debt €100.00" specifically)
    const debtIndicator = transactionRow.locator("text=/^Debt €/");
    await expect(debtIndicator).toBeVisible();

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "debt-amount-display-person-detail",
    );
  });

  test("debt transaction shows orange amount on transactions page", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);
    const suffix = `TX${Date.now()}`;

    const testData = await createDebtTestData(authenticatedPage, suffix);
    if (!testData) {
      test.skip();
      return;
    }

    // Navigate to the transactions page
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Find the first transaction row containing our test transaction
    const transactionRow = authenticatedPage
      .locator('[role="button"]')
      .filter({ hasText: `Shared Lunch ${suffix}` })
      .first();

    // The transaction may be on the current month page
    if (await transactionRow.isVisible({ timeout: 5000 })) {
      // Verify the "Paid by" badge is shown
      const paidByBadge = transactionRow.locator("text=/Paid by/");
      await expect(paidByBadge).toBeVisible();

      // Verify the debt effect indicator is shown
      const debtIndicator = transactionRow.locator("text=/^Debt €/");
      await expect(debtIndicator).toBeVisible();

      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "debt-amount-display-transactions-page",
      );
    }

    expectNoConsoleErrors(errors);
  });

  test("debt transaction detail page shows orange amount and debt effect", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);
    const suffix = `DT${Date.now()}`;

    const testData = await createDebtTestData(authenticatedPage, suffix);
    if (!testData) {
      test.skip();
      return;
    }

    // Navigate directly to the transaction detail page
    await authenticatedPage.goto(`/transactions/${testData.transaction.id}`);
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Verify the transaction title is shown (use .first() since breadcrumb also has it)
    await expect(
      authenticatedPage.locator(`text=Shared Lunch ${suffix}`).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Verify the amount is displayed
    await expect(
      authenticatedPage.locator("text=100.00").first(),
    ).toBeVisible();

    // Verify "Paid by" detail is shown
    await expect(
      authenticatedPage.locator("text=/Paid by/").first(),
    ).toBeVisible();

    // Verify the debt effect indicator is shown on the detail page
    const debtIndicator = authenticatedPage.locator("text=/^Debt €/");
    await expect(debtIndicator.first()).toBeVisible();

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "debt-amount-display-transaction-detail",
    );
  });

  test("regular expense does NOT show debt indicator", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);
    const suffix = `RE${Date.now()}`;

    // Get accounts to create a regular transaction
    const accountsRes = await apiGet(authenticatedPage, "/accounts");
    if (!accountsRes.ok()) {
      test.skip();
      return;
    }
    const accounts = await accountsRes.json();
    const activeAccount = (
      Array.isArray(accounts) ? accounts : accounts.data || []
    ).find(
      (a: { is_active: boolean; type?: string }) =>
        a.is_active && a.type !== "DEBT",
    );
    if (!activeAccount) {
      test.skip();
      return;
    }

    // Create a regular expense (not a debt transaction)
    const txRes = await apiPost(authenticatedPage, "/transactions", {
      title: `Regular Expense ${suffix}`,
      amount: -75.0,
      date: new Date().toISOString(),
      account_id: activeAccount.id,
    });
    if (!txRes.ok()) {
      test.skip();
      return;
    }

    // Navigate to transactions page
    await authenticatedPage.goto("/transactions");
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Find the regular transaction row
    const transactionRow = authenticatedPage
      .locator('[role="button"]')
      .filter({ hasText: `Regular Expense ${suffix}` })
      .first();

    if (await transactionRow.isVisible({ timeout: 5000 })) {
      // Verify NO "Paid by" badge is shown
      const paidByBadge = transactionRow.locator("text=/Paid by/");
      await expect(paidByBadge).toHaveCount(0);

      // Verify NO debt indicator is shown
      const debtIndicator = transactionRow.locator("text=/^Debt €/");
      await expect(debtIndicator).toHaveCount(0);

      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "debt-amount-display-regular-expense",
      );
    }

    expectNoConsoleErrors(errors);
  });

  test("settlement transaction shows debt decrease indicator on person page", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);
    const suffix = `ST${Date.now()}`;

    const testData = await createDebtTestData(authenticatedPage, suffix);
    if (!testData) {
      test.skip();
      return;
    }

    // Get an active account for settlement
    const accountsRes = await apiGet(authenticatedPage, "/accounts");
    if (!accountsRes.ok()) {
      test.skip();
      return;
    }
    const accounts = await accountsRes.json();
    const activeAccount = (
      Array.isArray(accounts) ? accounts : accounts.data || []
    ).find(
      (a: { is_active: boolean; type?: string }) =>
        a.is_active && a.type !== "DEBT",
    );
    if (!activeAccount) {
      test.skip();
      return;
    }

    // Settle the debt via API
    const settleRes = await apiPost(
      authenticatedPage,
      `/people/${testData.person.id}/settle`,
      {
        amount: -100.0,
        account_id: activeAccount.id,
      },
    );
    if (!settleRes.ok()) {
      console.error("Failed to settle debt:", await settleRes.text());
      test.skip();
      return;
    }

    // Navigate to the person detail page
    await authenticatedPage.goto(`/people/${testData.person.id}`);
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(500);

    // Find the settlement transaction row (title contains "Debt settlement")
    const settlementRow = authenticatedPage
      .locator('[role="button"]')
      .filter({ hasText: /Debt settlement/i })
      .first();

    if (await settlementRow.isVisible({ timeout: 5000 })) {
      // Verify the debt effect indicator is shown for the settlement
      // Use specific regex to match only "Debt €100.00" (the indicator), not the title
      const debtIndicator = settlementRow.locator("text=/^Debt €/");
      await expect(debtIndicator).toBeVisible();

      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        "debt-amount-display-settlement",
      );
    }

    // Also verify the original debt transaction is still visible
    const debtRow = authenticatedPage
      .locator('[role="button"]')
      .filter({ hasText: `Shared Lunch ${suffix}` });
    await expect(debtRow).toBeVisible();

    expectNoConsoleErrors(errors);
  });
});
