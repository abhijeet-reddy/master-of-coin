import { expect, type Page } from "@playwright/test";

/**
 * Custom assertion helpers for E2E tests.
 * Provides reusable assertions for common UI patterns.
 */

/**
 * Assert that the page header contains the expected title text.
 */
export async function expectPageTitle(
  page: Page,
  title: string,
): Promise<void> {
  const heading = page.locator("h1, h2").first();
  await expect(heading).toContainText(title);
}

/**
 * Assert that no JavaScript console errors occurred on the page.
 * Call this at the start of a test to begin collecting, then at the end to assert.
 *
 * Usage:
 *   const errors = collectConsoleErrors(page);
 *   // ... do stuff ...
 *   expectNoConsoleErrors(errors);
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

export function expectNoConsoleErrors(errors: string[]): void {
  // Filter out known benign errors (e.g., favicon 404)
  const realErrors = errors.filter(
    (e) => !e.includes("favicon") && !e.includes("Failed to load resource"),
  );
  expect(realErrors).toEqual([]);
}

/**
 * Assert that a toast notification appeared with the expected message.
 * Waits up to 5 seconds for the toast to appear.
 */
export async function expectToastMessage(
  page: Page,
  message: string,
): Promise<void> {
  const toast = page
    .locator('[data-scope="toast"]')
    .filter({ hasText: message });
  await expect(toast).toBeVisible({ timeout: 5_000 });
}

/**
 * Assert that a table has the expected number of rows (excluding header).
 */
export async function expectTableRowCount(
  page: Page,
  expectedCount: number,
): Promise<void> {
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(expectedCount);
}

/**
 * Assert that a table has at least the expected number of rows.
 */
export async function expectTableRowCountAtLeast(
  page: Page,
  minCount: number,
): Promise<void> {
  const rows = page.locator("table tbody tr");
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(minCount);
}

/**
 * Assert that a form validation error is displayed for a specific field.
 */
export async function expectFormValidationError(
  page: Page,
  fieldName: string,
  errorMessage: string,
): Promise<void> {
  // Look for error text near the field
  const field = page.locator(`[name="${fieldName}"]`);
  const fieldContainer = field.locator("..");
  await expect(fieldContainer).toContainText(errorMessage);
}

/**
 * Assert that a loading spinner is visible, then wait for it to disappear.
 */
export async function waitForLoadingToComplete(page: Page): Promise<void> {
  // Wait for any spinner to disappear
  const spinner = page.locator(
    '[data-scope="spinner"], .chakra-spinner, [role="status"]',
  );
  if (await spinner.isVisible()) {
    await expect(spinner).toBeHidden({ timeout: 15_000 });
  }
}

/**
 * Assert that the page shows an empty state message.
 */
export async function expectEmptyState(
  page: Page,
  message?: string,
): Promise<void> {
  const emptyState = page
    .locator('[data-testid="empty-state"]')
    .or(page.locator("text=No data").or(page.locator("text=No results")));
  await expect(emptyState).toBeVisible();
  if (message) {
    await expect(emptyState).toContainText(message);
  }
}

/**
 * Assert that an error alert is displayed with the expected message.
 */
export async function expectErrorAlert(
  page: Page,
  message: string,
): Promise<void> {
  const alert = page
    .locator('[data-scope="alert"][data-status="error"]')
    .or(page.locator('[role="alert"]'));
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(message);
}
