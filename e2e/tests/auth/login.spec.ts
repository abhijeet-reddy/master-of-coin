import { test, expect } from "@playwright/test";
import { login, logout } from "../../helpers/auth";
import { ScreenshotHelper } from "../../helpers/screenshots";

/**
 * Authentication flow tests.
 *
 * These tests use a fresh browser context (no saved auth state)
 * to test the login and registration flows.
 */

const screenshotHelper = new ScreenshotHelper();

test.describe("Login Flow", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Verify login form elements
    await expect(page.locator("text=Master of Coin")).toBeVisible();
    await expect(page.locator("text=Sign in to your account")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator("text=Sign up")).toBeVisible();

    // Screenshot for verification
    await screenshotHelper.capturePageScreenshot(page, "login-page");
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await login(page);

    // Should be on dashboard
    expect(page.url()).toContain("/dashboard");

    // Dashboard content should be visible
    const heading = page.locator("h1").first();
    await expect(heading).toContainText("Dashboard");
  });

  test("failed login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "test@local.com");
    await page.fill('input[name="password"]', "wrong_password");
    await page.click('button[type="submit"]');

    // Wait for error message to appear
    const errorMessage = page
      .locator("text=Login failed")
      .or(page.locator("text=Invalid").or(page.locator("text=credentials")));
    await expect(errorMessage).toBeVisible({ timeout: 10_000 });

    // Should still be on login page
    expect(page.url()).toContain("/login");

    // Screenshot for verification
    await screenshotHelper.capturePageScreenshot(page, "login-error");
  });

  test("failed login with non-existent email shows error", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "nonexistent@example.com");
    await page.fill('input[name="password"]', "some_password");
    await page.click('button[type="submit"]');

    // Wait for error message
    const errorMessage = page
      .locator('[class*="red"]')
      .or(page.locator("text=Login failed").or(page.locator("text=Invalid")));
    await expect(errorMessage).toBeVisible({ timeout: 10_000 });
  });

  test("empty form submission does not navigate away", async ({ page }) => {
    await page.goto("/login");

    // Try to submit empty form (HTML5 validation should prevent it)
    await page.click('button[type="submit"]');

    // Should still be on login page
    expect(page.url()).toContain("/login");
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    // Try to access a protected page without auth
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should be redirected to login
    await page.waitForURL("**/login", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Registration Flow", () => {
  test("register page is accessible from login", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Sign up");

    // Should navigate to register page
    await page.waitForURL("**/register", { timeout: 5_000 });
    expect(page.url()).toContain("/register");

    // Screenshot for verification
    await screenshotHelper.capturePageScreenshot(page, "register-page");
  });
});
