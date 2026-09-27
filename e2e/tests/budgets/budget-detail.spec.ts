import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { createAccount, removeAccount, uniqueName } from "../../helpers/accounts";
import { createTx, ledger } from "../../helpers/transactions";
import {
  addRange,
  cardAction,
  createBudget,
  listRanges,
  monthStartUtc,
  openBudget,
  openBudgets,
  removeBudget,
} from "../../helpers/budgets";

/**
 * Budget detail (UI v2): summary, pace chart, range history (add, edit,
 * delete), the transactions counting this period, and how server errors
 * surface (409 on the form, 422 on its field, load failure with retry).
 */

const region = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("region", { name, exact: true });

test.describe("Budget detail", () => {
  test("opens from the card menu with every panel and the counting spend", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const acc = await createAccount(page, uniqueName("E2E BudDet Acc"), { type: "CASH" });
    const name = uniqueName("E2E Detail");
    const b = await createBudget(page, name, { accountId: acc.id, limit: 100 });
    const title = uniqueName("E2E Bud Spend");
    await createTx(page, title, -12.5, { account_id: acc.id });

    await openBudgets(page);
    await cardAction(page, name, "Open details");
    await expect(page).toHaveURL(new RegExp(`/budgets/${b.id}$`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Budgets" })).toHaveAttribute("href", "/budgets");

    for (const r of ["This period", "Pace this period", "Range history"]) {
      await expect(region(page, r)).toBeVisible();
    }
    await expect(region(page, "This period")).toContainText("12.50");
    await expect(region(page, "Pace this period")).toContainText(/day \d+ of \d+/);
    const txs = region(page, "Transactions this period");
    await expect(ledger(page)).toBeVisible();
    await expect(txs.getByRole("button", { name: title, exact: true })).toBeVisible();
    expectNoConsoleErrors(errors);

    await removeBudget(page, b.id);
    await removeAccount(page, acc.id);
  });

  test("adding a range that overlaps shows the conflict on the form", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Overlap");
    const b = await createBudget(page, name);
    await openBudget(page, b.id, name);

    await region(page, "Range history").getByRole("button", { name: "Add range" }).click();
    const dialog = page.getByRole("dialog", { name: "Add range" });
    await dialog.getByLabel("Limit").fill("500");
    await dialog.getByRole("button", { name: "Add range" }).click();
    await expect(dialog.getByText(/overlaps an existing range/)).toBeVisible();
    await expect(dialog).toBeVisible();

    await removeBudget(page, b.id);
  });

  test("a 422 from the server shows on the limit field", async ({ authenticatedPage: page }) => {
    const name = uniqueName("E2E Invalid");
    const b = await createBudget(page, name);
    await openBudget(page, b.id, name);
    await page.route(`**/budgets/${b.id}/ranges`, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ error: "limit_amount: Limit must be at least 0.01" }),
          })
        : route.fallback(),
    );

    await region(page, "Range history").getByRole("button", { name: "Add range" }).click();
    const dialog = page.getByRole("dialog", { name: "Add range" });
    await dialog.getByLabel("Limit").fill("5");
    await dialog.getByRole("button", { name: "Add range" }).click();
    await expect(dialog.getByLabel("Limit")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText("Limit must be at least 0.01")).toBeVisible();

    await page.unroute(`**/budgets/${b.id}/ranges`);
    await removeBudget(page, b.id);
  });

  test("edits and deletes an earlier range", async ({ authenticatedPage: page }) => {
    const name = uniqueName("E2E Ranges");
    const year = new Date().getUTCFullYear() - 1;
    const b = await createBudget(page, name, {
      limit: 100,
      start: `${year}-01-01`,
      end: `${year}-03-31`,
    });
    await addRange(page, b.id, { limit: 200, period: "MONTHLY", start: monthStartUtc(), end: null });
    await openBudget(page, b.id, name);

    const history = region(page, "Range history");
    await expect(history.getByRole("row")).toHaveCount(3);
    await expect(history.getByText("Current")).toBeVisible();

    const earlier = new RegExp(`^Edit range 1 Jan ${year} to 31 Mar ${year}$`);
    await history.getByRole("button", { name: earlier }).click();
    const dialog = page.getByRole("dialog", { name: "Edit range" });
    await expect(dialog.getByLabel("Limit")).toHaveValue("100");
    await dialog.getByLabel("Limit").fill("150");
    await dialog.getByRole("button", { name: "Save range" }).click();
    await expect(dialog).toBeHidden();
    await expect(history).toContainText("150.00");
    expect((await listRanges(page, b.id)).map((r) => Number(r.limit_amount)).sort()).toEqual([
      150, 200,
    ]);

    await history
      .getByRole("button", { name: new RegExp(`^Delete range 1 Jan ${year}`) })
      .click();
    const confirm = page.getByRole("dialog", { name: "Delete this range?" });
    await confirm.getByRole("button", { name: "Delete range" }).click();
    await expect(confirm).toBeHidden();
    await expect(history.getByRole("row")).toHaveCount(2);

    await removeBudget(page, b.id);
  });

  test("deleting the only range explains why it cannot", async ({ authenticatedPage: page }) => {
    const name = uniqueName("E2E Only");
    const b = await createBudget(page, name);
    await openBudget(page, b.id, name);

    await region(page, "Range history")
      .getByRole("button", { name: /^Delete range / })
      .click();
    const confirm = page.getByRole("dialog", { name: "Delete this range?" });
    await confirm.getByRole("button", { name: "Delete range" }).click();
    await expect(confirm.getByRole("alert")).toContainText("only range");
    await expect(confirm).toBeVisible();

    await removeBudget(page, b.id);
  });

  test("editing the name updates the heading and crumbs", async ({ authenticatedPage: page }) => {
    const name = uniqueName("E2E Rename");
    const renamed = `${name} B`;
    const b = await createBudget(page, name);
    await openBudget(page, b.id, name);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit budget" });
    await dialog.getByLabel("Name").fill(renamed);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();

    await removeBudget(page, b.id);
  });

  test("delete from the detail page returns to the list", async ({ authenticatedPage: page }) => {
    const name = uniqueName("E2E DetDel");
    const b = await createBudget(page, name);
    await openBudget(page, b.id, name);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("dialog", { name: `Delete ${name}?` })
      .getByRole("button", { name: "Delete budget" })
      .click();
    await expect(page).toHaveURL(/\/budgets$/);
    await expect(page.getByRole("article", { name, exact: true })).toHaveCount(0);
  });

  test("a load failure shows an error with retry", async ({ authenticatedPage: page }) => {
    const name = uniqueName("E2E Fail");
    const b = await createBudget(page, name);
    let fail = true;
    await page.route(`**/budgets/${b.id}`, (route) =>
      fail && ["fetch", "xhr"].includes(route.request().resourceType())
        ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' })
        : route.fallback(),
    );
    await page.goto(`/budgets/${b.id}`);
    // The query retries before it gives up, so allow for its backoff.
    await expect(page.getByText("Could not load this budget")).toBeVisible({ timeout: 15000 });
    fail = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

    await page.unroute(`**/budgets/${b.id}`);
    await removeBudget(page, b.id);
  });
});
