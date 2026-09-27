import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";

/**
 * Reports (UI v2): the tab and the period live in the URL, the ranged tabs
 * show a period picker, and every chart comes with a text summary.
 */

test.describe("Reports", () => {
  test("keeps the tab in the URL across a reload", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Reports",
    );
    await expect(page.getByRole("tab", { name: "Cash flow" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tab", { name: "Net worth" }).click();
    await expect(page).toHaveURL(/[?&]tab=net-worth/);
    await page.reload();
    await expect(page.getByRole("tab", { name: "Net worth" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expectNoConsoleErrors(errors);
  });

  test("changes the period and offers custom dates", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/reports?tab=cashflow");
    const period = page.getByRole("group", { name: "Report period" });
    await expect(period).toBeVisible();

    await period.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: "Last 12 months" }).click();
    await expect(page).toHaveURL(/[?&]range=12m/);
    await expect(period.getByText(/ to .*, \d+ days/)).toBeVisible();

    await period.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: "Custom" }).click();
    await expect(page).toHaveURL(/[?&]range=custom/);
    await expect(period.getByText("From", { exact: true })).toBeVisible();
    await expect(period.getByText("To", { exact: true })).toBeVisible();
  });

  test("a custom period from the URL is shown back", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(
      "/reports?tab=net-worth&range=custom&from=2026-01-01&to=2026-06-30",
    );
    const period = page.getByRole("group", { name: "Report period" });
    await expect(period.getByText(/181 days/)).toBeVisible();
  });

  test("cash flow and net worth charts carry a text summary", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/reports?tab=cashflow");
    const panel = page.getByRole("tabpanel");
    // Either the summary sentence or the empty state, never a bare chart.
    await expect(
      panel
        .getByText(/^Across \d+ months?:/)
        .or(panel.getByText("No income or spend in this period"))
        .first(),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Net worth" }).click();
    await expect(
      page
        .getByRole("tabpanel")
        .getByText(/^Net worth went from/)
        .or(page.getByRole("tabpanel").getByText("No history in this period"))
        .first(),
    ).toBeVisible();
  });

  test("categories and budgets have no period picker", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/reports?tab=categories");
    await expect(page.getByRole("tabpanel")).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Report period" }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/always covers the last 30 days/),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Budgets" }).click();
    await expect(page).toHaveURL(/[?&]tab=budgets/);
    await expect(
      page.getByRole("group", { name: "Report period" }),
    ).toHaveCount(0);
  });
});
