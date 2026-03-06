import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Master of Coin E2E tests.
 *
 * Tests run against the full Docker stack at http://localhost:13153.
 * Authentication is handled via global setup which saves browser state.
 *
 * Agent workflow:
 *   1. docker-compose down && docker-compose build && docker-compose up -d
 *   2. cd e2e && npx playwright test
 *   3. View screenshots in e2e/screenshots/actual/
 */
export default defineConfig({
  // Test directory
  testDir: "./tests",

  // Run tests sequentially to avoid DB race conditions
  fullyParallel: false,
  workers: 1,

  // Retry failed tests once
  retries: 1,

  // Reporter configuration
  reporter: [["list"], ["html", { open: "never" }]],

  // Global setup and teardown
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: "http://localhost:13153",

    // Always run headless (agent cannot see GUI)
    headless: true,

    // Screenshot on failure for debugging
    screenshot: "only-on-failure",

    // Trace on failure for debugging
    trace: "retain-on-failure",

    // Default timeout per action (click, fill, etc.)
    actionTimeout: 10_000,

    // Default navigation timeout
    navigationTimeout: 15_000,

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors (local dev)
    ignoreHTTPSErrors: true,
  },

  // Test timeout (per test)
  timeout: 30_000,

  // Expect timeout (per assertion)
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      // Allow 5% pixel difference for visual regression
      maxDiffPixelRatio: 0.05,
    },
  },

  // Output directory for test artifacts (screenshots, traces, etc.)
  outputDir: "./test-results",

  // Browser projects
  projects: [
    // Setup project - runs authentication
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
    },

    // Main test project - uses saved auth state
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use saved authentication state
        storageState: "./auth/storage-state.json",
      },
    },
  ],
});
