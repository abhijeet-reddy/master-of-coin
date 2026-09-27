import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { createAccount, removeAccount, uniqueName } from "../../helpers/accounts";
import {
  card,
  cardAction,
  createBudget,
  monthDaysLeft,
  openBudgets,
  pick,
  removeBudget,
} from "../../helpers/budgets";

/**
 * Budgets list (UI v2): every budget shows, the period filter, days left,
 * create and edit through the modal (limit, period, filters), validation,
 * and delete. Notes were dropped: the modal has no notes field.
 */

test.describe("Budgets", () => {
  test("lists every budget with days left and the overall panels", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const monthly = uniqueName("E2E Monthly");
    const weekly = uniqueName("E2E Weekly");
    const a = await createBudget(page, monthly, { limit: 300 });
    const b = await createBudget(page, weekly, { limit: 50, period: "WEEKLY" });
    await openBudgets(page);

    for (const region of ["Overall", "Pace monitor", "Budgets", "Budget detail"]) {
      await expect(page.getByRole("region", { name: region, exact: true })).toBeVisible();
    }
    await expect(card(page, monthly)).toBeVisible();
    await expect(card(page, weekly)).toBeVisible();
    const left = monthDaysLeft();
    await expect(card(page, monthly)).toContainText(`${left} ${left === 1 ? "day" : "days"} left`);
    await expect(page.getByRole("region", { name: "Overall" })).toContainText("Average use");
    expectNoConsoleErrors(errors);

    await removeBudget(page, a.id);
    await removeBudget(page, b.id);
  });

  test("the period filter narrows the cards", async ({ authenticatedPage: page }) => {
    const monthly = uniqueName("E2E Filter M");
    const weekly = uniqueName("E2E Filter W");
    const a = await createBudget(page, monthly);
    const b = await createBudget(page, weekly, { period: "WEEKLY" });
    await openBudgets(page);

    const group = page.getByRole("group", { name: "Period" });
    await group.getByRole("button", { name: /^Weekly/ }).click();
    await expect(page).toHaveURL(/period=WEEKLY/);
    await expect(card(page, weekly)).toBeVisible();
    await expect(card(page, monthly)).toHaveCount(0);
    await group.getByRole("button", { name: /^All/ }).click();
    await expect(card(page, monthly)).toBeVisible();

    await removeBudget(page, a.id);
    await removeBudget(page, b.id);
  });

  test("selecting a card shows it in the side panel", async ({ authenticatedPage: page }) => {
    const name = uniqueName("E2E Select");
    const b = await createBudget(page, name, { limit: 123 });
    await openBudgets(page);

    await card(page, name).getByRole("button", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`open=${b.id}`));
    const side = page.getByRole("region", { name: "Budget detail" });
    await expect(side).toContainText(name);
    await expect(side.getByRole("link", { name: "Open budget" })).toHaveAttribute(
      "href",
      `/budgets/${b.id}`,
    );

    await removeBudget(page, b.id);
  });

  test("creates a budget; the account picker hides archived accounts", async ({
    authenticatedPage: page,
  }) => {
    const accName = uniqueName("E2E Bud Acc");
    const archivedName = uniqueName("E2E Bud Old");
    const acc = await createAccount(page, accName, { type: "CASH" });
    const old = await createAccount(page, archivedName, { type: "CASH" });
    const headers = { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("auth_token"))}` };
    await page.request.post(`${process.env.E2E_API ?? "/api/v1"}/accounts/${old.id}/archive`, { headers });
    const name = uniqueName("E2E Created");
    await openBudgets(page);

    await page.getByRole("button", { name: "Create budget" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create budget" });
    await expect(dialog.getByLabel("Notes")).toHaveCount(0);
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Account", { exact: true }).click();
    await expect(page.getByRole("option", { name: new RegExp(`^${accName}`) })).toBeVisible();
    await expect(page.getByRole("option", { name: new RegExp(`^${archivedName}`) })).toHaveCount(0);
    await page.getByRole("option", { name: new RegExp(`^${accName}`) }).click();
    await pick(page, "Period", "Weekly");
    await dialog.getByLabel("Limit").fill("75");
    await dialog.getByRole("button", { name: "Create budget" }).click();

    await expect(dialog).toBeHidden();
    await expect(card(page, name)).toBeVisible();
    await expect(card(page, name)).toContainText("Weekly");
    await expect(card(page, name)).toContainText("75.00");

    const id = new URL(page.url()).searchParams.get("open");
    if (id) await removeBudget(page, id);
    await removeAccount(page, acc.id);
    await removeAccount(page, old.id);
  });

  test("shows field errors for a blank name and a zero limit", async ({
    authenticatedPage: page,
  }) => {
    await openBudgets(page);
    await page.getByRole("button", { name: "Create budget" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create budget" });
    await dialog.getByLabel("Limit").fill("0");
    await dialog.getByRole("button", { name: "Create budget" }).click();
    await expect(dialog.getByText("Name is required")).toBeVisible();
    await expect(dialog.getByText(/Enter a limit above zero/)).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
  });

  test("edits the limit and period of the current range", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Edit");
    const b = await createBudget(page, name, { limit: 200 });
    await openBudgets(page);

    await cardAction(page, name, "Edit");
    const dialog = page.getByRole("dialog", { name: "Edit budget" });
    await expect(dialog.getByLabel("Limit")).toHaveValue("200");
    await dialog.getByLabel("Limit").fill("320");
    await pick(page, "Period", "Quarterly");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toBeHidden();
    await expect(card(page, name)).toContainText("Quarterly");
    await expect(card(page, name)).toContainText("320.00");

    await removeBudget(page, b.id);
  });

  test("deletes a budget after confirming", async ({ authenticatedPage: page }) => {
    const name = uniqueName("E2E Delete");
    await createBudget(page, name);
    await openBudgets(page);

    await cardAction(page, name, "Delete");
    const confirm = page.getByRole("dialog", { name: `Delete ${name}?` });
    await expect(confirm).toContainText(name);
    await confirm.getByRole("button", { name: "Delete budget" }).click();
    await expect(card(page, name)).toHaveCount(0);
  });
});
