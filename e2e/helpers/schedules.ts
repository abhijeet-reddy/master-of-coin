import { expect, type Page } from "@playwright/test";
import { api, tryApi } from "./api";

/** Schedules and jobs (UI v2): data set up through the API, then driven through the UI. */

export interface ScheduleData {
  id: string;
  name: string;
  job_type: string;
  cron_expr: string;
  is_active: boolean;
}

export async function createSchedule(
  page: Page,
  name: string,
  cron = "0 2 * * *",
  jobType = "DRIFT_DETECTION",
): Promise<ScheduleData> {
  return api<ScheduleData>(page, "POST", "/schedules", {
    name,
    job_type: jobType,
    cron_expr: cron,
    parameters: jobType === "DRIFT_DETECTION" ? { lookback_days: 14 } : {},
  });
}

export const removeSchedule = (page: Page, id: string) =>
  tryApi(page, "DELETE", `/schedules/${id}`);

export async function openSchedules(page: Page) {
  await page.goto("/schedules");
  await expect(
    page.getByRole("heading", { name: "Schedules", level: 1 }),
  ).toBeVisible();
}

export async function openJobs(page: Page, query = "") {
  await page.goto(`/jobs${query ? `?${query}` : ""}`);
  await expect(
    page.getByRole("heading", { name: "Jobs", level: 1 }),
  ).toBeVisible();
}

/** A schedule's row on /schedules, found by its accessible name. */
export const scheduleRow = (page: Page, name: string) =>
  page.getByRole("list", { name: "Schedules" }).getByRole("listitem", { name });
