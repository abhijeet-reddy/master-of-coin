import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  createSchedule,
  openSchedules,
  removeSchedule,
  scheduleRow,
} from "../../helpers/schedules";
import { tag } from "../../helpers/transactions";

/**
 * Schedules (UI v2): create with a preset, custom cron validation, pause and
 * resume, run now, the detail page and delete. Each test owns its schedule.
 */

test.describe("Schedules", () => {
  test("creates a weekly schedule and describes it as Sunday", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    const name = tag("E2E weekly ");
    await openSchedules(page);
    await page.getByRole("button", { name: "Create schedule" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Create schedule" });
    await dialog.getByLabel("Name").fill(name);
    const frequency = dialog.getByRole("group", { name: "Frequency" });
    await frequency.getByRole("button", { name: "Weekly" }).click();
    await expect(
      frequency.getByRole("button", { name: "Weekly" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByText("Every Sunday at 00:00 UTC")).toBeVisible();
    await dialog.getByRole("button", { name: "Create schedule" }).click();
    await expect(dialog).toBeHidden();

    const row = scheduleRow(page, name);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Every Sunday at 00:00 UTC");
    expectNoConsoleErrors(errors);

    const id = (await row.getByRole("link", { name }).getAttribute("href"))!
      .split("/")
      .pop()!;
    await removeSchedule(page, id);
  });

  test("rejects weekday 0 in a custom cron", async ({
    authenticatedPage: page,
  }) => {
    await openSchedules(page);
    await page.getByRole("button", { name: "Create schedule" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create schedule" });
    await dialog.getByLabel("Name").fill(tag("E2E custom "));
    await dialog
      .getByRole("group", { name: "Frequency" })
      .getByRole("button", { name: "Custom" })
      .click();
    await dialog.getByLabel("Cron expression").fill("0 6 * * 0");
    await dialog.getByRole("button", { name: "Create schedule" }).click();
    await expect(dialog.getByText(/so 0 is not valid/)).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("pauses and resumes from the list", async ({
    authenticatedPage: page,
  }) => {
    const s = await createSchedule(page, tag("E2E pause "));
    await openSchedules(page);
    const row = scheduleRow(page, s.name);
    const toggle = row.getByRole("switch");

    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await expect(row.getByText("Paused").first()).toBeVisible();
    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(row).toContainText("Active");
    await removeSchedule(page, s.id);
  });

  test("run now opens the new job and the detail lists it", async ({
    authenticatedPage: page,
  }) => {
    const s = await createSchedule(page, tag("E2E run "));
    await openSchedules(page);
    await scheduleRow(page, s.name)
      .getByRole("button", { name: `Run ${s.name} now` })
      .click();

    await expect(page).toHaveURL(/\/jobs\/drift-detection\/[^/]+$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Drift Detection" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Scheduled/ })).toHaveAttribute(
      "href",
      `/schedules/${s.id}`,
    );

    await page.goto(`/schedules/${s.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: s.name }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Recent jobs" }).getByRole("listitem"),
    ).toHaveCount(1);
    await removeSchedule(page, s.id);
  });

  test("deletes from the detail page through the confirm dialog", async ({
    authenticatedPage: page,
  }) => {
    const s = await createSchedule(page, tag("E2E delete "));
    await page.goto(`/schedules/${s.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: s.name }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    const confirm = page.getByRole("dialog", { name: "Delete schedule" });
    await expect(confirm).toContainText(s.name);
    await confirm.getByRole("button", { name: "Delete schedule" }).click();
    await expect(page).toHaveURL(/\/schedules$/);
    await expect(scheduleRow(page, s.name)).toHaveCount(0);
  });
});
