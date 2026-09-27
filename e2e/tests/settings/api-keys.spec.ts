import { test, expect } from "../../fixtures/test-fixtures";
import { api } from "../../helpers/api";
import { tag } from "../../helpers/transactions";
import {
  createApiKey,
  getApiKey,
  keyRow,
  openSettings,
  revokeApiKey,
} from "../../helpers/settings";

/**
 * Settings, API keys tab (UI v2): two-step create, the key shown once,
 * edit without touching the expiry, and revoke behind a confirm. Each test
 * owns its key and revokes it.
 */

test.describe("API keys", () => {
  test("creates a key in two steps and shows it once", async ({
    authenticatedPage: page,
  }) => {
    const name = tag("E2E key ");
    await openSettings(page, "api-keys");
    await page.getByRole("button", { name: "Create API key" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Create API key" });
    await expect(dialog.getByText(/Step 1 of 2/)).toBeVisible();
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("combobox", { name: "Expires" }).click();
    await page.getByRole("option", { name: "30 days" }).click();
    await dialog.getByRole("button", { name: "Next" }).click();

    await expect(dialog.getByText(/Step 2 of 2/)).toBeVisible();
    await dialog.getByRole("button", { name: "Create key" }).click();
    await expect(dialog.getByText(/at least one/i)).toBeVisible();
    await dialog.getByRole("checkbox", { name: "Transactions read" }).check();
    await dialog.getByRole("checkbox", { name: "Budgets write" }).check();
    await dialog.getByRole("button", { name: "Create key" }).click();

    const created = page.getByRole("dialog", { name: "API key created" });
    const secret = created.getByLabel("New API key");
    await expect(secret).not.toBeEmpty();
    await expect(
      created.getByRole("button", { name: /^Cop(y|ied)$/ }),
    ).toBeVisible();
    await created.getByRole("button", { name: "Done" }).click();
    await expect(created).toBeHidden();

    const row = keyRow(page, name);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Transactions read");
    await expect(row).toContainText("Budgets write");
    await expect(row.getByLabel("New API key")).toHaveCount(0);

    const keys = await api<{ api_keys: { id: string; name: string }[] }>(
      page,
      "GET",
      "/api-keys",
    );
    const id = keys.api_keys.find((k) => k.name === name)?.id;
    if (id) await revokeApiKey(page, id);
  });

  test("editing the name keeps the expiry", async ({
    authenticatedPage: page,
  }) => {
    const name = tag("E2E edit ");
    const key = await createApiKey(page, name, 60);
    await openSettings(page, "api-keys");
    await page.getByRole("button", { name: `Edit ${name}` }).click();

    const dialog = page.getByRole("dialog", { name: "Edit API key" });
    await expect(
      dialog.getByRole("combobox", { name: "Expires" }),
    ).toContainText("Keep current expiry");
    await dialog.getByLabel("Name").fill(`${name} renamed`);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(keyRow(page, `${name} renamed`)).toBeVisible();

    const after = await getApiKey(page, key.id);
    expect(after.name).toBe(`${name} renamed`);
    expect(after.expires_at).toBe(key.expires_at);
    await revokeApiKey(page, key.id);
  });

  test("revoking asks first", async ({ authenticatedPage: page }) => {
    const name = tag("E2E revoke ");
    const key = await createApiKey(page, name);
    await openSettings(page, "api-keys");
    await page.getByRole("button", { name: `Revoke ${name}` }).click();

    const confirm = page
      .getByRole("alertdialog", { name: "Revoke API key" })
      .or(page.getByRole("dialog", { name: "Revoke API key" }));
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("button", { name: `Revoke ${name}` }),
    ).toBeVisible();

    await page.getByRole("button", { name: `Revoke ${name}` }).click();
    await confirm.getByRole("button", { name: "Revoke key" }).click();
    await expect(keyRow(page, name)).toContainText(/Revoked/i);
    await expect(
      page.getByRole("button", { name: `Revoke ${name}` }),
    ).toHaveCount(0);
    expect((await getApiKey(page, key.id)).status).toBe("revoked");
  });

  test("shows an empty state with no keys", async ({
    authenticatedPage: page,
  }) => {
    await page.route(/\/api-keys$/, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            json: { api_keys: [] },
            headers: { "access-control-allow-origin": "*" },
          })
        : route.fallback(),
    );
    await openSettings(page, "api-keys");
    await expect(page.getByText("No API keys")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create API key" }),
    ).toBeVisible();
  });
});
