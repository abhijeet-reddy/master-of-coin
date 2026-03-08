import { test as base, expect } from "@playwright/test";
import { login, logout } from "../../helpers/auth";
import { ScreenshotHelper } from "../../helpers/screenshots";

/**
 * Authentication flow tests.
 *
 * These tests need a FRESH browser context (no saved auth state)
 * to properly test login/registration flows. The default `page` fixture
 * inherits the project's storageState (which includes auth), so we
 * create a custom `freshPage` fixture that uses an empty context.
 */

const screenshotHelper = new ScreenshotHelper();

// Create a custom test fixture with a fresh (unauthenticated) page
const test = base.extend<{ freshPage: import("@playwright/test").Page }>({
  freshPage: async ({ browser }, use) => {
    // Create a brand-new context WITHOUT any saved auth state.
    // Explicitly pass empty storageState to override any project-level defaults.
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

test.describe("Login Flow", () => {
  test("login page renders correctly", async ({ freshPage }) => {
    await freshPage.goto("/login");
    await freshPage.waitForLoadState("networkidle");

    // Verify login form elements
    await expect(freshPage.locator("text=Master of Coin")).toBeVisible();
    await expect(
      freshPage.locator("text=Sign in to your account"),
    ).toBeVisible();
    await expect(freshPage.locator('input[name="email"]')).toBeVisible();
    await expect(freshPage.locator('input[name="password"]')).toBeVisible();
    await expect(freshPage.locator('button[type="submit"]')).toBeVisible();
    await expect(freshPage.locator("text=Sign up")).toBeVisible();

    // Screenshot for verification
    await screenshotHelper.capturePageScreenshot(freshPage, "login-page");
  });

  test("successful login redirects to dashboard", async ({ freshPage }) => {
    await login(freshPage);

    // Should be on dashboard
    expect(freshPage.url()).toContain("/dashboard");

    // Dashboard content should be visible
    const heading = freshPage.locator("h1").first();
    await expect(heading).toContainText("Dashboard");
  });

  test("failed login with wrong password shows error", async ({
    freshPage,
  }) => {
    await freshPage.goto("/login");
    await freshPage.waitForLoadState("networkidle");
    await freshPage.fill('input[name="email"]', "test@local.com");
    await freshPage.fill('input[name="password"]', "wrong_password");
    await freshPage.click('button[type="submit"]');

    // Wait for error message to appear — the LoginPage renders errors in a
    // Box with bg="red.50" containing text like "Login failed..." or an API message.
    const errorBox = freshPage
      .locator("text=/Login failed|Invalid|credentials|error|unauthorized/i")
      .first();
    await expect(errorBox).toBeVisible({ timeout: 10_000 });

    // Should still be on login page
    expect(freshPage.url()).toContain("/login");

    // Screenshot for verification
    await screenshotHelper.capturePageScreenshot(freshPage, "login-error");
  });

  test("failed login with non-existent email shows error", async ({
    freshPage,
  }) => {
    await freshPage.goto("/login");
    await freshPage.waitForLoadState("networkidle");
    await freshPage.fill('input[name="email"]', "nonexistent@example.com");
    await freshPage.fill('input[name="password"]', "some_password");
    await freshPage.click('button[type="submit"]');

    // Wait for error message
    const errorBox = freshPage
      .locator(
        "text=/Login failed|Invalid|credentials|error|unauthorized|not found/i",
      )
      .first();
    await expect(errorBox).toBeVisible({ timeout: 10_000 });
  });

  test("empty form submission does not navigate away", async ({
    freshPage,
  }) => {
    await freshPage.goto("/login");

    // Try to submit empty form (HTML5 validation should prevent it)
    await freshPage.click('button[type="submit"]');

    // Should still be on login page
    expect(freshPage.url()).toContain("/login");
  });

  test("unauthenticated user is redirected to login", async ({ freshPage }) => {
    // Try to access a protected page without auth (fresh context has no token)
    await freshPage.goto("/dashboard");

    // The ProtectedRoute component checks auth and redirects to /login.
    await expect(freshPage).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe("Registration Flow", () => {
  test("register page is accessible from login", async ({ freshPage }) => {
    await freshPage.goto("/login");
    await freshPage.click("text=Sign up");

    // Should navigate to register page
    await freshPage.waitForURL("**/register", { timeout: 5_000 });
    expect(freshPage.url()).toContain("/register");

    // Screenshot for verification
    await screenshotHelper.capturePageScreenshot(freshPage, "register-page");
  });
});
