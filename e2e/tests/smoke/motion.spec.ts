import { test, expect } from "../../fixtures/test-fixtures";

/**
 * Motion smoke tests. The suite runs with reduced motion (playwright.config),
 * so this file opts back in to check the motion layer really runs:
 * 1. Every CSS animation that plays on the dashboard resolves to a keyframe that
 *    exists (a CSS Modules rename to a missing keyframe fails silently otherwise)
 * 2. Panels power on and charts draw in
 * 3. Headline figures count up
 * And, with reduced motion, that the `rm` class is set and figures do not count.
 */

async function animationReport(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const defined = new Set<string>();
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const r of Array.from(rules)) {
        if (r instanceof CSSKeyframesRule) defined.add(r.name);
      }
    }
    const names = document
      .getAnimations()
      .filter((a): a is CSSAnimation => "animationName" in a)
      .map((a) => a.animationName);
    return { names, missing: names.filter((n) => !defined.has(n)) };
  });
}

test.describe("Motion", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("dashboard entry motion runs on real keyframes", async ({
    authenticatedPage: page,
  }) => {
    await page.addInitScript(() => sessionStorage.setItem("moc-booted", "1"));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Dashboard/i,
    );
    const report = await animationReport(page);
    expect(report.missing).toEqual([]);
    expect(report.names).toContain("moc-pwr");
    expect(report.names).toContain("moc-roll-in");
  });

  test("headline figures count up", async ({ authenticatedPage: page }) => {
    await page.addInitScript(() => sessionStorage.setItem("moc-booted", "1"));
    await page.goto("/dashboard");
    const seen = new Set<string>();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const t = await page.locator("main data").first().textContent();
      if (t) seen.add(t);
      await page.waitForTimeout(50);
    }
    const final = await page.locator("main data").first().textContent();
    test.skip(
      /^[^1-9]*$/.test(final ?? ""),
      "figure is zero, nothing to count",
    );
    expect(seen.size).toBeGreaterThan(2);
  });
});

test("reduced motion sets rm and keeps figures still", async ({
  authenticatedPage: page,
}) => {
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveClass(/\brm\b/);
  const first = page.locator("main data").first();
  await expect(first).toBeVisible();
  const a = await first.textContent();
  await page.waitForTimeout(400);
  expect(await first.textContent()).toBe(a);
});
