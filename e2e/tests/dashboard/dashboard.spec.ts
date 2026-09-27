import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Dashboard (UI v2). Every panel is a labelled region, so the tests find
 * them by role and name rather than by text or CSS.
 */

const PANELS = [
  "Net worth",
  "Balance sheet",
  "Income vs spend",
  "Budgets",
  "Spend by category",
  "Top spend",
  "Debts",
  "Recent activity",
  "Provider links",
];

test.describe("Dashboard", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  });

  test("renders the page heading without console errors", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
    expectNoConsoleErrors(errors);
  });

  test("shows every panel as a labelled region", async ({
    authenticatedPage: page,
  }) => {
    for (const name of PANELS) {
      const region = page.getByRole("region", { name, exact: true });
      await expect(region).toBeVisible();
      await expect(
        region.getByRole("heading", { level: 2, name }),
      ).toBeVisible();
    }
  });

  test("panels finish loading", async ({ authenticatedPage: page }) => {
    for (const name of PANELS) {
      await expect(
        page
          .getByRole("region", { name, exact: true })
          .locator("[aria-busy='true']"),
      ).toHaveCount(0, { timeout: 10_000 });
    }
  });

  test("net worth notes that past points use today's rates", async ({
    authenticatedPage: page,
  }) => {
    const panel = page.getByRole("region", { name: "Net worth", exact: true });
    await expect(panel.getByText(/today's exchange rates/i)).toBeVisible();
  });

  test("net worth chart is keyboard readable when history exists", async ({
    authenticatedPage: page,
  }) => {
    const panel = page.getByRole("region", { name: "Net worth", exact: true });
    const chart = panel.getByRole("group", {
      name: /^Net worth\. Use arrow keys/,
    });
    if ((await chart.count()) === 0) {
      await expect(panel.getByText("No history yet")).toBeVisible();
      return;
    }
    await expect(chart).toBeVisible();
  });

  test("debts panel shows both totals and links to people", async ({
    authenticatedPage: page,
  }) => {
    const panel = page.getByRole("region", { name: "Debts", exact: true });
    await expect(panel.getByText("Owed to you", { exact: true })).toBeVisible();
    await expect(panel.getByText("You owe", { exact: true })).toBeVisible();

    await panel.getByRole("link", { name: /^(\d+ people|People)$/ }).click();
    await expect(page).toHaveURL(/\/people$/);
  });

  test("budgets panel links to the budgets page", async ({
    authenticatedPage: page,
  }) => {
    const panel = page.getByRole("region", { name: "Budgets", exact: true });
    const meters = panel.getByRole("meter");
    if ((await meters.count()) > 0) {
      await expect(meters.first()).toHaveAccessibleName(/budget$/);
    }
    await panel.getByRole("link", { name: /^(All \d+|Budgets)$/ }).click();
    await expect(page).toHaveURL(/\/budgets$/);
  });

  test("a budget row opens its budget", async ({ authenticatedPage: page }) => {
    const panel = page.getByRole("region", { name: "Budgets", exact: true });
    const rows = panel.getByRole("listitem");
    test.skip((await rows.count()) === 0, "no budgets in this environment");

    await rows.first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/budgets\/[0-9a-f-]+$/);
  });

  test("recent activity shows a table or an empty state", async ({
    authenticatedPage: page,
  }) => {
    const panel = page.getByRole("region", {
      name: "Recent activity",
      exact: true,
    });
    const table = panel.getByRole("table");
    if ((await table.count()) === 0) {
      await expect(panel.getByText("No transactions yet")).toBeVisible();
      return;
    }
    await expect(table.getByRole("columnheader").first()).toBeVisible();
  });

  test("provider sync buttons are named after their account", async ({
    authenticatedPage: page,
  }) => {
    const panel = page.getByRole("region", {
      name: "Provider links",
      exact: true,
    });
    const buttons = panel.getByRole("button", { name: /^Sync now: / });
    if ((await buttons.count()) === 0) {
      await expect(panel.getByText("No linked providers")).toBeVisible();
      return;
    }
    await expect(buttons.first()).toBeEnabled();
  });

  test("loads cleanly after navigating away and back", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
    expectNoConsoleErrors(errors);
  });
});
