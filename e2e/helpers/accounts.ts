import { expect, type Page } from "@playwright/test";

/**
 * Helpers for the accounts specs (UI v2). Accounts are created through the
 * API so every test owns its data; the UI is driven by role and label only.
 * The API defaults to the app's own origin, override with E2E_API.
 */

const API = process.env.E2E_API ?? "/api/v1";

export interface AccountData {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  balance: number | string;
}

/** The account types the modal offers, in order. LOAN and DEBT (system-managed) are deliberately absent. */
export const ACCOUNT_TYPE_LABELS = [
  "Checking",
  "Savings",
  "Credit card",
  "Investment",
  "Cash",
  "Gift card",
];

const unwrap = <T>(body: unknown): T =>
  (body && typeof body === "object" && "data" in body
    ? (body as { data: T }).data
    : body) as T;

async function token(page: Page): Promise<string> {
  if (page.url() === "about:blank") {
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");
  }
  return (await page.evaluate(() => localStorage.getItem("auth_token"))) ?? "";
}

async function call<T>(
  page: Page,
  method: "GET" | "POST" | "DELETE",
  path: string,
  data?: unknown,
): Promise<T | null> {
  const headers = { Authorization: `Bearer ${await token(page)}` };
  const res = await page.request.fetch(`${API}${path}`, {
    method,
    headers,
    data,
  });
  expect(res.ok(), `${method} ${path}: ${res.status()}`).toBeTruthy();
  const text = await res.text();
  return text ? unwrap<T>(JSON.parse(text)) : null;
}

export async function createAccount(
  page: Page,
  name: string,
  opts: { type?: string; currency?: string; balance?: number } = {},
): Promise<AccountData> {
  const made = await call<AccountData>(page, "POST", "/accounts", {
    name,
    account_type: opts.type ?? "SAVINGS",
    currency: opts.currency ?? "EUR",
    initial_balance: opts.balance ?? 0,
  });
  return made as AccountData;
}

/** Best-effort cleanup: delete, or archive when the server refuses (it has transactions). */
export async function removeAccount(page: Page, id: string) {
  const headers = { Authorization: `Bearer ${await token(page)}` };
  const res = await page.request.delete(`${API}/accounts/${id}`, { headers });
  if (!res.ok()) await page.request.post(`${API}/accounts/${id}/archive`, { headers });
}

export async function listAccounts(page: Page): Promise<AccountData[]> {
  return (await call<AccountData[]>(page, "GET", "/accounts")) ?? [];
}

/** A unique name so rows created by one run never collide with another. */
export const uniqueName = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export async function openAccounts(page: Page, query = "") {
  await page.goto(`/accounts${query ? `?${query}` : ""}`);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1, name: "Accounts" }),
  ).toBeVisible();
}

export async function openAccount(page: Page, id: string, name: string) {
  await page.goto(`/accounts/${id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** An account card, named by its heading. */
export const card = (page: Page, name: string) =>
  page.getByRole("article", { name, exact: true });

/** Open a card's action menu and pick an item. */
export async function cardAction(page: Page, name: string, item: string) {
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

export const archivedToggle = (page: Page) =>
  page.getByRole("button", { name: "Archived", exact: true });
