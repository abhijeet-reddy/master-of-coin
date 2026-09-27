import { test, expect } from "../../fixtures/test-fixtures";
import { ScreenshotHelper } from "../../helpers/screenshots";

/**
 * Smoke tests: every major page loads inside the v2 shell.
 *
 * They check that:
 * 1. The app is running and the saved auth state is accepted
 * 2. Each page's level-one heading carries its title
 * 3. The primary navigation reaches every page
 * 4. No JavaScript console errors occur
 *
 *   cd e2e && npx playwright test tests/smoke/smoke.spec.ts
 *   cd e2e && npm run screenshot
 *
 * Selectors are roles and accessible names only, so they survive the v2
 * restyle page by page.
 */

const screenshotHelper = new ScreenshotHelper();

// [path, heading, nav link name, screenshot name]
const pages: [string, string, string, string][] = [
  ["/dashboard", "Dashboard", "Dashboard", "dashboard"],
  ["/accounts", "Accounts", "Accounts", "accounts"],
  ["/transactions", "Transactions", "Transactions", "transactions"],
  ["/budgets", "Budgets", "Budgets", "budgets"],
  ["/categories", "Categories", "Categories", "categories"],
  ["/people", "People", "People", "people"],
  ["/reports", "Reports", "Reports", "reports"],
  ["/jobs", "Jobs", "Jobs", "jobs"],
  ["/schedules", "Schedules", "Schedules", "schedules"],
  ["/settings", "Settings", "Settings", "settings"],
  ["/trash", "Trash", "Trash", "trash"],
];

const BENIGN = ["favicon", "Failed to load resource", "net::ERR"];

test.describe("Smoke Tests: All Pages Load", () => {
  for (const [path, heading] of pages) {
    test(`${heading} page loads at ${path}`, async ({ authenticatedPage: page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading, {
        timeout: 10_000,
      });
      // The shell is present around every page.
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("region", { name: "Status" })).toBeVisible();

      const realErrors = consoleErrors.filter((e) => !BENIGN.some((b) => e.includes(b)));
      expect(realErrors).toEqual([]);
    });
  }
});

test.describe("Smoke Tests: Screenshots @screenshot", () => {
  for (const [path, heading, , screenshotName] of pages) {
    test(`screenshot: ${heading} page`, async ({ authenticatedPage: page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      await screenshotHelper.capturePageScreenshot(page, screenshotName);
    });
  }
});

test.describe("Smoke Tests: Navigation", () => {
  test("primary navigation reaches every page", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    for (const [path, heading, linkName] of pages) {
      await nav.getByRole("link", { name: linkName, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      await expect(nav.getByRole("link", { name: linkName, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  test("the root path redirects to the dashboard", async ({ authenticatedPage: page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Dashboard");
  });

  test("an unknown path shows the not found page inside the shell", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.getByRole("link", { name: "Go to dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("the skip link moves focus to the page content", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    const skip = page.getByRole("link", { name: "Skip to content" });
    // Tab only once the shell is up; before that the loading screen has no focusable.
    await expect(skip).toBeAttached();
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#page$/);
  });

  test("phones get a bottom bar with a More sheet", async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");
    const bar = page.getByRole("navigation", { name: "Primary, mobile" });
    await expect(bar).toBeVisible();
    await bar.getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Settings");
  });
});
