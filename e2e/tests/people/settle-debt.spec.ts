import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  allAccounts,
  createSplitTx,
  getPerson,
  openPerson,
  spendAccount,
} from "../../helpers/people";
import { createDebtTx, createPerson, tag } from "../../helpers/transactions";

/**
 * Settling up (UI v2). The dialog pre-fills the full debt, caps the amount
 * at it, lists only active accounts, keeps errors inline and records one
 * settlement transaction that brings the balance back to zero.
 */

async function owingPerson(page: import("@playwright/test").Page, share = 20) {
  const person = await createPerson(page, tag("E2E settle "));
  await createSplitTx(page, person.id, tag("E2E split "), share * 2, share);
  return person;
}

async function openSettle(page: import("@playwright/test").Page, id: string, name: string) {
  await openPerson(page, id, name);
  await page.getByRole("button", { name: "Settle up" }).click();
  const dialog = page.getByRole("dialog", { name: `Settle up with ${name}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Settle debt", () => {
  test("settle up is disabled when nothing is owed", async ({ authenticatedPage: page }) => {
    const person = await createPerson(page, tag("E2E even "));
    await openPerson(page, person.id, person.name);
    await expect(page.getByRole("button", { name: "Settle up" })).toBeDisabled();
  });

  test("the dialog pre-fills the full debt and closes on cancel", async ({
    authenticatedPage: page,
  }) => {
    const person = await owingPerson(page, 20);
    const dialog = await openSettle(page, person.id, person.name);

    await expect(dialog).toContainText(`${person.name} owes you`);
    await expect(dialog.getByLabel("Amount")).toHaveValue("20.00");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("the account picker hides archived accounts", async ({ authenticatedPage: page }) => {
    const person = await owingPerson(page);
    const accounts = await allAccounts(page);
    const dialog = await openSettle(page, person.id, person.name);

    await dialog.getByLabel("Paid into").click();
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();
    for (const a of accounts.filter((x) => x.archived_at)) {
      await expect(page.getByRole("option", { name: new RegExp(`^${a.name}`) })).toHaveCount(0);
    }
    await page.keyboard.press("Escape");
  });

  test("the amount is capped at the debt and an account is preselected", async ({
    authenticatedPage: page,
  }) => {
    const person = await owingPerson(page, 20);
    const dialog = await openSettle(page, person.id, person.name);

    await dialog.getByLabel("Amount").fill("25");
    await dialog.getByRole("button", { name: "Record settlement" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Amount")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText("Cannot be more than the debt")).toBeVisible();
    await expect(dialog.getByLabel("Paid into")).not.toHaveText("Choose an account");

    await dialog.getByRole("button", { name: "Full amount" }).click();
    await expect(dialog.getByLabel("Amount")).toHaveValue("20.00");
    await expect(dialog.getByLabel("Amount")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("records a settlement that clears the balance", async ({ authenticatedPage: page }) => {
    const errors = collectConsoleErrors(page);
    const person = await owingPerson(page, 20);
    const account = await spendAccount(page);
    const dialog = await openSettle(page, person.id, person.name);

    await dialog.getByLabel("Paid into").click();
    await page.getByRole("option", { name: new RegExp(`^${account.name}`) }).first().click();
    const settled = page.waitForRequest(
      (r) => r.url().includes(`/people/${person.id}/settle`) && r.method() === "POST",
    );
    await dialog.getByRole("button", { name: "Record settlement" }).click();
    const body = (await settled).postDataJSON() as { amount: number; account_id: string };
    expect(body).toEqual({ amount: 20, account_id: account.id });

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("region", { name: "Balance" })).toContainText("Settled up");
    await expect(page.getByRole("button", { name: "Settle up" })).toBeDisabled();

    const ledger = page.getByRole("region", { name: "Ledger" });
    await expect(
      ledger.getByRole("button", { name: `Debt settlement with ${person.name}`, exact: true }),
    ).toBeVisible();
    expect(Number((await getPerson(page, person.id)).debt_summary?.net ?? 0)).toBe(0);
    expectNoConsoleErrors(errors);
  });

  test("a partial settlement leaves the rest owed", async ({ authenticatedPage: page }) => {
    const person = await owingPerson(page, 30);
    const account = await spendAccount(page);
    const dialog = await openSettle(page, person.id, person.name);

    await dialog.getByLabel("Amount").fill("10");
    await dialog.getByLabel("Paid into").click();
    await page.getByRole("option", { name: new RegExp(`^${account.name}`) }).first().click();
    await dialog.getByRole("button", { name: "Record settlement" }).click();

    await expect(dialog).toBeHidden();
    const balance = page.getByRole("region", { name: "Balance" });
    await expect(balance).toContainText("Owes you");
    await expect(balance).toContainText("20.00");
  });

  test("settling a debt you owe pays from an account", async ({ authenticatedPage: page }) => {
    const person = await createPerson(page, tag("E2E lender "));
    await createDebtTx(page, person.id, tag("E2E they paid "), -40);
    const dialog = await openSettle(page, person.id, person.name);

    await expect(dialog).toContainText(`You owe ${person.name}`);
    await expect(dialog.getByLabel("Paid from")).toBeVisible();
    await expect(dialog.getByLabel("Amount")).toHaveValue("40.00");
  });
});
