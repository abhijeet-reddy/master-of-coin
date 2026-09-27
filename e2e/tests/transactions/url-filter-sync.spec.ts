import { test, expect } from "../../fixtures/test-fixtures";
import type { Page } from "@playwright/test";
import {
  categories,
  monthName,
  monthsAgo,
  openLedger,
  params,
} from "../../helpers/transactions";

/**
 * Every transactions filter lives in the URL (UI v2): changing one writes
 * it, visiting a URL restores it, defaults stay out, junk falls back.
 * Runs on desktop, where the rail shows the fields inline.
 */

const rail = (page: Page) =>
  page.getByRole("complementary", { name: "Search and filter" });
const chips = (page: Page) =>
  page.getByRole("group", { name: "Active filters" });
const monthBar = (page: Page) => page.getByRole("region", { name: "Month" });

test.describe("URL filter sync", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("loads with a clean URL", async ({ authenticatedPage: page }) => {
    await openLedger(page);
    expect([...params(page).keys()]).toEqual([]);
    await expect(rail(page)).toContainText("None active");
  });

  test("choosing a direction writes dir, All removes it", async ({
    authenticatedPage: page,
  }) => {
    await openLedger(page);
    await rail(page).getByRole("radio", { name: "Money out" }).click();
    await expect.poll(() => params(page).get("dir")).toBe("out");
    await rail(page).getByRole("radio", { name: "Money in" }).click();
    await expect.poll(() => params(page).get("dir")).toBe("in");
    await rail(page).getByRole("radio", { name: "All" }).click();
    await expect.poll(() => params(page).get("dir")).toBeNull();
  });

  test("visiting ?dir=out restores the direction and a chip", async ({
    authenticatedPage: page,
  }) => {
    await openLedger(page, "dir=out");
    await expect(rail(page).getByRole("radio", { name: "Money out" })).toBeChecked();
    await expect(chips(page)).toContainText("Money out");
    await expect(rail(page)).toContainText("1 active");
  });

  test("visiting ?month= shows that month", async ({
    authenticatedPage: page,
  }) => {
    const m = monthsAgo(2);
    await openLedger(page, `month=${m}`);
    await expect(monthBar(page)).toContainText(monthName(m));
    await expect(monthBar(page)).toContainText("Past month");
  });

  test("changing month writes month", async ({ authenticatedPage: page }) => {
    await openLedger(page);
    await page.getByRole("button", { name: "Previous month" }).click();
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect.poll(() => params(page).get("month")).toBe(monthsAgo(2));
  });

  test("search writes q after a pause", async ({ authenticatedPage: page }) => {
    await openLedger(page);
    await rail(page).getByLabel("Search", { exact: true }).fill("coffee");
    await expect.poll(() => params(page).get("q")).toBe("coffee");
  });

  test("Clear filters removes every filter param", async ({
    authenticatedPage: page,
  }) => {
    await openLedger(page, "dir=out&splits=true&q=lidl");
    await rail(page).getByRole("button", { name: "Clear filters" }).click();
    await expect.poll(() => [...params(page).keys()]).toEqual([]);
  });

  test("removing a chip removes just that param", async ({
    authenticatedPage: page,
  }) => {
    await openLedger(page, "dir=out&splits=true");
    await chips(page).getByRole("button", { name: /^Remove .*split.* filter$/i }).click();
    await expect.poll(() => params(page).get("splits")).toBeNull();
    expect(params(page).get("dir")).toBe("out");
  });

  test("several params restore together", async ({
    authenticatedPage: page,
  }) => {
    const cats = await categories(page);
    const cat = cats[0];
    await openLedger(
      page,
      `dir=out&splits=true&transfer=true&min=5&max=50&category=${cat.id}&q=tea`,
    );
    const r = rail(page);
    await expect(r.getByRole("radio", { name: "Money out" })).toBeChecked();
    await expect(r.getByRole("switch", { name: "Has splits" })).toBeChecked();
    await expect(r.getByRole("switch", { name: "In a transfer" })).toBeChecked();
    await expect(r.getByLabel("Min amount", { exact: true })).toHaveValue("5");
    await expect(r.getByLabel("Max amount", { exact: true })).toHaveValue("50");
    await expect(r.getByLabel("Search", { exact: true })).toHaveValue("tea");
    await expect(r.getByLabel("Category", { exact: true })).toContainText(cat.name);
    await expect(chips(page)).toContainText(cat.name);
  });

  test("month and filters restore together", async ({
    authenticatedPage: page,
  }) => {
    const m = monthsAgo(1);
    await openLedger(page, `month=${m}&dir=in`);
    await expect(monthBar(page)).toContainText(monthName(m));
    await expect(rail(page).getByRole("radio", { name: "Money in" })).toBeChecked();
  });

  test("browser back steps through months and keeps the filters", async ({
    authenticatedPage: page,
  }) => {
    // Month changes push history; filter edits replace it, so back does not
    // undo each keystroke.
    await openLedger(page, "dir=out");
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect.poll(() => params(page).get("month")).toBe(monthsAgo(1));
    expect(params(page).get("dir")).toBe("out");
    await page.goBack();
    await expect.poll(() => params(page).get("month")).toBeNull();
    expect(params(page).get("dir")).toBe("out");
    await expect(monthBar(page)).toContainText(monthName(monthsAgo(0)));
    await expect(rail(page).getByRole("radio", { name: "Money out" })).toBeChecked();
  });

  test("paid=only is written and restored", async ({
    authenticatedPage: page,
  }) => {
    await openLedger(page);
    await rail(page).getByLabel("Paid by others", { exact: true }).click();
    await page.getByRole("option", { name: "Only these" }).click();
    await expect.poll(() => params(page).get("paid")).toBe("only");
    await page.reload();
    await expect(rail(page).getByLabel("Paid by others", { exact: true })).toContainText("Only these");
  });

  test("a date range restores and marks the month as custom", async ({
    authenticatedPage: page,
  }) => {
    const m = monthsAgo(0);
    await openLedger(page, `from=${m}-01&to=${m}-10`);
    await expect(monthBar(page)).toContainText("Custom date range");
    await expect(rail(page).getByLabel("From", { exact: true })).toContainText(String(Number(m.slice(0, 4))));
    await expect(chips(page)).toBeVisible();
  });

  test("junk params fall back to defaults", async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openLedger(page, "dir=sideways&splits=maybe&min=abc&page=-3&month=nope");
    await expect(rail(page).getByRole("radio", { name: "All" })).toBeChecked();
    await expect(rail(page).getByRole("switch", { name: "Has splits" })).not.toBeChecked();
    await expect(rail(page).getByLabel("Min amount", { exact: true })).toHaveValue("");
    await expect(monthBar(page)).toContainText(monthName(monthsAgo(0)));
    expect(errors).toEqual([]);
  });
});
