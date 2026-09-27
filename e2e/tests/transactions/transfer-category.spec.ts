import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { categories, openLedger } from "../../helpers/transactions";

/**
 * The Transfer dialog pre-selects the "Transfer" category when one exists
 * (#51), UI v2.
 */

test.describe("Transfer form category (#51)", () => {
  test("pre-selects the Transfer category", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const hasTransfer = (await categories(page)).some(
      (c) => c.name.toLowerCase() === "transfer",
    );
    await openLedger(page);
    await page.getByRole("button", { name: "Transfer", exact: true }).first().click();

    const dialog = page.getByRole("dialog", { name: "Transfer" });
    await expect(dialog).toBeVisible();
    const category = dialog.getByLabel("Category");
    if (hasTransfer) await expect(category).toContainText(/Transfer/);
    else await expect(category).toContainText("Uncategorised");
    expectNoConsoleErrors(errors);
  });

  test("offers From, To, Amount, Date and Time", async ({
    authenticatedPage: page,
  }) => {
    await openLedger(page);
    await page.getByRole("button", { name: "Transfer", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Transfer" });
    for (const label of ["From", "To", "Amount", "Date", "Time"]) {
      await expect(dialog.getByLabel(label, { exact: true })).toBeVisible();
    }
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });
});
