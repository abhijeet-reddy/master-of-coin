import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { api } from "../../helpers/api";
import { failNextWrite, openSettings } from "../../helpers/settings";

/**
 * Settings (UI v2): tabs in the URL, profile, password, preferences and
 * about. Writes that would change the shared test account are restored, or
 * answered by a routed response when the server state cannot be staged.
 */

interface Me {
  name: string;
  email: string;
}
interface Prefs {
  default_currency: string;
  date_format: string;
  number_locale: string;
  week_start: number;
}

test.describe("Settings", () => {
  test("every tab is reachable and kept in the URL", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    await openSettings(page);
    for (const [name, slug] of [
      ["Preferences", "preferences"],
      ["Security", "security"],
      ["Integrations", "integrations"],
      ["API keys", "api-keys"],
      ["About", "about"],
    ]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`[?&]tab=${slug}`));
    }
    await page.reload();
    await expect(page.getByRole("tab", { name: "About" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expectNoConsoleErrors(errors);
  });

  test("legacy tab names still open the right tab", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings?tab=api_keys");
    await expect(page.getByRole("tab", { name: "API keys" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("about shows the deployed version", async ({
    authenticatedPage: page,
  }) => {
    const v = await api<{ version: string; commit: string }>(
      page,
      "GET",
      "/version",
    );
    await openSettings(page, "about");
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByText("Version", { exact: true })).toBeVisible();
    await expect(
      panel.getByText(
        v.version === "dev"
          ? "Development build"
          : `v${v.version.replace(/^v/, "")}`,
      ),
    ).toBeVisible();
    await expect(panel.getByText(v.commit, { exact: true })).toBeVisible();
  });

  test("saves the profile name and restores it", async ({
    authenticatedPage: page,
  }) => {
    const me = await api<Me>(page, "GET", "/auth/me");
    await openSettings(page, "profile");
    const name = page.getByLabel("Name");
    await expect(name).toHaveValue(me.name);
    await name.fill(`${me.name} E2E`);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved").first()).toBeVisible();
    expect((await api<Me>(page, "GET", "/auth/me")).name).toBe(
      `${me.name} E2E`,
    );

    await api(page, "PATCH", "/auth/me", { name: me.name });
  });

  test("an email already in use is a form message", async ({
    authenticatedPage: page,
  }) => {
    await openSettings(page, "profile");
    await failNextWrite(page, /\/auth\/me$/, 409, "Email already exists");
    await page.getByLabel("Email").fill("someone-else@local.com");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      page.getByText("Another account already uses this email"),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  test("a 403 from an API key explains that a session is needed", async ({
    authenticatedPage: page,
  }) => {
    await openSettings(page, "profile");
    await failNextWrite(page, /\/auth\/me$/, 403, "Insufficient permissions");
    await page.getByLabel("Name").fill("Blocked name");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "needs a signed-in session" }),
    ).toBeVisible();
  });

  test("password change validates and rejects a wrong current password", async ({
    authenticatedPage: page,
  }) => {
    await openSettings(page, "security");
    await page.getByLabel("Current password").fill("not-my-password");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Confirm new password").fill("different");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();

    await page
      .getByLabel("New password", { exact: true })
      .fill("a-new-password-1");
    await page.getByLabel("Confirm new password").fill("a-new-password-1");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(
      page.getByText("That is not your current password"),
    ).toBeVisible();
  });

  test("preferences save to the server and reformat dates", async ({
    authenticatedPage: page,
  }) => {
    const before = await api<Prefs>(page, "GET", "/preferences");
    const target =
      before.date_format === "YYYY-MM-DD" ? "DD/MM/YYYY" : "YYYY-MM-DD";
    await openSettings(page, "preferences");

    await page.getByRole("combobox", { name: "Date format" }).click();
    await page.getByRole("option", { name: new RegExp(target) }).click();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Preferences saved").first()).toBeVisible();
    expect((await api<Prefs>(page, "GET", "/preferences")).date_format).toBe(
      target,
    );

    // The example line uses the new format straight away.
    const example =
      target === "YYYY-MM-DD" ? /\d{4}-\d{2}-\d{2}/ : /\d{2}\/\d{2}\/\d{4}/;
    await expect(page.getByText(/for example/)).toContainText(example);

    await api(page, "PUT", "/preferences", before);
  });

  test("the theme is a client choice", async ({ authenticatedPage: page }) => {
    await openSettings(page, "preferences");
    const theme = page.getByRole("radiogroup", { name: "Theme" });
    await theme.getByRole("radio", { name: "Light" }).click();
    await expect(theme.getByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await theme.getByRole("radio", { name: "Dark" }).click();
    await expect(theme.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
