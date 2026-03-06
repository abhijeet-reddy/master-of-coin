import type { Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * Screenshot helper for E2E tests.
 *
 * Provides utilities for:
 * - Capturing full-page screenshots for agent visual verification
 * - Capturing element-specific screenshots
 * - Managing screenshot directories
 *
 * Screenshots are saved to:
 * - e2e/screenshots/actual/   — Current test run (gitignored)
 * - e2e/screenshots/baseline/ — Reference images (committed)
 * - e2e/screenshots/diff/     — Visual diff images (gitignored)
 */

const SCREENSHOTS_DIR = path.resolve(process.cwd(), "screenshots");
const ACTUAL_DIR = path.join(SCREENSHOTS_DIR, "actual");
const BASELINE_DIR = path.join(SCREENSHOTS_DIR, "baseline");
const DIFF_DIR = path.join(SCREENSHOTS_DIR, "diff");

export class ScreenshotHelper {
  constructor() {
    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    for (const dir of [ACTUAL_DIR, BASELINE_DIR, DIFF_DIR]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Capture a full-page screenshot and save to the actual screenshots directory.
   *
   * @param page - Playwright page instance
   * @param name - Screenshot name (without extension), e.g., 'dashboard', 'accounts-list'
   * @returns Path to the saved screenshot
   */
  async capturePageScreenshot(page: Page, name: string): Promise<string> {
    const filePath = path.join(ACTUAL_DIR, `${name}.png`);
    await page.screenshot({
      path: filePath,
      fullPage: true,
    });
    console.log(`📸 Screenshot saved: screenshots/actual/${name}.png`);
    return filePath;
  }

  /**
   * Capture a screenshot of a specific element.
   *
   * @param locator - Playwright locator for the element
   * @param name - Screenshot name (without extension)
   * @returns Path to the saved screenshot
   */
  async captureElementScreenshot(
    locator: Locator,
    name: string,
  ): Promise<string> {
    const filePath = path.join(ACTUAL_DIR, `${name}.png`);
    await locator.screenshot({
      path: filePath,
    });
    console.log(`📸 Element screenshot saved: screenshots/actual/${name}.png`);
    return filePath;
  }

  /**
   * Capture a viewport-only screenshot (not full page).
   *
   * @param page - Playwright page instance
   * @param name - Screenshot name (without extension)
   * @returns Path to the saved screenshot
   */
  async captureViewportScreenshot(page: Page, name: string): Promise<string> {
    const filePath = path.join(ACTUAL_DIR, `${name}.png`);
    await page.screenshot({
      path: filePath,
      fullPage: false,
    });
    console.log(`📸 Viewport screenshot saved: screenshots/actual/${name}.png`);
    return filePath;
  }

  /**
   * Check if a baseline screenshot exists for the given name.
   */
  hasBaseline(name: string): boolean {
    return fs.existsSync(path.join(BASELINE_DIR, `${name}.png`));
  }

  /**
   * Get the path to a baseline screenshot.
   */
  getBaselinePath(name: string): string {
    return path.join(BASELINE_DIR, `${name}.png`);
  }

  /**
   * Get the path to an actual screenshot.
   */
  getActualPath(name: string): string {
    return path.join(ACTUAL_DIR, `${name}.png`);
  }

  /**
   * Get the path to a diff screenshot.
   */
  getDiffPath(name: string): string {
    return path.join(DIFF_DIR, `${name}.png`);
  }

  /**
   * Copy an actual screenshot to become the new baseline.
   * Use this to update baselines after verifying changes are correct.
   *
   * @param name - Screenshot name (without extension)
   */
  updateBaseline(name: string): void {
    const actualPath = this.getActualPath(name);
    const baselinePath = this.getBaselinePath(name);

    if (!fs.existsSync(actualPath)) {
      throw new Error(`No actual screenshot found: ${actualPath}`);
    }

    fs.copyFileSync(actualPath, baselinePath);
    console.log(`📸 Baseline updated: screenshots/baseline/${name}.png`);
  }

  /**
   * List all baseline screenshots.
   */
  listBaselines(): string[] {
    if (!fs.existsSync(BASELINE_DIR)) return [];
    return fs.readdirSync(BASELINE_DIR).filter((f) => f.endsWith(".png"));
  }

  /**
   * List all actual screenshots from the current test run.
   */
  listActuals(): string[] {
    if (!fs.existsSync(ACTUAL_DIR)) return [];
    return fs.readdirSync(ACTUAL_DIR).filter((f) => f.endsWith(".png"));
  }
}
