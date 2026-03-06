import { test as base, type Page } from "@playwright/test";
import { ScreenshotHelper } from "../helpers/screenshots";

/**
 * Custom test fixtures for Master of Coin E2E tests.
 *
 * Provides:
 * - `authenticatedPage`: A page with pre-loaded auth state (JWT in localStorage)
 * - `screenshotHelper`: Utility for capturing and comparing screenshots
 */

type TestFixtures = {
  /** A page that is already authenticated with test credentials */
  authenticatedPage: Page;
  /** Helper for capturing screenshots and comparing against baselines */
  screenshotHelper: ScreenshotHelper;
};

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ browser }, use) => {
    // Create a new context with saved authentication state
    const context = await browser.newContext({
      storageState: "./auth/storage-state.json",
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  screenshotHelper: async ({}, use) => {
    const helper = new ScreenshotHelper();
    await use(helper);
  },
});

export { expect } from "@playwright/test";
