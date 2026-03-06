import { chromium, type FullConfig } from "@playwright/test";

/**
 * Global setup for Playwright E2E tests.
 *
 * This runs once before all tests:
 * 1. Waits for the Docker stack to be healthy
 * 2. Logs in with test credentials
 * 3. Saves browser storage state (JWT token in localStorage) for reuse by all tests
 */

const BASE_URL = "http://localhost:13153";
const HEALTH_URL = `${BASE_URL}/health`;
const MAX_HEALTH_RETRIES = 30;
const HEALTH_RETRY_INTERVAL_MS = 2000;

const TEST_EMAIL = "test@local.com";
const TEST_PASSWORD = "test@password";

async function waitForHealthy(): Promise<void> {
  console.log(`⏳ Waiting for app to be healthy at ${HEALTH_URL}...`);

  for (let i = 1; i <= MAX_HEALTH_RETRIES; i++) {
    try {
      const response = await fetch(HEALTH_URL);
      if (response.ok) {
        console.log(`✅ App is healthy! (attempt ${i}/${MAX_HEALTH_RETRIES})`);
        return;
      }
      console.log(
        `⏳ Health check returned ${response.status} (attempt ${i}/${MAX_HEALTH_RETRIES})`,
      );
    } catch {
      console.log(
        `⏳ Health check failed - app not ready (attempt ${i}/${MAX_HEALTH_RETRIES})`,
      );
    }

    if (i < MAX_HEALTH_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, HEALTH_RETRY_INTERVAL_MS),
      );
    }
  }

  throw new Error(
    `App did not become healthy after ${MAX_HEALTH_RETRIES} attempts (${(MAX_HEALTH_RETRIES * HEALTH_RETRY_INTERVAL_MS) / 1000}s). ` +
      `Is the Docker stack running? Try: docker-compose up -d`,
  );
}

async function globalSetup(_config: FullConfig): Promise<void> {
  // Step 1: Wait for the Docker stack to be healthy
  await waitForHealthy();

  // Step 2: Launch browser and log in
  console.log("🔐 Logging in with test credentials...");
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Fill in credentials
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);

    // Click sign in button
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard (indicates successful login)
    await page.waitForURL("**/dashboard", { timeout: 15_000 });

    console.log("✅ Login successful! Saving auth state...");

    // Step 3: Save storage state (includes localStorage with JWT token)
    await context.storageState({ path: "./auth/storage-state.json" });

    console.log("✅ Auth state saved to auth/storage-state.json");
  } catch (error) {
    // Take a screenshot for debugging if login fails
    await page.screenshot({ path: "./test-results/global-setup-failure.png" });
    console.error(
      "❌ Login failed! Screenshot saved to test-results/global-setup-failure.png",
    );
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
