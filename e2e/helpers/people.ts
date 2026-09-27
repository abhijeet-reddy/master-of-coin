import { expect, type Page } from "@playwright/test";
import { api, tryApi } from "./api";

/** Helpers for the people specs (UI v2): data through the API, UI by role and label. */

export interface PersonData {
  id: string;
  name: string;
  debt_summary?: { owes_me: string; i_owe: string; net: string };
}

export interface AccountRow {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  archived_at?: string | null;
}

export const getPerson = (page: Page, id: string) =>
  api<PersonData>(page, "GET", `/people/${id}`);

export const removePerson = (page: Page, id: string) => tryApi(page, "DELETE", `/people/${id}`);

export const allAccounts = (page: Page) =>
  api<AccountRow[]>(page, "GET", "/accounts?include_archived=true");

/** An active, non-debt account to pay a split expense from. */
export async function spendAccount(page: Page) {
  const list = await api<AccountRow[]>(page, "GET", "/accounts");
  const acc = list.find((a) => a.account_type !== "DEBT" && !a.archived_at);
  expect(acc, "an active spending account").toBeTruthy();
  return acc!;
}

/** An expense of `total` where `person` owes `share` of it. */
export async function createSplitTx(
  page: Page,
  personId: string,
  title: string,
  total: number,
  share: number,
) {
  const acc = await spendAccount(page);
  return api<{ id: string; title: string }>(page, "POST", "/transactions", {
    account_id: acc.id,
    title,
    amount: -total,
    date: new Date().toISOString(),
    splits: [{ person_id: personId, amount: share }],
  });
}

export async function openPeople(page: Page, query = "") {
  await page.goto(`/people${query ? `?${query}` : ""}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
}

export async function openPerson(page: Page, id: string, name: string) {
  await page.goto(`/people/${id}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** A person's row in the People list, named by its link. */
export const personRow = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });
