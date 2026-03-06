import type { Page } from "@playwright/test";

/**
 * Authentication helper functions for E2E tests.
 */

const TEST_EMAIL = "test@local.com";
const TEST_PASSWORD = "test@password";

/**
 * Perform a manual login flow on the given page.
 * Use this when you need a fresh login (e.g., testing login itself).
 * For most tests, use the `authenticatedPage` fixture instead.
 */
export async function login(
  page: Page,
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}

/**
 * Log out the current user.
 * Clears localStorage and navigates to login page.
 */
export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("auth_token");
  });
  await page.goto("/login");
}

/**
 * Get the JWT auth token from the page's localStorage.
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => localStorage.getItem("auth_token"));
}

/**
 * Check if the page is currently authenticated.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await getAuthToken(page);
  return token !== null && token.length > 0;
}
