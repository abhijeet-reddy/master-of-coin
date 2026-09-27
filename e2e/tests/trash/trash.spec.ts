import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { api } from "../../helpers/api";
import { createTx, ledger, openLedger, rowButton, tag } from "../../helpers/transactions";

/**
 * Trash (UI v2): soft-deleted transactions with restore, bulk restore and
 * delete forever. Each test trashes its own transactions through the API.
 */

async function trashed(page: Page, prefix: string) {
  const title = tag(prefix);
  const tx = await createTx(page, title, -9.99);
  await api(page, "DELETE", `/transactions/${tx.id}`);
  return { ...tx, title };
}

async function openTrash(page: Page) {
  await page.goto("/trash");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Trash" })).toBeVisible();
}

const trashList = (page: Page) => page.getByRole("list", { name: "Deleted transactions" });
const trashRow = (page: Page, title: string) =>
  trashList(page).getByRole("listitem", { name: title, exact: true });

test.describe("Trash", () => {
  test("lists a deleted transaction with its purge date", async ({ authenticatedPage: page }) => {
    const errors = collectConsoleErrors(page);
    const tx = await trashed(page, "E2E trash list ");
    await openTrash(page);

    const row = trashRow(page, tx.title);
    await expect(row).toBeVisible();
    await expect(row).toContainText("9.99");
    await expect(row).toContainText(/Deleted/);
    await expect(row).toContainText(/days left|next cleanup|Kept until removed/);
    expectNoConsoleErrors(errors);
  });

  test("restore brings a transaction back to the ledger", async ({ authenticatedPage: page }) => {
    const tx = await trashed(page, "E2E trash restore ");
    await openTrash(page);

    await trashRow(page, tx.title).getByRole("button", { name: "Restore", exact: true }).click();
    await expect(trashRow(page, tx.title)).toBeHidden();

    await openLedger(page, `q=${encodeURIComponent(tx.title)}`);
    await expect(rowButton(page, tx.title)).toBeVisible();
  });

  test("bulk restore restores every selected row", async ({ authenticatedPage: page }) => {
    const a = await trashed(page, "E2E trash bulk a ");
    const b = await trashed(page, "E2E trash bulk b ");
    await openTrash(page);

    await trashRow(page, a.title).getByRole("checkbox", { name: `Select ${a.title}` }).click();
    await trashRow(page, b.title).getByRole("checkbox", { name: `Select ${b.title}` }).click();
    await page.getByRole("button", { name: "Restore 2 selected" }).click();

    await expect(trashRow(page, a.title)).toBeHidden();
    await expect(trashRow(page, b.title)).toBeHidden();
    await expect(page.getByRole("button", { name: /^Restore \d+ selected$/ })).toBeHidden();
  });

  test("delete forever asks first, then removes it for good", async ({
    authenticatedPage: page,
  }) => {
    const tx = await trashed(page, "E2E trash purge ");
    await openTrash(page);

    await trashRow(page, tx.title)
      .getByRole("button", { name: `Delete ${tx.title} forever` })
      .click();
    const dialog = page.getByRole("dialog", { name: `Delete ${tx.title} forever?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(trashRow(page, tx.title)).toBeVisible();

    await trashRow(page, tx.title)
      .getByRole("button", { name: `Delete ${tx.title} forever` })
      .click();
    await dialog.getByRole("button", { name: "Delete forever" }).click();
    await expect(dialog).toBeHidden();
    await expect(trashRow(page, tx.title)).toBeHidden();

    await openLedger(page, `q=${encodeURIComponent(tx.title)}`);
    await expect(rowButton(page, tx.title)).toBeHidden();
    await expect(ledger(page)).toBeVisible();
  });

  test("an empty trash says so", async ({ authenticatedPage: page }) => {
    // The CORS headers matter when the app talks to an API on another origin.
    await page.route(/\/transactions\?.*is_deleted=true/, (route) =>
      route.fulfill({
        json: [],
        headers: {
          "x-total-count": "0",
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "x-total-count",
        },
      }),
    );
    await openTrash(page);
    await expect(page.getByText("Trash is empty")).toBeVisible();
  });
});
