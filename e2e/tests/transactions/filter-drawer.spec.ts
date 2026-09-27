import { test, expect } from "../../fixtures/test-fixtures";
import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import { openLedger, params } from "../../helpers/transactions";

/**
 * Filters on phones (UI v2). The rail keeps only search; the rest opens in
 * a Filters sheet. Desktop shows the same fields inline in the rail.
 */

const PHONE = { width: 390, height: 844 };

const filtersButton = (page: Page) =>
  page.getByRole("button", { name: /^Filters/ });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Filters" });

async function openSheet(page: Page) {
  await filtersButton(page).click();
  await expect(sheet(page)).toBeVisible();
  return sheet(page);
}

test.describe("Filters sheet on phones", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize(PHONE);
    await openLedger(page);
  });

  test("the rail keeps search and hides the other fields", async ({
    authenticatedPage: page,
  }) => {
    const rail = page.getByRole("complementary", { name: "Search and filter" });
    await expect(rail.getByLabel("Search", { exact: true })).toBeVisible();
    await expect(rail.getByRole("group", { name: "Direction" })).toBeHidden();
    await expect(filtersButton(page)).toBeVisible();
  });

  test("the sheet holds every filter control", async ({
    authenticatedPage: page,
  }) => {
    const s = await openSheet(page);
    for (const label of ["Account", "Category", "Person", "From", "To", "Min amount", "Max amount", "Paid by others"]) {
      await expect(s.getByLabel(label, { exact: true })).toBeVisible();
    }
    await expect(s.getByRole("group", { name: "Direction" })).toBeVisible();
    await expect(s.getByRole("switch", { name: "Has splits" })).toBeVisible();
    await expect(s.getByRole("switch", { name: "In a transfer" })).toBeVisible();
  });

  test("Show results closes the sheet", async ({ authenticatedPage: page }) => {
    const s = await openSheet(page);
    await s.getByRole("button", { name: "Show results" }).click();
    await expect(s).toBeHidden();
  });

  test("the close button closes the sheet", async ({
    authenticatedPage: page,
  }) => {
    const s = await openSheet(page);
    await s.getByRole("button", { name: "Close" }).click();
    await expect(s).toBeHidden();
  });

  test("Escape closes the sheet", async ({ authenticatedPage: page }) => {
    await openSheet(page);
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
  });

  test("a filter applies live, lands in the URL and counts on the button", async ({
    authenticatedPage: page,
  }) => {
    const s = await openSheet(page);
    await s.getByRole("radio", { name: "Money in" }).click();
    await expect.poll(() => params(page).get("dir")).toBe("in");
    await s.getByRole("switch", { name: "Has splits" }).click();
    await expect.poll(() => params(page).get("splits")).toBe("true");
    await s.getByRole("button", { name: "Show results" }).click();
    await expect(filtersButton(page)).toHaveText(/Filters \(2\)/);
  });

  test("selections survive closing and reopening", async ({
    authenticatedPage: page,
  }) => {
    let s = await openSheet(page);
    await s.getByRole("radio", { name: "Money out" }).click();
    await s.getByRole("button", { name: "Show results" }).click();
    s = await openSheet(page);
    await expect(s.getByRole("radio", { name: "Money out" })).toBeChecked();
  });

  test("Clear filters resets everything", async ({ authenticatedPage: page }) => {
    await openLedger(page, "dir=out&splits=true&paid=only");
    await expect(filtersButton(page)).toHaveText(/Filters \(3\)/);
    const s = await openSheet(page);
    await s.getByRole("button", { name: "Clear filters" }).click();
    await expect.poll(() => page.url()).not.toContain("?");
    await expect(s.getByRole("radio", { name: "All" })).toBeChecked();
    await expect(s.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });

  test("amount range fields write min and max", async ({
    authenticatedPage: page,
  }) => {
    const s = await openSheet(page);
    await s.getByLabel("Min amount").fill("10");
    await s.getByLabel("Max amount").fill("99.5");
    await expect.poll(() => params(page).get("min")).toBe("10");
    await expect.poll(() => params(page).get("max")).toBe("99.5");
  });

  test("no console errors while filtering", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const s = await openSheet(page);
    await s.getByRole("radio", { name: "Money out" }).click();
    await s.getByLabel("Paid by others").click();
    await page.getByRole("option", { name: "Hide them" }).click();
    await expect.poll(() => params(page).get("paid")).toBe("exclude");
    await s.getByRole("button", { name: "Show results" }).click();
    await page.waitForLoadState("networkidle");
    expectNoConsoleErrors(errors);
  });
});

test.describe("Filter rail on desktop", () => {
  test("fields sit inline and there is no Filters button", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openLedger(page);
    const rail = page.getByRole("complementary", { name: "Search and filter" });
    await expect(rail.getByRole("group", { name: "Direction" })).toBeVisible();
    await expect(filtersButton(page)).toBeHidden();
  });
});
