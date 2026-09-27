import { expect, type Page } from "@playwright/test";

/**
 * Helpers for the transactions specs (UI v2). Data is created through the
 * API so every test owns its rows; everything else goes through the UI by
 * role and label. The API defaults to the app's own origin, override with
 * E2E_API when the API lives elsewhere.
 */

const API = process.env.E2E_API ?? "/api/v1";

export interface TxData {
  id: string;
  title: string;
  amount: string;
  account_id?: string;
}

interface AccountData {
  id: string;
  name: string;
  account_type?: string;
  currency?: string;
}

const unwrap = <T>(body: unknown): T =>
  (body && typeof body === "object" && "data" in body
    ? (body as { data: T }).data
    : body) as T;

async function token(page: Page): Promise<string> {
  if (page.url() === "about:blank") {
    await page.goto("/transactions");
    await page.waitForLoadState("networkidle");
  }
  return (await page.evaluate(() => localStorage.getItem("auth_token"))) ?? "";
}

async function call<T>(
  page: Page,
  method: "GET" | "POST",
  path: string,
  data?: unknown,
): Promise<T> {
  const headers = { Authorization: `Bearer ${await token(page)}` };
  const res =
    method === "GET"
      ? await page.request.get(`${API}${path}`, { headers })
      : await page.request.post(`${API}${path}`, { headers, data });
  expect(res.ok(), `${method} ${path}: ${res.status()}`).toBeTruthy();
  return unwrap<T>(await res.json());
}

/** A unique tag so rows created by one run never collide with another. */
export const tag = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Active, non-debt accounts in the default currency first. */
export async function spendingAccounts(page: Page): Promise<AccountData[]> {
  const list = await call<AccountData[]>(page, "GET", "/accounts");
  return list.filter((a) => a.account_type !== "DEBT");
}

export async function createTx(
  page: Page,
  title: string,
  amount: number,
  extra: Record<string, unknown> = {},
): Promise<TxData> {
  const [account] = await spendingAccounts(page);
  return call<TxData>(page, "POST", "/transactions", {
    account_id: account.id,
    title,
    amount,
    date: new Date().toISOString(),
    ...extra,
  });
}

export async function createPerson(page: Page, name: string) {
  return call<{ id: string; name: string }>(page, "POST", "/people", { name });
}

export async function createDebtTx(
  page: Page,
  payerId: string,
  title: string,
  amount: number,
): Promise<TxData> {
  return call<TxData>(page, "POST", "/debt-transactions", {
    payer_person_id: payerId,
    title,
    amount,
    date: new Date().toISOString(),
  });
}

export async function createTransfer(page: Page, title: string, amount: number) {
  const accounts = await spendingAccounts(page);
  const cur = accounts[0].currency;
  const to = accounts.find((a) => a.id !== accounts[0].id && a.currency === cur);
  if (!to) return null;
  return call<{ from_transaction: TxData }>(page, "POST", "/transfers", {
    from_account_id: accounts[0].id,
    to_account_id: to.id,
    from_amount: amount,
    to_amount: amount,
    title,
    date: new Date().toISOString(),
  });
}

export async function categories(page: Page) {
  return call<{ id: string; name: string }[]>(page, "GET", "/categories");
}

/** Open the ledger narrowed to rows matching `q`, and wait for it to settle. */
export async function openLedger(page: Page, query = "") {
  await page.goto(`/transactions${query ? `?${query}` : ""}`);
  await page.waitForLoadState("networkidle");
  await expect(ledger(page)).toBeVisible();
  await expect(ledger(page)).not.toHaveAttribute("aria-busy", "true");
}

export const ledger = (page: Page) =>
  page.getByRole("region", { name: "Ledger" });

/** The ledger row whose title button opens the drawer. */
export const rowButton = (page: Page, title: string) =>
  ledger(page).getByRole("button", { name: title, exact: true });

/** Today as the app shows it by default (DD/MM/YYYY), plus ISO for URL checks. */
export function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    month: `${d.getFullYear()}-${p(d.getMonth() + 1)}`,
  };
}

/** `YYYY-MM` `n` months before the current one. */
export function monthsAgo(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** Search params of the current URL. */
export const params = (page: Page) => new URL(page.url()).searchParams;
