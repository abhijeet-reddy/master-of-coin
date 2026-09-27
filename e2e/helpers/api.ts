import { expect, type Page } from "@playwright/test";

/**
 * A tiny authenticated API client for specs that own their data. The API
 * defaults to the app's own origin, override with E2E_API.
 */

const API = process.env.E2E_API ?? "/api/v1";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const unwrap = <T>(body: unknown): T =>
  (body && typeof body === "object" && "data" in body && !Array.isArray(body)
    ? (body as { data: T }).data
    : body) as T;

async function token(page: Page): Promise<string> {
  if (page.url() === "about:blank") {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
  }
  return (await page.evaluate(() => localStorage.getItem("auth_token"))) ?? "";
}

/** Call the API and expect a 2xx; returns the body, or null for an empty one. */
export async function api<T>(
  page: Page,
  method: Method,
  path: string,
  data?: unknown,
): Promise<T> {
  const headers = { Authorization: `Bearer ${await token(page)}` };
  const res = await page.request.fetch(`${API}${path}`, { method, headers, data });
  expect(res.ok(), `${method} ${path}: ${res.status()}`).toBeTruthy();
  const text = await res.text();
  return (text ? unwrap<T>(JSON.parse(text)) : null) as T;
}

/** Best-effort call for cleanup: never fails the test. */
export async function tryApi(page: Page, method: Method, path: string) {
  const headers = { Authorization: `Bearer ${await token(page)}` };
  await page.request.fetch(`${API}${path}`, { method, headers }).catch(() => undefined);
}
