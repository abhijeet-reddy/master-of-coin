import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  card,
  createAccount,
  openAccount,
  openAccounts,
  removeAccount,
  uniqueName,
} from "../../helpers/accounts";

/**
 * Account detail (UI v2): panels, breadcrumb, the account-scoped ledger
 * with add-transaction pre-filled (#49), the error state, and the
 * TrueLayer return landing back on the account.
 */

test.describe("Account detail", () => {
  test("opens from its card with panels, breadcrumb and the ledger", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const name = uniqueName("E2E Detail");
    const acc = await createAccount(page, name, { type: "CASH", balance: 10 });
    await openAccounts(page);

    await card(page, name).getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/${acc.id}$`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "href",
      "/accounts",
    );
    for (const panel of ["Account", "Balance history", "Provider", "Drift"]) {
      await expect(page.getByRole("region", { name: new RegExp(panel) }).first()).toBeVisible();
    }
    // A manual cash account has nothing to sync.
    await expect(page.getByRole("button", { name: /^Sync (bank|portfolio)/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Ledger" })).toBeVisible();
    expectNoConsoleErrors(errors);

    await removeAccount(page, acc.id);
  });

  test("Add transaction pre-selects the account (#49)", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Prefill");
    const acc = await createAccount(page, name, { type: "CHECKING" });
    await openAccount(page, acc.id, name);

    await page.getByRole("button", { name: "Add transaction", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Account")).toContainText(name);
    await page.keyboard.press("Escape");

    await removeAccount(page, acc.id);
  });

  test("an unknown account shows an error with a way back", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/accounts/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Couldn't load this account")).toBeVisible();
    await page.getByRole("link", { name: "Back to accounts" }).click();
    await expect(page).toHaveURL(/\/accounts$/);
  });

  test("the TrueLayer callback lands back on the account with a toast", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Bank");
    const acc = await createAccount(page, name, { type: "CHECKING" });
    await openAccount(page, acc.id, name);

    // What the Connect flow stores before leaving for TrueLayer.
    await page.evaluate(
      (id) => sessionStorage.setItem("moc.bankConnect.accountId", id),
      acc.id,
    );
    await page.goto("/settings?bank_connected=true");
    await expect(page).toHaveURL(new RegExp(`/accounts/${acc.id}$`));
    await expect(page.getByText("Bank connected", { exact: true }).first()).toBeVisible();

    await removeAccount(page, acc.id);
  });
});
