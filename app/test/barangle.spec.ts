// SPDX-License-Identifier: GPL-3.0-or-later
// R783 (owner, 2026-11-20), R856 (owner, 2026-11-22): the bar's right anchor is the angle, now the word RAD or DEG (no icon, never
// filled), and ☰, at the same x in every place; ⇧ α is off the bar while the keys are up and stays on the folded bar and with a
// hardware keyboard in use (docs/05 3.2). The fake engine; the angle's results are status.spec.ts's.
import { expect, test, type Page } from "@playwright/test";
import { open, tap, touch } from "./helpers.ts";

const chip = (p: Page) => p.getByTestId("chip-angle");
const angle = (p: Page) => p.evaluate(() => window.n62.session.settings.angle);
const uses = (p: Page, name: string) => p.evaluate((n) => window.n62.session.useCounters["bar-uses"]?.get(n) ?? 0, name);

for (const width of [360, 392, 412] as const) {
  test(`the angle control is the word RAD or DEG, no icon, and a tap toggles it at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    await expect(chip(page).locator("svg")).toHaveCount(0);
    await expect(chip(page)).toHaveText("RAD");
    await expect(chip(page)).toHaveAttribute("data-angle", "rad");
    await expect(chip(page)).toHaveAttribute("aria-label", "Angle: radians");
    await chip(page).tap();
    await expect(chip(page)).toHaveText("DEG");
    await expect(chip(page)).toHaveAttribute("data-angle", "deg");
    await expect(chip(page)).toHaveAttribute("aria-label", "Angle: degrees");
    expect(await angle(page)).toBe("deg");
    await chip(page).tap();
    await expect(chip(page)).toHaveText("RAD");
    expect(await angle(page)).toBe("rad");
  });

  test(`the angle word and ☰ stand at the same x in Home, CAS and Function, each at least 28 × 28, at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const at = async (): Promise<Record<string, string>> =>
      page.evaluate(() => {
        const o: Record<string, string> = {};
        for (const id of ["chip-angle", "menu-button"]) {
          const r = (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).getBoundingClientRect();
          o[id] = `${r.left.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`;
        }
        return o;
      });
    const home = await at();
    await tap(page, ["@cas"]);
    expect(await at(), "CAS").toEqual(home);
    await tap(page, ["@plot"]);
    await page.waitForFunction(() => window.n62.shell.app === "function" && window.n62.shell.loading === null);
    expect(await at(), "Function").toEqual(home);
    for (const id of ["chip-angle", "menu-button"]) {
      const [, w, h] = (home[id] as string).split(",").map(Number);
      expect(w, `${id} width`).toBeGreaterThanOrEqual(28);
      expect(h, `${id} height`).toBeGreaterThanOrEqual(28);
    }
  });
}

test("keys up: Shift armed, locked and Alpha leave no ⇧ α slot on the bar", async ({ page }) => {
  await open(page);
  for (const keys of [["shift"], ["shift"], ["shift"], ["alpha"], ["alpha"], ["alpha"]]) {
    await tap(page, keys);
    await expect(page.getByTestId("mod-slot")).toHaveCount(0);
    await expect(page.locator('[data-testid="bar"] [data-testid^="mod-"]')).toHaveCount(0);
  }
  await tap(page, ["shift", "shift"]); // locked: the key shows it, the bar does not
  await expect(page.locator('[data-key="shift"]')).toHaveAttribute("data-locked", "true");
  await expect(page.getByTestId("mod-slot")).toHaveCount(0);
});

test("with a hardware keyboard in use the badge shows on the unfolded bar, a touch on the keys takes it off again", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control"); // a physical key
  await page.evaluate(() => (window.n62.session.shift = true));
  await expect(page.getByTestId("mod-shift")).toBeVisible();
  await page.getByTestId("mod-shift").tap(); // a button that ends Shift
  await expect(page.getByTestId("mod-shift")).toHaveCount(0);
  await tap(page, ["d1"]); // a touch: the keys are in use again
  await page.evaluate(() => (window.n62.session.shift = true));
  await expect(page.getByTestId("mod-slot")).toHaveCount(0);
});

test("folded: the badge shows Shift, a tap on it ends it", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-fold-ready", "true");
  await tap(page, ["shift"]);
  const f = await touch(page, '[data-testid="entry"]');
  await f.move(0, 40, 4);
  await f.end();
  const fbar = page.getByTestId("folded-bar");
  await expect(fbar.getByTestId("mod-shift")).toBeVisible();
  await fbar.getByTestId("mod-shift").tap();
  await expect(fbar.getByTestId("mod-shift")).toHaveCount(0);
  expect(await page.evaluate(() => window.n62.session.shift)).toBe(false);
});

test("bar.angle counts one per tap and bar.angle.undo a toggle undone within 3 s", async ({ page }) => {
  await open(page);
  await chip(page).tap();
  await expect.poll(() => uses(page, "bar.angle")).toBe(1);
  expect(await uses(page, "bar.angle.undo")).toBe(0);
  await chip(page).tap(); // taken back at once
  await expect.poll(() => uses(page, "bar.angle")).toBe(2);
  await expect.poll(() => uses(page, "bar.angle.undo")).toBe(1);
});
