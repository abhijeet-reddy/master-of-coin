import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  categoryCard,
  createCategory,
  openCategories,
  removeCategory,
} from "../../helpers/categories";
import { cardAction } from "../../helpers/budgets";
import { createTx, tag } from "../../helpers/transactions";

/**
 * Categories (UI v2): the grid, create, edit, delete and the detail page.
 * Every test creates its own categories through the API.
 */

test.describe("Categories", () => {
  test("lists categories with the create action", async ({ authenticatedPage: page }) => {
    const errors = collectConsoleErrors(page);
    const cat = await createCategory(page, tag("E2E list "));
    await openCategories(page);

    await expect(page.getByRole("button", { name: "Create category" }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Categories" })).toBeVisible();
    await expect(categoryCard(page, cat.name)).toBeVisible();
    expectNoConsoleErrors(errors);
    await removeCategory(page, cat.id);
  });

  test("creates a category from the dialog", async ({ authenticatedPage: page }) => {
    const name = tag("E2E new ");
    await openCategories(page);
    await page.getByRole("button", { name: "Create category" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Create category" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByRole("button", { name: "Use colour #3987E5" }).click();
    await dialog.getByRole("button", { name: "Create category" }).click();

    await expect(dialog).toBeHidden();
    await expect(categoryCard(page, name)).toBeVisible();
  });

  test("a blank name is rejected in the form", async ({ authenticatedPage: page }) => {
    await openCategories(page);
    await page.getByRole("button", { name: "Create category" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create category" });
    await dialog.getByRole("button", { name: "Create category" }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
  });

  test("edits the name and excludes it from analysis", async ({ authenticatedPage: page }) => {
    const cat = await createCategory(page, tag("E2E edit "));
    const renamed = `${cat.name} renamed`;
    await openCategories(page, `q=${encodeURIComponent(cat.name)}`);

    await cardAction(page, cat.name, "Edit");
    const dialog = page.getByRole("dialog", { name: "Edit category" });
    await dialog.getByLabel("Name").fill(renamed);
    await dialog.getByRole("switch", { name: "Exclude from analysis" }).click();
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toBeHidden();
    const card = categoryCard(page, renamed);
    await expect(card).toBeVisible();
    await expect(card.getByText("Excluded from analysis")).toBeVisible();
    await removeCategory(page, cat.id);
  });

  test("deletes a category after confirming", async ({ authenticatedPage: page }) => {
    const cat = await createCategory(page, tag("E2E delete "));
    await openCategories(page, `q=${encodeURIComponent(cat.name)}`);

    await cardAction(page, cat.name, "Delete");
    const dialog = page.getByRole("dialog", { name: `Delete ${cat.name}?` });
    await dialog.getByRole("button", { name: "Delete category" }).click();

    await expect(dialog).toBeHidden();
    await expect(categoryCard(page, cat.name)).toBeHidden();
    await expect(page.getByText("No categories match")).toBeVisible();
  });

  test("search narrows the grid and can be cleared", async ({ authenticatedPage: page }) => {
    await openCategories(page, "q=zzz-no-such-category");
    await expect(page.getByText("No categories match")).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByLabel("Search categories")).toHaveValue("");
  });

  test("the detail page shows spend, the breadcrumb and its transactions", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const cat = await createCategory(page, tag("E2E detail "));
    const title = tag("E2E cat tx ");
    await createTx(page, title, -12.5, { category_id: cat.id });

    await openCategories(page, `q=${encodeURIComponent(cat.name)}`);
    await categoryCard(page, cat.name).getByRole("link", { name: cat.name }).click();

    await expect(page).toHaveURL(new RegExp(`/categories/${cat.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: cat.name })).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumbs.getByRole("link", { name: "Categories" })).toBeVisible();
    await expect(page.getByRole("region", { name: /Spend, last 12 months/ })).toBeVisible();

    const ledger = page.getByRole("region", { name: "Ledger" });
    await expect(ledger.getByRole("button", { name: title, exact: true })).toBeVisible();
    expectNoConsoleErrors(errors);
  });

  test("an unknown id shows not found", async ({ authenticatedPage: page }) => {
    await page.goto("/categories/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Category not found")).toBeVisible();
    await page.getByRole("link", { name: "Back to categories" }).click();
    await expect(page).toHaveURL(/\/categories$/);
  });
});
