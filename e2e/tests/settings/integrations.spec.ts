import { test, expect } from "../../fixtures/test-fixtures";
import { openSettings } from "../../helpers/settings";

/**
 * Settings, Integrations tab (UI v2): split providers, the OAuth return,
 * SplitPro's dialog, drift detection and bank or brokerage links.
 */

test.describe("Settings integrations", () => {
  test("lists Splitwise, SplitPro and the bank links", async ({
    authenticatedPage: page,
  }) => {
    await openSettings(page, "integrations");
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByText("Splitwise", { exact: true })).toBeVisible();
    await expect(panel.getByText("SplitPro", { exact: true })).toBeVisible();
    await expect(panel.getByText("Bank and brokerage")).toBeVisible();
  });

  test("the Splitwise return toasts and cleans the URL", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings?tab=split&status=connected");
    await expect(page.getByText("Splitwise connected").first()).toBeVisible();
    await expect(page).toHaveURL(/tab=integrations/);
    await expect(page).not.toHaveURL(/status=/);
  });

  test("a failed Splitwise return says so", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings?tab=integrations&status=error");
    await expect(
      page.getByText("Splitwise connection failed").first(),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/status=/);
  });

  test("SplitPro asks for a valid email", async ({
    authenticatedPage: page,
  }) => {
    await openSettings(page, "integrations");
    const connect = page.getByRole("button", { name: "Connect SplitPro" });
    test.skip(!(await connect.isVisible()), "SplitPro is already connected");
    await connect.click();
    const dialog = page.getByRole("dialog", { name: "Connect SplitPro" });
    await dialog.getByLabel("SplitPro email").fill("not-an-email");
    await dialog.getByRole("button", { name: "Connect" }).click();
    await expect(dialog.getByLabel("SplitPro email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("drift detection starts a job and opens it", async ({
    authenticatedPage: page,
  }) => {
    await openSettings(page, "integrations");
    const check = page.getByRole("button", { name: "Check for drift" });
    test.skip(await check.isDisabled(), "No split provider connected");
    await check.click();
    const dialog = page.getByRole("dialog", { name: "Check for drift" });
    await expect(dialog.getByText("From", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Start check" }).click();
    await expect(page).toHaveURL(/\/jobs\/drift-detection\/[^/]+$/);
  });
});
