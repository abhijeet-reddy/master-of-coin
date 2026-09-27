import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  createSchedule,
  openJobs,
  removeSchedule,
} from "../../helpers/schedules";
import { api } from "../../helpers/api";
import { tag } from "../../helpers/transactions";

/**
 * Jobs (UI v2): the history list, the type filter in the URL, and the detail
 * page for a job started from a schedule.
 */

test.describe("Jobs", () => {
  test("lists job history with the type filter in the URL", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    await openJobs(page);
    await expect(
      page.getByRole("combobox", { name: "Job type" }),
    ).toBeVisible();

    await page.getByRole("combobox", { name: "Job type" }).click();
    await page.getByRole("option", { name: "Drift Detection" }).click();
    await expect(page).toHaveURL(/type=drift-detection/);

    // Only drift checks remain once the filtered page has loaded (or none at all).
    const list = page.getByRole("list", { name: "Job history" });
    await expect(
      list.getByRole("link", {
        name: /^(Bulk Sync|Portfolio Sync|Bank Sync)$/,
      }),
    ).toHaveCount(0);

    await page.goBack();
    await expect(page).not.toHaveURL(/type=/);
    expectNoConsoleErrors(errors);
  });

  test("shows a job's timing and input, linked to its schedule", async ({
    authenticatedPage: page,
  }) => {
    const s = await createSchedule(page, tag("E2E job detail "));
    const { job_id } = await api<{ job_id: string }>(
      page,
      "POST",
      `/schedules/${s.id}/run`,
    );

    await page.goto(`/jobs/drift-detection/${job_id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Drift Detection" }),
    ).toBeVisible();
    const timing = page.getByLabel("Job timing");
    for (const stat of ["Created", "Started", "Completed"]) {
      await expect(timing.getByText(stat, { exact: true })).toBeVisible();
    }
    // A scheduled drift run records the resolved window, not lookback_days.
    const input = page.getByRole("region", { name: "Input" });
    for (const key of ["From", "To"]) {
      await expect(input.getByText(key, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Scheduled/ })).toHaveAttribute(
      "href",
      `/schedules/${s.id}`,
    );

    await page.getByRole("link", { name: "Jobs", exact: true }).first().click();
    await expect(page).toHaveURL(/\/jobs$/);
    await expect(page.getByRole("list", { name: "Job history" })).toBeVisible();
    await removeSchedule(page, s.id);
  });

  test("shows not found for an unknown job", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(
      "/jobs/drift-detection/00000000-0000-0000-0000-000000000000",
    );
    await expect(page.getByText(/not found/i).first()).toBeVisible();
  });
});
