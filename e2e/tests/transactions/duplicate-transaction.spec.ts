import { test, expect } from "../../fixtures/test-fixtures";
import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  createTransfer,
  createTx,
  openLedger,
  tag,
} from "../../helpers/transactions";

/**
 * Duplicate a transaction (UI v2): from the row menu and from the detail
 * page. The copy opens in create mode, pre-filled, dated now. Transfers
 * cannot be duplicated.
 */

/** Earlier this month, so a copy dated today is distinguishable from its source. */
const yesterday = () => {
  const d = new Date();
  if (d.getDate() > 1) d.setDate(d.getDate() - 1);
  else d.setHours(0, 5);
  return d.toISOString();
};

async function openRowMenu(page: Page, title: string) {
  // A transfer has two legs with the same title; either menu will do.
  await page
    .getByRole("button", { name: `More actions for ${title}` })
    .first()
    .click();
  return page.getByRole("menu");
}

async function expectPrefilledCopy(page: Page, title: string, amount: string) {
  const dialog = page.getByRole("dialog", { name: "Duplicate transaction" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Title")).toHaveValue(title);
  // The copy may show 4.5 or 4.50; the number is what matters.
  await expect(dialog.getByLabel("Amount")).toHaveValue(
    new RegExp(`^${amount.replace(".", "\\.")}0*$`),
  );
  // The date is today, not the source's date.
  const d = new Date();
  await expect(dialog.getByLabel("Date")).toContainText(String(d.getFullYear()));
  await expect(dialog.getByLabel("Date")).toContainText(
    String(d.getDate()).padStart(2, "0"),
  );
  await expect(dialog.getByRole("button", { name: "Add copy" })).toBeVisible();
  return dialog;
}

test.describe("Duplicate transaction", () => {
  test("row menu opens a pre-filled copy in create mode", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const title = tag("E2E dup ");
    await createTx(page, title, -18.25, { date: yesterday() });
    await openLedger(page, `q=${encodeURIComponent(title)}`);

    const menu = await openRowMenu(page, title);
    await menu.getByRole("menuitem", { name: "Duplicate" }).click();
    await expectPrefilledCopy(page, title, "18.25");
    expectNoConsoleErrors(errors);
  });

  test("saving the copy adds a second row", async ({
    authenticatedPage: page,
  }) => {
    const title = tag("E2E dup save ");
    await createTx(page, title, -4.5, { date: yesterday() });
    await openLedger(page, `q=${encodeURIComponent(title)}`);

    await (await openRowMenu(page, title))
      .getByRole("menuitem", { name: "Duplicate" })
      .click();
    const dialog = await expectPrefilledCopy(page, title, "4.5");
    await dialog.getByRole("button", { name: "Add copy" }).click();
    await expect(dialog).toBeHidden();

    await openLedger(page, `q=${encodeURIComponent(title)}`);
    await expect(
      page.getByRole("button", { name: title, exact: true }),
    ).toHaveCount(2);
  });

  test("cancel closes the copy without creating anything", async ({
    authenticatedPage: page,
  }) => {
    const title = tag("E2E dup cancel ");
    await createTx(page, title, -2);
    await openLedger(page, `q=${encodeURIComponent(title)}`);
    await (await openRowMenu(page, title))
      .getByRole("menuitem", { name: "Duplicate" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Duplicate transaction" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await openLedger(page, `q=${encodeURIComponent(title)}`);
    await expect(
      page.getByRole("button", { name: title, exact: true }),
    ).toHaveCount(1);
  });

  test("transfers cannot be duplicated", async ({ authenticatedPage: page }) => {
    const title = tag("E2E dup xfer ");
    const made = await createTransfer(page, title, 7);
    test.skip(!made, "needs two accounts in the same currency");
    await openLedger(page, `q=${encodeURIComponent(title)}`);
    const menu = await openRowMenu(page, title);
    await expect(menu.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
  });

  test("detail page Duplicate opens a pre-filled copy", async ({
    authenticatedPage: page,
  }) => {
    const title = tag("E2E dup page ");
    const tx = await createTx(page, title, -9.99, { date: yesterday() });
    await page.goto(`/transactions/${tx.id}`);
    await expect(page.getByRole("article", { name: title })).toBeVisible();
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expectPrefilledCopy(page, title, "9.99");
  });
});
