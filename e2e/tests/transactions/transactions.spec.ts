import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  createTx,
  ledger,
  monthName,
  monthsAgo,
  openLedger,
  params,
  rowButton,
  tag,
} from "../../helpers/transactions";

/**
 * Transactions page (UI v2): heading, month bar, ledger, create, the row
 * drawer and its full page, and bulk delete with undo.
 */

test.describe("Transactions page", () => {
  test("renders heading, month bar and ledger without console errors", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    await openLedger(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Transactions" }),
    ).toBeVisible();
    const month = page.getByRole("region", { name: "Month" });
    await expect(month).toContainText(monthName(monthsAgo(0)));
    await expect(month).toContainText("Current month");
    for (const stat of ["Income", "Spend", "Net", "Spend of income"]) {
      await expect(month.getByText(stat, { exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("complementary", { name: "Search and filter" }),
    ).toBeVisible();
    expectNoConsoleErrors(errors);
  });

  test("month navigation moves back and forward", async ({
    authenticatedPage: page,
  }) => {
    await openLedger(page);
    const next = page.getByRole("button", { name: "Next month" });
    await expect(next).toBeDisabled();

    await page.getByRole("button", { name: "Previous month" }).click();
    await expect.poll(() => params(page).get("month")).toBe(monthsAgo(1));
    await expect(page.getByRole("region", { name: "Month" })).toContainText(
      monthName(monthsAgo(1)),
    );

    await next.click();
    await expect.poll(() => params(page).get("month")).toBeNull();
  });

  test("entry points are visible", async ({ authenticatedPage: page }) => {
    await openLedger(page);
    for (const name of ["Add transaction", "Transfer", "Import"]) {
      await expect(
        page.getByRole("button", { name, exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("adds a transaction through the form", async ({
    authenticatedPage: page,
  }) => {
    const title = tag("E2E add ");
    await openLedger(page);
    await page
      .getByRole("button", { name: "Add transaction", exact: true })
      .first()
      .click();

    const dialog = page.getByRole("dialog", { name: "Add transaction" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Account").click();
    await page.getByRole("option").first().click();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Amount").fill("12.34");
    await dialog.getByRole("button", { name: "Add transaction" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("Transaction added", { exact: true })).toBeVisible();
    await openLedger(page, `q=${encodeURIComponent(title)}`);
    await expect(rowButton(page, title)).toBeVisible();
    await expect(ledger(page)).toContainText("12.34");
  });

  test("a row opens the drawer, which links to the full page", async ({
    authenticatedPage: page,
  }) => {
    const title = tag("E2E drawer ");
    const tx = await createTx(page, title, -21.5);
    await openLedger(page, `q=${encodeURIComponent(title)}`);

    await rowButton(page, title).click();
    await expect.poll(() => params(page).get("tx")).toBe(tx.id);
    const drawer = page.getByRole("dialog", { name: "Transaction" });
    await expect(drawer.getByRole("article", { name: title })).toBeVisible();
    await expect(drawer).toContainText("21.50");

    await drawer.getByRole("link", { name: "Open as a full page" }).click();
    await expect(page).toHaveURL(new RegExp(`/transactions/${tx.id}$`));
    await expect(page.getByRole("article", { name: title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  });

  test("the drawer closes with Escape and clears ?tx", async ({
    authenticatedPage: page,
  }) => {
    const title = tag("E2E esc ");
    const tx = await createTx(page, title, -3);
    await page.goto(`/transactions?q=${encodeURIComponent(title)}&tx=${tx.id}`);
    const drawer = page.getByRole("dialog", { name: "Transaction" });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect.poll(() => params(page).get("tx")).toBeNull();
  });

  test("bulk delete asks first and can be undone", async ({
    authenticatedPage: page,
  }) => {
    const t = tag("E2E bulk ");
    await createTx(page, `${t} one`, -1);
    await createTx(page, `${t} two`, -2);
    await openLedger(page, `q=${encodeURIComponent(t)}`);

    await page.getByRole("checkbox", { name: `Select ${t} one` }).check();
    await page.getByRole("checkbox", { name: `Select ${t} two` }).check();
    const bar = page.getByRole("region", { name: "Bulk actions" });
    await expect(bar).toContainText("2 selected");

    await bar.getByRole("button", { name: "Delete 2" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete 2 transactions" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByText("2 transactions deleted", { exact: true })).toBeVisible();
    await expect(rowButton(page, `${t} one`)).toBeHidden();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("2 transactions restored", { exact: true })).toBeVisible();
    await expect(rowButton(page, `${t} one`)).toBeVisible();
    await expect(rowButton(page, `${t} two`)).toBeVisible();
  });

  test("select all on this page selects every visible row", async ({
    authenticatedPage: page,
  }) => {
    const t = tag("E2E all ");
    await createTx(page, `${t} a`, -1);
    await createTx(page, `${t} b`, -1);
    await openLedger(page, `q=${encodeURIComponent(t)}`);
    await page.getByRole("checkbox", { name: "Select all on this page" }).check();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toContainText(
      "2 selected",
    );
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toBeHidden();
  });
});
