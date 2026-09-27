import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  createDebtTx,
  createPerson,
  createTx,
  ledger,
  openLedger,
  rowButton,
  tag,
} from "../../helpers/transactions";

/**
 * Debt transactions (someone else paid), UI v2. The row and the detail say
 * "Paid by <name>" in words, never colour alone; regular expenses do not.
 * The People page views are covered by the People specs.
 */

async function debtFixture(page: import("@playwright/test").Page) {
  const person = await createPerson(page, tag("Payer "));
  const title = tag("E2E shared lunch ");
  const tx = await createDebtTx(page, person.id, title, -100);
  return { person, title, tx };
}

test.describe("Debt amount display", () => {
  test("the row names the payer and shows the amount", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const { person, title } = await debtFixture(page);
    await openLedger(page, `q=${encodeURIComponent(title)}`);

    await expect(rowButton(page, title)).toBeVisible();
    await expect(ledger(page)).toContainText(`Paid by ${person.name}`);
    await expect(ledger(page)).toContainText("100.00");
    expectNoConsoleErrors(errors);
  });

  test("paid=only lists it, paid=exclude hides it", async ({
    authenticatedPage: page,
  }) => {
    const { title } = await debtFixture(page);
    await openLedger(page, `q=${encodeURIComponent(title)}&paid=only`);
    await expect(rowButton(page, title)).toBeVisible();
    await openLedger(page, `q=${encodeURIComponent(title)}&paid=exclude`);
    await expect(rowButton(page, title)).toBeHidden();
  });

  test("the detail page shows who paid", async ({ authenticatedPage: page }) => {
    const { person, title, tx } = await debtFixture(page);
    await page.goto(`/transactions/${tx.id}`);
    const detail = page.getByRole("article", { name: title });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("100.00");
    await expect(detail.getByText("Paid by", { exact: true })).toBeVisible();
    await expect(detail).toContainText(person.name);
  });

  test("a regular expense has no payer badge", async ({
    authenticatedPage: page,
  }) => {
    const title = tag("E2E regular ");
    await createTx(page, title, -75);
    await openLedger(page, `q=${encodeURIComponent(title)}`);
    await expect(rowButton(page, title)).toBeVisible();
    await expect(ledger(page)).not.toContainText("Paid by");
  });
});
