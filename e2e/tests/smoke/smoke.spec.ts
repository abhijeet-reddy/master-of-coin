import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";

/**
 * Smoke tests — verify all major pages load without errors.
 *
 * These are the first tests to run. They validate that:
 * 1. The app is running and accessible
 * 2. Authentication works (pages load with auth state)
 * 3. Each page renders its expected content
 * 4. No JavaScript console errors occur
 *
 * The agent can run these to quickly verify the app is working:
 *   cd e2e && npx playwright test tests/smoke/smoke.spec.ts
 *
 * To take screenshots of all pages for visual verification:
 *   cd e2e && npm run screenshot
 */

const screenshotHelper = new ScreenshotHelper();

// Pages to test: [path, expectedTitle, screenshotName]
const pages: [string, string, string][] = [
  ["/dashboard", "Dashboard", "dashboard"],
  ["/accounts", "Accounts", "accounts"],
  ["/transactions", "Transactions", "transactions"],
  ["/budgets", "Budgets", "budgets"],
  ["/categories", "Categories", "categories"],
  ["/people", "People", "people"],
  ["/reports", "Reports", "reports"],
  ["/jobs", "Jobs", "jobs"],
  ["/schedules", "Schedules", "schedules"],
  ["/settings", "Settings", "settings"],
];

test.describe("Smoke Tests — All Pages Load", () => {
  for (const [path, expectedTitle, screenshotName] of pages) {
    test(`${expectedTitle} page loads at ${path}`, async ({
      authenticatedPage,
    }) => {
      // Collect console errors
      const consoleErrors: string[] = [];
      authenticatedPage.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      // Navigate to the page
      await authenticatedPage.goto(path);
      await authenticatedPage.waitForLoadState("networkidle");

      // Verify the page title is visible
      const heading = authenticatedPage.locator("h1").first();
      await expect(heading).toContainText(expectedTitle, { timeout: 10_000 });

      // Verify no critical console errors (filter out benign ones)
      const realErrors = consoleErrors.filter(
        (e) =>
          !e.includes("favicon") &&
          !e.includes("Failed to load resource") &&
          !e.includes("net::ERR"),
      );
      expect(realErrors).toEqual([]);
    });
  }
});

test.describe("Smoke Tests — Screenshots @screenshot", () => {
  for (const [path, expectedTitle, screenshotName] of pages) {
    test(`screenshot: ${expectedTitle} page`, async ({ authenticatedPage }) => {
      await authenticatedPage.goto(path);
      await authenticatedPage.waitForLoadState("networkidle");

      // Wait a bit for any animations to settle
      await authenticatedPage.waitForTimeout(500);

      // Capture full-page screenshot
      await screenshotHelper.capturePageScreenshot(
        authenticatedPage,
        screenshotName,
      );
    });
  }
});

test.describe("Smoke Tests — Navigation", () => {
  test("sidebar navigation works for all pages", async ({
    authenticatedPage,
  }) => {
    // Start at dashboard
    await authenticatedPage.goto("/dashboard");
    await authenticatedPage.waitForLoadState("networkidle");

    // Test each sidebar link
    const sidebarLinks = [
      { label: "Transactions", expectedUrl: "/transactions" },
      { label: "Accounts", expectedUrl: "/accounts" },
      { label: "Budgets", expectedUrl: "/budgets" },
      { label: "Categories", expectedUrl: "/categories" },
      { label: "People", expectedUrl: "/people" },
      { label: "Reports", expectedUrl: "/reports" },
      { label: "Dashboard", expectedUrl: "/" },
    ];

    for (const { label, expectedUrl } of sidebarLinks) {
      // Click the sidebar link
      await authenticatedPage.click(`nav >> text=${label}`);
      await authenticatedPage.waitForLoadState("networkidle");

      // Verify URL changed
      expect(authenticatedPage.url()).toContain(expectedUrl);
    }
  });
});
