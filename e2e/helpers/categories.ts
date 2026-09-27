import { expect, type Page } from "@playwright/test";
import { api, tryApi } from "./api";

/** Helpers for the categories specs (UI v2): data through the API, UI by role and label. */

export interface CategoryData {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_excluded_from_analysis?: boolean;
}

export function createCategory(
  page: Page,
  name: string,
  extra: Partial<Omit<CategoryData, "id" | "name">> = {},
) {
  return api<CategoryData>(page, "POST", "/categories", { name, icon: "🧪", color: "#3987E5", ...extra });
}

export const removeCategory = (page: Page, id: string) =>
  tryApi(page, "DELETE", `/categories/${id}`);

export async function openCategories(page: Page, query = "") {
  await page.goto(`/categories${query ? `?${query}` : ""}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible();
}

/** A category card, named by its title link. */
export const categoryCard = (page: Page, name: string) =>
  page.getByRole("article", { name, exact: true });
