import type { Page } from "@playwright/test";

/**
 * Navigation helper functions for E2E tests.
 * Provides consistent page navigation with proper wait conditions.
 */

/**
 * Wait for the page to be fully loaded (network idle + content visible).
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the dashboard page and wait for it to load.
 */
export async function goToDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  await waitForPageLoad(page);
}

/**
 * Navigate to the accounts page and wait for it to load.
 */
export async function goToAccounts(page: Page): Promise<void> {
  await page.goto("/accounts");
  await waitForPageLoad(page);
}

/**
 * Navigate to a specific account detail page.
 */
export async function goToAccountDetail(
  page: Page,
  accountId: string,
): Promise<void> {
  await page.goto(`/accounts/${accountId}`);
  await waitForPageLoad(page);
}

/**
 * Navigate to the transactions page and wait for it to load.
 */
export async function goToTransactions(page: Page): Promise<void> {
  await page.goto("/transactions");
  await waitForPageLoad(page);
}

/**
 * Navigate to the budgets page and wait for it to load.
 */
export async function goToBudgets(page: Page): Promise<void> {
  await page.goto("/budgets");
  await waitForPageLoad(page);
}

/**
 * Navigate to a specific budget detail page.
 */
export async function goToBudgetDetail(
  page: Page,
  budgetId: string,
): Promise<void> {
  await page.goto(`/budgets/${budgetId}`);
  await waitForPageLoad(page);
}

/**
 * Navigate to the categories page and wait for it to load.
 */
export async function goToCategories(page: Page): Promise<void> {
  await page.goto("/categories");
  await waitForPageLoad(page);
}

/**
 * Navigate to a specific category detail page.
 */
export async function goToCategoryDetail(
  page: Page,
  categoryId: string,
): Promise<void> {
  await page.goto(`/categories/${categoryId}`);
  await waitForPageLoad(page);
}

/**
 * Navigate to the people page and wait for it to load.
 */
export async function goToPeople(page: Page): Promise<void> {
  await page.goto("/people");
  await waitForPageLoad(page);
}

/**
 * Navigate to the reports page and wait for it to load.
 */
export async function goToReports(page: Page): Promise<void> {
  await page.goto("/reports");
  await waitForPageLoad(page);
}

/**
 * Navigate to the settings page and wait for it to load.
 */
export async function goToSettings(page: Page): Promise<void> {
  await page.goto("/settings");
  await waitForPageLoad(page);
}

/**
 * Navigate to the jobs page and wait for it to load.
 */
export async function goToJobs(page: Page): Promise<void> {
  await page.goto("/jobs");
  await waitForPageLoad(page);
}

/**
 * Navigate to the schedules page and wait for it to load.
 */
export async function goToSchedules(page: Page): Promise<void> {
  await page.goto("/schedules");
  await waitForPageLoad(page);
}

/**
 * Click a sidebar navigation link by its text content.
 */
export async function navigateViaSidebar(
  page: Page,
  linkText: string,
): Promise<void> {
  await page.click(`nav >> text=${linkText}`);
  await waitForPageLoad(page);
}
