import { test, expect } from "../../fixtures/test-fixtures";
import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  createPerson,
  openLedger,
  rowButton,
  tag,
} from "../../helpers/transactions";

/**
 * Splits on income as well as expenses (#53, #59), UI v2. The "Split with
 * others" switch shows for both types, survives switching type, and an
 * income split saves.
 */

async function openAdd(page: Page) {
  await openLedger(page);
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Add transaction" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Split payment on income and expenses (#53, #59)", () => {
  test("the split switch shows for money in", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const d = await openAdd(page);
    await d.getByRole("radio", { name: "Money in" }).check();
    await expect(d.getByRole("switch", { name: "Split with others" })).toBeVisible();
    expectNoConsoleErrors(errors);
  });

  test("the split switch shows for money out", async ({
    authenticatedPage: page,
  }) => {
    const d = await openAdd(page);
    await expect(d.getByRole("radio", { name: "Money out" })).toBeChecked();
    await expect(d.getByRole("switch", { name: "Split with others" })).toBeVisible();
  });

  test("an enabled split survives switching type both ways", async ({
    authenticatedPage: page,
  }) => {
    const d = await openAdd(page);
    const sw = d.getByRole("switch", { name: "Split with others" });
    await sw.click();
    await expect(sw).toBeChecked();
    await expect(d.getByRole("button", { name: "Add person" })).toBeVisible();

    await d.getByRole("radio", { name: "Money in" }).check();
    await expect(sw).toBeChecked();
    await d.getByRole("radio", { name: "Money out" }).check();
    await expect(sw).toBeChecked();
    await expect(d.getByRole("button", { name: "Add person" })).toBeVisible();
  });

  test("the split switch is replaced when someone else paid", async ({
    authenticatedPage: page,
  }) => {
    const d = await openAdd(page);
    await d.getByRole("radio", { name: "Someone else" }).check();
    await expect(d.getByRole("switch", { name: "Split with others" })).toBeHidden();
    await expect(d.getByLabel("Paid by")).toBeVisible();
  });

  test("an income split saves and shows on the row", async ({
    authenticatedPage: page,
  }) => {
    const person = await createPerson(page, tag("Split pal "));
    const title = tag("E2E split in ");
    const d = await openAdd(page);
    await d.getByRole("radio", { name: "Money in" }).check();
    await d.getByLabel("Account").click();
    await page.getByRole("option").first().click();
    await d.getByLabel("Title").fill(title);
    await d.getByLabel("Amount").fill("40");
    await d.getByRole("switch", { name: "Split with others" }).click();
    await d.getByRole("button", { name: "Add person" }).click();
    await d.getByRole("combobox", { name: "Person 1" }).click();
    await page.getByRole("option", { name: person.name }).click();
    await d.getByRole("button", { name: "Split equally" }).click();
    await expect(d.getByLabel("Owes")).toHaveValue("20.00");
    await d.getByRole("button", { name: "Add transaction" }).click();
    await expect(d).toBeHidden();

    await openLedger(page, `q=${encodeURIComponent(title)}`);
    await expect(rowButton(page, title)).toBeVisible();
    await expect(page.getByRole("region", { name: "Ledger" })).toContainText(
      new RegExp(`Split\\s*${person.name}`, "i"),
    );
  });
});
