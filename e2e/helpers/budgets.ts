import { expect, type Page } from "@playwright/test";

/**
 * Helpers for the budgets specs (UI v2). Budgets, their ranges and the
 * account they watch are created through the API so every test owns its
 * data; the UI is driven by role and label only. The API defaults to the
 * app's own origin, override with E2E_API.
 */

const API = process.env.E2E_API ?? "/api/v1";

export interface BudgetData {
  id: string;
  name: string;
}

export interface RangeData {
  id: string;
  limit_amount: string;
  period: string;
  start_date: string;
  end_date: string | null;
}

const unwrap = <T>(body: unknown): T =>
  (body && typeof body === "object" && "data" in body && !Array.isArray(body)
    ? (body as { data: T }).data
    : body) as T;

async function token(page: Page): Promise<string> {
  if (page.url() === "about:blank") {
    await page.goto("/budgets");
    await page.waitForLoadState("networkidle");
  }
  return (await page.evaluate(() => localStorage.getItem("auth_token"))) ?? "";
}

async function call<T>(
  page: Page,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  data?: unknown,
): Promise<T | null> {
  const headers = { Authorization: `Bearer ${await token(page)}` };
  const res = await page.request.fetch(`${API}${path}`, { method, headers, data });
  expect(res.ok(), `${method} ${path}: ${res.status()}`).toBeTruthy();
  const text = await res.text();
  return text ? unwrap<T>(JSON.parse(text)) : null;
}

/** `YYYY-MM-DD` in UTC, the calendar the server counts budget days in. */
export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
export const monthStartUtc = (d = new Date()) => `${utcDay(d).slice(0, 7)}-01`;

/** Days left in this calendar month counting today (UTC), as a monthly budget shows it. */
export function monthDaysLeft(d = new Date()) {
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return end.getUTCDate() - d.getUTCDate() + 1;
}

/** A budget with one range: monthly from the first of this month, open ended, by default. */
export async function createBudget(
  page: Page,
  name: string,
  opts: {
    accountId?: string;
    categoryId?: string;
    limit?: number;
    period?: string;
    start?: string;
    end?: string | null;
  } = {},
): Promise<BudgetData> {
  const filters: Record<string, string> = {};
  if (opts.accountId) filters.account_id = opts.accountId;
  if (opts.categoryId) filters.category_id = opts.categoryId;
  const b = (await call<BudgetData>(page, "POST", "/budgets", { name, filters })) as BudgetData;
  await addRange(page, b.id, {
    limit: opts.limit ?? 200,
    period: opts.period ?? "MONTHLY",
    start: opts.start ?? monthStartUtc(),
    end: opts.end ?? null,
  });
  return b;
}

export async function addRange(
  page: Page,
  budgetId: string,
  r: { limit: number; period: string; start: string; end: string | null },
): Promise<RangeData> {
  return (await call<RangeData>(page, "POST", `/budgets/${budgetId}/ranges`, {
    limit_amount: r.limit,
    period: r.period,
    start_date: r.start,
    end_date: r.end,
  })) as RangeData;
}

export async function listRanges(page: Page, budgetId: string): Promise<RangeData[]> {
  return (await call<RangeData[]>(page, "GET", `/budgets/${budgetId}/ranges`)) ?? [];
}

/** Best-effort cleanup. */
export async function removeBudget(page: Page, id: string) {
  const headers = { Authorization: `Bearer ${await token(page)}` };
  await page.request.delete(`${API}/budgets/${id}`, { headers });
}

export async function openBudgets(page: Page, query = "") {
  await page.goto(`/budgets${query ? `?${query}` : ""}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "Budgets" })).toBeVisible();
}

export async function openBudget(page: Page, id: string, name: string) {
  await page.goto(`/budgets/${id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** A budget card, named by its heading. */
export const card = (page: Page, name: string) =>
  page.getByRole("article", { name, exact: true });

/** Open a card's action menu and pick an item. */
export async function cardAction(page: Page, name: string, item: string) {
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

/** Pick an option in a Select or Combobox field of a dialog. */
export async function pick(page: Page, label: string, option: string) {
  await page.getByRole("dialog").getByLabel(label, { exact: true }).click();
  const esc = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.getByRole("option", { name: new RegExp(`^${esc}`) }).first().click();
}
