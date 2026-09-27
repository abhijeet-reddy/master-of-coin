import { expect, type Page } from "@playwright/test";
import { api, tryApi } from "./api";

/**
 * Helpers for the settings specs (UI v2). API keys are created through the
 * API so each test owns its key, and revoked afterwards.
 */

export interface ApiKeyData {
  id: string;
  name: string;
  key_prefix: string;
  status: string;
  expires_at?: string | null;
}

const READ_TX = {
  transactions: ["read"],
  accounts: [],
  budgets: [],
  categories: [],
  people: [],
};

/** Open a settings tab and wait for its panel. */
export async function openSettings(page: Page, tab?: string) {
  await page.goto(tab ? `/settings?tab=${tab}` : "/settings");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Settings",
  );
  await expect(page.getByRole("tabpanel")).toBeVisible();
}

export function createApiKey(
  page: Page,
  name: string,
  expiresInDays: number | null = 30,
) {
  return api<ApiKeyData & { key: string }>(page, "POST", "/api-keys", {
    name,
    scopes: READ_TX,
    expires_in_days: expiresInDays,
  });
}

export function getApiKey(page: Page, id: string) {
  return api<ApiKeyData>(page, "GET", `/api-keys/${id}`);
}

export const revokeApiKey = (page: Page, id: string) =>
  tryApi(page, "DELETE", `/api-keys/${id}`);

/** The row of one key in the API keys list. */
export const keyRow = (page: Page, name: string) =>
  page
    .getByRole("tabpanel")
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });

/** Answer a settings write with the given status once, as the server would. */
export async function failNextWrite(
  page: Page,
  pattern: RegExp,
  status: number,
  error: string,
) {
  await page.route(pattern, async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "OPTIONS") return route.fallback();
    await route.fulfill({
      status,
      json: { error },
      headers: { "access-control-allow-origin": "*" },
    });
  });
}
