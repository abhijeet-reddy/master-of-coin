import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { createAccount, openAccount, removeAccount, uniqueName } from "../../helpers/accounts";
import { createTx, ledger, openLedger, rowButton } from "../../helpers/transactions";
import { createBudget, openBudget, removeBudget } from "../../helpers/budgets";

/**
 * Issue #52: a transaction's full page keeps the trail it was opened from.
 * The ledger's drawer passes its origin through router state; a direct visit
 * falls back to Transactions.
 */

const crumbs = (page: Page) => page.getByRole("navigation", { name: "Breadcrumb" });

async function openFullPage(page: Page, title: string) {
  await rowButton(page, title).click();
  const drawer = page.getByRole("dialog", { name: "Transaction" });
  await drawer.getByRole("link", { name: "Open as a full page" }).click();
  await expect(page).toHaveURL(/\/transactions\/[^/?]+$/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

test.describe("Breadcrumb navigation source (#52)", () => {
  test("from the Transactions ledger the trail is Transactions", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const title = uniqueName("E2E Crumb Tx");
    await createTx(page, title, -3);
    await openLedger(page);

    await openFullPage(page, title);
    await expect(crumbs(page).getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "href",
      "/transactions",
    );
    await expect(crumbs(page).getByRole("link", { name: "Accounts" })).toHaveCount(0);
    expectNoConsoleErrors(errors);
  });

  test("from an account the trail is Accounts then the account", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Crumb Acc");
    const acc = await createAccount(page, name, { type: "CASH" });
    const title = uniqueName("E2E Crumb AccTx");
    await createTx(page, title, -4, { account_id: acc.id });
    await openAccount(page, acc.id, name);
    await expect(ledger(page)).toBeVisible();

    await openFullPage(page, title);
    const nav = crumbs(page);
    await expect(nav.getByRole("link", { name: "Accounts" })).toHaveAttribute("href", "/accounts");
    await expect(nav.getByRole("link", { name })).toHaveAttribute("href", `/accounts/${acc.id}`);
    await expect(nav.getByRole("link", { name: "Transactions" })).toHaveCount(0);

    await nav.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`/accounts/${acc.id}$`));
    await removeAccount(page, acc.id);
  });

  test("from a budget the trail is Budgets then the budget", async ({
    authenticatedPage: page,
  }) => {
    const acc = await createAccount(page, uniqueName("E2E Crumb BAcc"), { type: "CASH" });
    const name = uniqueName("E2E Crumb Bud");
    const b = await createBudget(page, name, { accountId: acc.id });
    const title = uniqueName("E2E Crumb BudTx");
    await createTx(page, title, -6, { account_id: acc.id });
    await openBudget(page, b.id, name);
    await expect(ledger(page)).toBeVisible();

    await openFullPage(page, title);
    const nav = crumbs(page);
    await expect(nav.getByRole("link", { name: "Budgets" })).toHaveAttribute("href", "/budgets");
    await expect(nav.getByRole("link", { name })).toHaveAttribute("href", `/budgets/${b.id}`);

    await removeBudget(page, b.id);
    await removeAccount(page, acc.id);
  });

  test("a direct visit falls back to Transactions", async ({ authenticatedPage: page }) => {
    const title = uniqueName("E2E Crumb Direct");
    const tx = await createTx(page, title, -2);
    await page.goto(`/transactions/${tx.id}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(crumbs(page).getByRole("link", { name: "Transactions" })).toBeVisible();
  });
});
