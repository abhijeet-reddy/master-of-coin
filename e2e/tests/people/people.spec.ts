import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { cardAction } from "../../helpers/budgets";
import {
  createSplitTx,
  openPeople,
  openPerson,
  personRow,
  removePerson,
} from "../../helpers/people";
import { createDebtTx, createPerson, tag } from "../../helpers/transactions";

/**
 * People (UI v2): the debt overview, create, edit, delete, the split
 * provider link and the detail page. Each test creates its own people.
 */

test.describe("People", () => {
  test("shows the debt overview and the list", async ({ authenticatedPage: page }) => {
    const errors = collectConsoleErrors(page);
    const person = await createPerson(page, tag("E2E list "));
    await openPeople(page);

    const overview = page.getByLabel("Debt overview");
    for (const stat of ["Owed to you", "You owe", "Net", "Open balances"]) {
      await expect(overview.getByText(stat, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Add person" }).first()).toBeVisible();
    await expect(personRow(page, person.name)).toBeVisible();
    await expect(personRow(page, person.name)).toContainText("Settled up");
    expectNoConsoleErrors(errors);
    await removePerson(page, person.id);
  });

  test("search and the show filter narrow the list", async ({ authenticatedPage: page }) => {
    const owes = await createPerson(page, tag("E2E owes "));
    await createSplitTx(page, owes.id, tag("E2E dinner "), 40, 20);
    await openPeople(page, `q=${encodeURIComponent(owes.name)}`);

    await expect(personRow(page, owes.name)).toBeVisible();
    await page.getByRole("button", { name: /^You owe/ }).click();
    await expect(page).toHaveURL(/show=i-owe/);
    await expect(personRow(page, owes.name)).toBeHidden();
    await page.getByRole("button", { name: /^Owe you/ }).click();
    await expect(personRow(page, owes.name)).toBeVisible();
    await expect(personRow(page, owes.name)).toContainText("Owes you");
  });

  test("adds a person from the dialog", async ({ authenticatedPage: page }) => {
    const name = tag("E2E add ");
    await openPeople(page);
    await page.getByRole("button", { name: "Add person" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Add person" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Email").fill("not-an-email");
    await dialog.getByRole("button", { name: "Add person" }).click();
    await expect(dialog.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");

    await dialog.getByLabel("Email").fill("e2e@example.com");
    await dialog.getByRole("button", { name: "Add person" }).click();
    await expect(dialog).toBeHidden();
    await expect(personRow(page, name)).toBeVisible();
    await expect(personRow(page, name)).toContainText("e2e@example.com");
  });

  test("edits a person from the list menu", async ({ authenticatedPage: page }) => {
    const person = await createPerson(page, tag("E2E edit "));
    const renamed = `${person.name} B`;
    await openPeople(page, `q=${encodeURIComponent(person.name)}`);

    await cardAction(page, person.name, "Edit");
    const dialog = page.getByRole("dialog", { name: "Edit person" });
    await expect(dialog.getByLabel("Name")).toHaveValue(person.name);
    await dialog.getByLabel("Name").fill(renamed);
    await dialog.getByLabel("Notes").fill("Met at work");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toBeHidden();
    await expect(personRow(page, renamed)).toBeVisible();
    await removePerson(page, person.id);
  });

  test("deletes a person with no shared transactions", async ({ authenticatedPage: page }) => {
    const person = await createPerson(page, tag("E2E delete "));
    await openPerson(page, person.id, person.name);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `Delete ${person.name}?` });
    await dialog.getByRole("button", { name: "Delete person" }).click();

    await expect(page).toHaveURL(/\/people$/);
    await expect(personRow(page, person.name)).toBeHidden();
  });

  test("a person with shared transactions cannot be deleted, the error stays in the dialog", async ({
    authenticatedPage: page,
  }) => {
    const person = await createPerson(page, tag("E2E keep "));
    await createSplitTx(page, person.id, tag("E2E shared "), 30, 15);
    await openPerson(page, person.id, person.name);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `Delete ${person.name}?` });
    await dialog.getByRole("button", { name: "Delete person" }).click();

    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/people/${person.id}$`));
  });

  test("the detail page shows balance, history, breadcrumb and the ledger", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const person = await createPerson(page, tag("E2E detail "));
    const title = tag("E2E split ");
    await createSplitTx(page, person.id, title, 50, 25);

    await openPeople(page, `q=${encodeURIComponent(person.name)}`);
    await personRow(page, person.name).getByRole("link", { name: person.name }).click();
    await expect(page).toHaveURL(new RegExp(`/people/${person.id}$`));

    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "People" })).toBeVisible();
    const balance = page.getByRole("region", { name: "Balance" });
    await expect(balance).toContainText("Owes you");
    await expect(balance).toContainText("25.00");
    await expect(page.getByRole("region", { name: "Debt history" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Split provider" })).toBeVisible();

    const ledger = page.getByRole("region", { name: "Ledger" });
    await expect(ledger.getByRole("button", { name: title, exact: true })).toBeVisible();
    expectNoConsoleErrors(errors);
  });

  test("a debt someone else paid shows on their detail page", async ({
    authenticatedPage: page,
  }) => {
    const person = await createPerson(page, tag("E2E payer "));
    const title = tag("E2E shared lunch ");
    await createDebtTx(page, person.id, title, -100);
    await openPerson(page, person.id, person.name);

    const ledger = page.getByRole("region", { name: "Ledger" });
    await expect(ledger.getByRole("button", { name: title, exact: true })).toBeVisible();
    await expect(ledger).toContainText(`Paid by ${person.name}`);
    await expect(ledger).toContainText("100.00");
  });

  test("a history link opens the transaction with People in the breadcrumb", async ({
    authenticatedPage: page,
  }) => {
    const person = await createPerson(page, tag("E2E crumb "));
    const title = tag("E2E crumb tx ");
    await createSplitTx(page, person.id, title, 20, 10);
    await openPerson(page, person.id, person.name);

    await page
      .getByRole("region", { name: "Debt history" })
      .getByRole("link", { name: new RegExp(title) })
      .click();
    await expect(page).toHaveURL(/\/transactions\/[^/]+$/);
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "People" })).toBeVisible();
    await expect(crumbs.getByRole("link", { name: person.name })).toBeVisible();
  });

  test("the split provider link dialog opens from the detail page", async ({
    authenticatedPage: page,
  }) => {
    const person = await createPerson(page, tag("E2E link "));
    await openPerson(page, person.id, person.name);

    const panel = page.getByRole("region", { name: "Split provider" });
    await expect(panel.getByText("Not linked")).toBeVisible();
    await panel.getByRole("button", { name: "Link split provider" }).click();
    const dialog = page.getByRole("dialog", { name: "Link split provider" });
    await expect(dialog).toBeVisible();
    // Either a provider to pick from, or a pointer to connect one in Settings.
    await expect(
      dialog.getByLabel("Provider").or(dialog.getByRole("link", { name: /Settings/ })),
    ).toBeVisible();
    await removePerson(page, person.id);
  });

  test("an unknown id shows not found", async ({ authenticatedPage: page }) => {
    await page.goto("/people/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Person not found")).toBeVisible();
  });
});
