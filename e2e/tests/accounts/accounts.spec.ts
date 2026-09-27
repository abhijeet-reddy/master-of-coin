import { test, expect } from "../../fixtures/test-fixtures";
import {
  collectConsoleErrors,
  expectNoConsoleErrors,
} from "../../helpers/assertions";
import {
  ACCOUNT_TYPE_LABELS,
  archivedToggle,
  card,
  cardAction,
  createAccount,
  openAccounts,
  removeAccount,
  uniqueName,
} from "../../helpers/accounts";

/**
 * Accounts list (UI v2): overview panels, the account modal, archive and
 * unarchive (with the net-worth warning), and delete.
 */

test.describe("Accounts page", () => {
  test("renders heading, overview panels and actions without console errors", async ({
    authenticatedPage: page,
  }) => {
    const errors = collectConsoleErrors(page);
    await openAccounts(page);

    await expect(page.getByRole("region", { name: /Total balance/ })).toBeVisible();
    await expect(page.getByRole("region", { name: /Exposure by type/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect provider" })).toBeVisible();
    expectNoConsoleErrors(errors);
  });

  test("the modal offers exactly the supported account types", async ({
    authenticatedPage: page,
  }) => {
    await openAccounts(page);
    await page.getByRole("button", { name: "Add account" }).click();
    const dialog = page.getByRole("dialog", { name: "Add account" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Type").click();
    const options = page.getByRole("option");
    await expect(options).toHaveText(ACCOUNT_TYPE_LABELS);
    await page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("creates an account in the modal, then renames it", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Savings");
    const renamed = `${name} renamed`;
    await openAccounts(page);

    await page.getByRole("button", { name: "Add account" }).click();
    const dialog = page.getByRole("dialog", { name: "Add account" });
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Type").click();
    await page.getByRole("option", { name: "Savings", exact: true }).click();
    await dialog.getByLabel("Opening balance").fill("250");
    await dialog.getByRole("button", { name: "Create account" }).click();
    await expect(dialog).toBeHidden();

    const made = card(page, name);
    await expect(made).toBeVisible();
    await expect(made).toContainText("SAV");
    await expect(made).toContainText("250.00");

    await cardAction(page, name, "Edit");
    const edit = page.getByRole("dialog", { name: `Edit ${name}` });
    await edit.getByLabel("Name").fill(renamed);
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(edit).toBeHidden();
    await expect(card(page, renamed)).toBeVisible();

    const href = await card(page, renamed)
      .getByRole("link", { name: renamed })
      .getAttribute("href");
    await removeAccount(page, href!.split("/").pop()!);
  });

  test("archiving a funded account warns it still counts, and unarchive brings it back", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Funded");
    const acc = await createAccount(page, name, { balance: 42 });
    await openAccounts(page);

    await cardAction(page, name, "Archive");
    const confirm = page.getByRole("dialog", { name: `Archive ${name}?` });
    await expect(confirm.getByRole("status")).toContainText(
      "still count toward net worth",
    );
    await confirm.getByRole("button", { name: "Archive account" }).click();
    await expect(confirm).toBeHidden();

    // Collapsed by default: the card leaves the list.
    await expect(card(page, name)).toBeHidden();
    const toggle = archivedToggle(page);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page).toHaveURL(/archived=(1|true)/);
    await expect(card(page, name)).toContainText("Archived");

    await cardAction(page, name, "Unarchive");
    const back = page.getByRole("dialog", { name: `Unarchive ${name}?` });
    await back.getByRole("button", { name: "Unarchive account" }).click();
    await expect(back).toBeHidden();
    await expect(card(page, name)).not.toContainText("Archived");

    await removeAccount(page, acc.id);
  });

  test("archiving an empty account needs no warning", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Empty");
    const acc = await createAccount(page, name, { type: "CASH" });
    await openAccounts(page);

    await cardAction(page, name, "Archive");
    const confirm = page.getByRole("dialog", { name: `Archive ${name}?` });
    await expect(confirm.getByRole("button", { name: "Archive account" })).toBeVisible();
    await expect(confirm.getByRole("status")).toHaveCount(0);
    await confirm.getByRole("button", { name: "Cancel" }).click();

    await removeAccount(page, acc.id);
  });

  test("deletes an account with no transactions", async ({
    authenticatedPage: page,
  }) => {
    const name = uniqueName("E2E Delete");
    await createAccount(page, name, { type: "CASH" });
    await openAccounts(page);

    await cardAction(page, name, "Delete");
    const confirm = page.getByRole("dialog", { name: `Delete ${name}?` });
    await confirm.getByRole("button", { name: "Delete account" }).click();
    await expect(confirm).toBeHidden();
    await expect(card(page, name)).toBeHidden();
  });
});
