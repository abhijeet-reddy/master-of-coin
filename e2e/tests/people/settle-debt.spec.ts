import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import type { Page } from "@playwright/test";

/**
 * Settle Debt E2E tests.
 *
 * Tests the settle debt flow on the person detail page:
 * - "Settle Up" button is visible for people with outstanding debt
 * - Clicking "Settle Up" opens the settle debt modal
 * - Modal displays correct debt information
 * - Can close the modal via Cancel
 * - Can submit the settle form with an account selected
 * - Settlement API sends correct payload with amount field
 *
 * Self-contained: creates its own test data if no person with debt exists.
 */

const screenshotHelper = new ScreenshotHelper();
const API_BASE = "http://localhost:13153/api/v1";

interface PersonData {
  id: string;
  name: string;
  debt_summary?: { net: string; owes_me: string; i_owe: string };
}

/**
 * Get the JWT auth token from the page's localStorage.
 */
async function getAuthToken(page: Page): Promise<string> {
  // Navigate to the app first so we can access localStorage
  if (page.url() === "about:blank") {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  }
  const token = await page.evaluate(() => localStorage.getItem("auth_token"));
  return token || "";
}

/**
 * Make an authenticated API request.
 */
async function apiGet(page: Page, path: string) {
  const token = await getAuthToken(page);
  return page.request.get(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

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
 * Ensure a person with non-zero debt exists and navigate to their detail page.
 * If no person with debt exists, creates a person and a debt transaction.
 */
async function ensurePersonWithDebtAndNavigate(page: Page): Promise<boolean> {
  // 1. Fetch all people via API
  const peopleRes = await apiGet(page, "/people");
  if (!peopleRes.ok()) {
    console.error("Failed to fetch people:", await peopleRes.text());
    return false;
  }
  const people: PersonData[] = await peopleRes.json();

  // 2. Find a person with non-zero debt
  let personWithDebt = people.find((p) => {
    if (!p.debt_summary) return false;
    return parseFloat(p.debt_summary.net) !== 0;
  });

  // 3. If no person with debt, create one
  if (!personWithDebt) {
    // Create a person
    const createPersonRes = await apiPost(page, "/people", {
      name: `E2E Settle Test ${Date.now()}`,
    });
    if (!createPersonRes.ok()) {
      console.error("Failed to create person:", await createPersonRes.text());
      return false;
    }
    const createPersonBody = await createPersonRes.json();
    const newPerson: PersonData = createPersonBody.data || createPersonBody;

    // Create a debt transaction (someone paid for us, we owe them)
    const createDebtRes = await apiPost(page, "/debt-transactions", {
      payer_person_id: newPerson.id,
      title: "E2E test debt for settle",
      amount: -50.0,
      date: new Date().toISOString(),
    });
    if (!createDebtRes.ok()) {
      console.error(
        "Failed to create debt transaction:",
        await createDebtRes.text(),
      );
      return false;
    }

    personWithDebt = newPerson;
  }

  // 4. Navigate to the person detail page
  await page.goto(`/people/${personWithDebt.id}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  return true;
}

test.describe("Settle Debt", () => {
  test("settle up button is visible on person detail page with debt", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    const found = await ensurePersonWithDebtAndNavigate(authenticatedPage);
    if (!found) {
      test.skip();
      return;
    }

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "settle-debt-person-detail",
    );

    // Verify "Settle Up" button is visible
    const settleButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /settle up/i });
    await expect(settleButton).toBeVisible({ timeout: 5000 });

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "settle-debt-button-visible",
    );
  });

  test("can open and close the settle debt modal", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    const found = await ensurePersonWithDebtAndNavigate(authenticatedPage);
    if (!found) {
      test.skip();
      return;
    }

    // Click "Settle Up"
    const settleButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /settle up/i });
    await expect(settleButton).toBeVisible({ timeout: 5000 });
    await settleButton.click();
    await authenticatedPage.waitForTimeout(500);

    // Verify modal is open
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify modal title contains "Settle Debt with <name>"
    await expect(dialog.locator('[data-part="title"]')).toContainText(
      "Settle Debt with",
    );

    // Verify the modal shows debt direction info
    await expect(
      dialog.locator("text=owes you").or(dialog.locator("text=you owe")),
    ).toBeVisible();

    // Verify account selection is present
    const accountSelect = dialog.locator("select");
    await expect(accountSelect).toBeVisible();

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "settle-debt-modal-open",
    );

    // Close modal via Cancel
    await dialog.locator('button:has-text("Cancel")').click();
    await authenticatedPage.waitForTimeout(500);

    // Modal should be closed
    await expect(dialog).toBeHidden({ timeout: 5000 });

    expectNoConsoleErrors(errors);
  });

  test("settle debt modal shows validation error when no account selected", async ({
    authenticatedPage,
  }) => {
    const found = await ensurePersonWithDebtAndNavigate(authenticatedPage);
    if (!found) {
      test.skip();
      return;
    }

    // Click "Settle Up"
    const settleButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /settle up/i });
    await expect(settleButton).toBeVisible({ timeout: 5000 });
    await settleButton.click();
    await authenticatedPage.waitForTimeout(500);

    // Verify modal is open
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Try to submit without selecting an account
    await dialog.locator('button:has-text("Settle Debt")').click();
    await authenticatedPage.waitForTimeout(500);

    // Modal should still be open (form validation prevents submission)
    await expect(dialog).toBeVisible();

    // Should show validation error for account
    await expect(dialog.locator("text=Account is required")).toBeVisible({
      timeout: 3000,
    });

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "settle-debt-validation-error",
    );
  });

  test("settle debt API sends correct payload with amount field", async ({
    authenticatedPage,
  }) => {
    const found = await ensurePersonWithDebtAndNavigate(authenticatedPage);
    if (!found) {
      test.skip();
      return;
    }

    // Click "Settle Up"
    const settleButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /settle up/i });
    await expect(settleButton).toBeVisible({ timeout: 5000 });
    await settleButton.click();
    await authenticatedPage.waitForTimeout(500);

    // Verify modal is open
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Select the first available account
    const accountSelect = dialog.locator("select");
    const options = accountSelect.locator("option");
    const optionCount = await options.count();

    if (optionCount <= 1) {
      test.skip();
      return;
    }

    const firstOptionValue = await options.nth(1).getAttribute("value");
    if (firstOptionValue) {
      await accountSelect.selectOption(firstOptionValue);
    }

    // Intercept the settle API call to verify the payload
    const settleRequestPromise = authenticatedPage.waitForRequest(
      (request) =>
        request.url().includes("/settle") && request.method() === "POST",
    );

    // Submit the form
    await dialog.locator('button:has-text("Settle Debt")').click();

    // Capture the request
    const settleRequest = await settleRequestPromise;
    const requestBody = settleRequest.postDataJSON();

    // Verify the payload contains the required 'amount' field
    // Amount is always positive — the backend determines the sign based on debt direction
    expect(requestBody).toHaveProperty("amount");
    expect(typeof requestBody.amount).toBe("number");
    expect(requestBody.amount).toBeGreaterThan(0);

    // Verify the payload contains 'account_id'
    expect(requestBody).toHaveProperty("account_id");
    expect(typeof requestBody.account_id).toBe("string");
    expect(requestBody.account_id.length).toBeGreaterThan(0);
  });

  test("can successfully settle debt with a person", async ({
    authenticatedPage,
  }) => {
    const errors = collectConsoleErrors(authenticatedPage);

    const found = await ensurePersonWithDebtAndNavigate(authenticatedPage);
    if (!found) {
      test.skip();
      return;
    }

    // Click "Settle Up"
    const settleButton = authenticatedPage
      .locator("button")
      .filter({ hasText: /settle up/i });
    await expect(settleButton).toBeVisible({ timeout: 5000 });
    await settleButton.click();
    await authenticatedPage.waitForTimeout(500);

    // Verify modal is open
    const dialog = authenticatedPage.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Select the first available account
    const accountSelect = dialog.locator("select");
    const options = accountSelect.locator("option");
    const optionCount = await options.count();

    if (optionCount <= 1) {
      test.skip();
      return;
    }

    // Select the first non-empty option
    const firstOptionValue = await options.nth(1).getAttribute("value");
    if (firstOptionValue) {
      await accountSelect.selectOption(firstOptionValue);
    }

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "settle-debt-form-filled",
    );

    // Submit the form
    await dialog.locator('button:has-text("Settle Debt")').click();

    // Wait for the API call to complete and modal to close
    await authenticatedPage.waitForLoadState("networkidle");
    await authenticatedPage.waitForTimeout(2000);

    // Modal should be closed after successful settlement
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Verify no error alerts are shown on the page
    const errorAlert = authenticatedPage.locator(
      '[data-scope="alert"][data-status="error"]',
    );
    expect(await errorAlert.count()).toBe(0);

    expectNoConsoleErrors(errors);

    await screenshotHelper.capturePageScreenshot(
      authenticatedPage,
      "settle-debt-after-settlement",
    );
  });
});
