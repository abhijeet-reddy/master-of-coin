import type { FullConfig } from "@playwright/test";

/**
 * Global teardown for Playwright E2E tests.
 *
 * Runs once after all tests complete.
 * Currently minimal — Docker cleanup is handled externally.
 */
async function globalTeardown(_config: FullConfig): Promise<void> {
  console.log("🧹 E2E tests complete. Cleaning up...");
  // Future: Could clean up test data, stop containers, etc.
  console.log("✅ Teardown complete.");
}

export default globalTeardown;
