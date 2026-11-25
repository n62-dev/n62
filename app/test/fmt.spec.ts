// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key (fmt) and the key vibration settings. Uses the real engine (GIAC_OUT).
import { expect, test, type Page } from "@playwright/test";
import { open, recordVibrations, sheet, sheetKey, tap, tapTwice, vibrations, tapHistory } from "./helpers.ts";

const lastText = (page: Page) => page.locator('[data-testid="result"] .result').last();
const ready = (page: Page) => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });

/** The Mode sheet (format chip, ▲), 5, then a section of Settings (R49, R50e: 2 Numbers, 3 Key vibration). */
async function openSettings(page: Page, section: "d2" | "d3"): Promise<void> {
  await tap(page, ["help", section]);
  await expect(page.getByTestId("sheet-title")).toHaveText(section === "d2" ? "Settings › Numbers" : "Settings › Key vibration");
}
/** The Mode sheet (format chip, ▲; Shift + Apps before R15c2). */
async function openMode(page: Page): Promise<void> {
  await tap(page, ["@mode"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Settings › Mode");
}
/** Settings is three levels deep: Esc goes back one each. */
const closeSettings = async (page: Page) => {
  await tap(page, ["esc", "esc", "esc"]);
  await expect(sheet(page)).toBeHidden();
};
const row = (page: Page, id: string) => sheet(page).locator(`[data-id="${id}"]`);
/** The Format key cycle's ticks: Settings › Numbers › Fmt key cycle (R40), four levels deep. */
async function openCycle(page: Page): Promise<void> {
  await openSettings(page, "d2");
  await tap(page, ["d2"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Settings › Numbers › Fmt key cycle");
}
/** Tick (or untick) notations of the Format key cycle, a tap per notation, then closed. */
async function toggleCycle(page: Page, modes: string[]): Promise<void> {
  await openCycle(page);
  for (const m of modes) await row(page, m).tap();
  await tap(page, ["esc"]);
  await closeSettings(page);
}
async function pickDigits(page: Page, valueKey: string): Promise<void> {
  await openMode(page);
  await tap(page, ["d3", valueKey]);
  await expect(sheet(page)).toBeHidden();
}

test("fmt shows 1/3 in Standard, Scientific, Engineering and back, for that result only", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d1", "d2", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "12");
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.333333333333");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "3.33333333333E-1");
  await expect(lastText(page).locator(".math")).toHaveAttribute("data-latex", "3.333\\,333\\,333\\,33\\times10^{-1}"); // R55: grouped in the drawing, the text above stays plain
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "333.333333333E-3");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.333333333333");
  // the earlier result and the global setting did not move
  await expect(page.locator('[data-testid="result"] .result').first()).toHaveAttribute("data-text", "12");
  expect(await page.evaluate(() => window.n62.session.settings.format)).toBe("std");
});

test("a b/c (R10): 7/3 shows as 7/3, then the decimal again; never a mixed number, needs no setting", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d7", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.33333333333");
  await tap(page, ["frac"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "7/3");
  await expect(lastText(page).locator(".math")).toHaveAttribute("data-latex", "\\frac{7}{3}");
  await tap(page, ["frac"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.33333333333");
});

test("the Format key cycle and the vibration settings persist across a reload", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await toggleCycle(page, ["eng", "fix"]);
  // key vibration: a tap switches it on, ▶ ×5 sets the length from 15 to 40 ms
  await openSettings(page, "d3");
  await row(page, "haptics").tap();
  for (let i = 0; i < 5; i++) await row(page, "ms").getByTestId("step-up").tap();
  await closeSettings(page);
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined);
  await page.waitForFunction(() => window.n62.session.settings.haptics.on === true);
  await openSettings(page, "d3");
  await expect(row(page, "haptics")).toHaveAttribute("data-selected", "true");
  await expect(row(page, "ms").getByTestId("sheet-value")).toHaveText("40 ms");
  // the web build cannot set the strength, and the row says why
  await expect(row(page, "strength")).toHaveAttribute("aria-disabled", "true");
  await expect(row(page, "strength").locator(".reason")).toHaveText("The Android app only");
  await closeSettings(page);
  await openCycle(page);
  const marked = await sheet(page).locator('[data-selected="true"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
  expect(marked).toEqual(["std", "sci", "fix"]);
  expect(await page.evaluate(() => window.n62.session.settings.haptics)).toEqual({ on: true, strength: 50, ms: 40, click: false });
});

test("key vibration: off by default, and on it calls navigator.vibrate on key-down", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __vib: unknown[] }).__vib = calls;
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (p: unknown) => (calls.push(p), true) });
  });
  const vib = () => page.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib);
  await page.setViewportSize({ width: 412, height: 915 }); // the Settings sheet leaves history above it
  await open(page);
  await tap(page, ["d1", "d2"]);
  expect(await vib()).toEqual([]);
  await openSettings(page, "d3");
  await row(page, "haptics").tap();
  expect(await vib()).toEqual([]); // switched on from the sheet's row, where no key goes down
  await tapHistory(page); // a tap above the sheet closes it: no key either
  await expect(sheet(page)).toBeHidden();
  expect(await vib()).toEqual([]);
  await tap(page, ["d3"]);
  expect(await vib()).toEqual([15]); // the default length, one call per key
  await page.locator('[data-key="d4"]').dispatchEvent("pointerdown");
  expect(await vib()).toEqual([15, 15]);
});

const markOfLast = (page: Page) => page.getByTestId("mark").last();

test("marks: = for an exact value shown in full, ≈ for digits of an irrational or a third; none for a non-number", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d2", "add", "d2", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "4");
  await expect(markOfLast(page)).toHaveText("=");
  await tap(page, ["d1", "div", "d4", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.25");
  await expect(markOfLast(page)).toHaveText("=");
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.333333333333");
  await expect(markOfLast(page)).toHaveText("≈");
  // the old "approximate" note is gone
  await expect(page.getByText("approximate", { exact: true })).toHaveCount(0);
  // a b/c shows the third as an exact fraction: =
  await tap(page, ["frac"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1/3");
  await expect(markOfLast(page)).toHaveText("=");
});

test("30 digits: the setting takes 30, Home draws 30 digits and 1/3 stays ≈", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await pickDigits(page, "d9"); // 4 6 8 10 12 15 20 25 30
  expect(await page.evaluate(() => window.n62.session.settings.digits)).toBe(30);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", `0.${"3".repeat(30)}`);
  await expect(markOfLast(page)).toHaveText("≈");
});

test("PFX: 2500 draws as 2.5 k with a thin space and an accented prefix, from Settings and from the Format key", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await pickDigits(page, "d1");
  expect(await page.evaluate(() => window.n62.session.settings.digits)).toBe(4);
  await toggleCycle(page, ["pfx"]);
  await tap(page, ["d2", "d5", "d0", "d0", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2500");
  await expect(markOfLast(page)).toHaveText("=");
  // std -> sci -> pfx (G785: eng draws 2500 = 2.5×10^3 as sci does, so it is skipped)
  await tap(page, ["fmt", "fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.5 k");
  await expect(lastText(page).locator(".pfx")).toHaveText("k");
  await expect(markOfLast(page)).toHaveText("=");
  // as the global format too
  await page.getByTestId("chip-format").tap(); // the Mode sheet on its Format row; ▶ ×3: Standard → … → Prefixes
  await sheetKey(page, ["right", "right", "right", "enter"]);
  expect(await page.evaluate(() => window.n62.session.settings.format)).toBe("pfx");
  await tap(page, ["d1", "d2", "d0", "d0", "d0", "d0", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "120 k");
  // tapping the result puts a chip with the full value on the line, never the prefix text
  await tapTwice(lastText(page), "click"); // R147: the first tap picks the row
  const chips = await page.evaluate(() => Object.values(window.n62.entry.chips).map((c) => c.value));
  expect(chips).toEqual(["120000"]);
});

test("marks: an un-audited float is ⚠ with no count and shows only the confirmed digits (M4-5)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await page.evaluate(() => window.n62.session.setDigits(30));
  // oracle: besselj(1,2) = 0.576724807756873387202448242269…; the engine falls back to a double here
  await page.evaluate(() => window.n62.session.submit("\\operatorname{BesselJ}\\left(1,2\\right)"));
  await expect(lastText(page)).toHaveAttribute("data-text", "0.57672480775687");
  await expect(markOfLast(page)).toHaveText("⚠");
});

// R775: Fmt and a b/c take Copy's row: the picked row, else the newest finished one
const texts = (page: Page) => page.locator('[data-testid="result"] .result');
const errors = (page: Page) => page.locator('[data-status="error"]');
/** One error row (1ᴇ2.5) after the rows so far, the line empty again. */
async function errorRow(page: Page): Promise<void> {
  const before = await errors(page).count();
  await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]);
  await expect(errors(page)).toHaveCount(before + 1);
  await page.evaluate(() => window.n62.entry.clear());
}

test("R775: Fmt after a refused line acts on the newest finished row", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d5", "d0", "d0", "d0", "d0", "enter"]);
  await expect(texts(page).last()).toHaveAttribute("data-text", "50000");
  await errorRow(page);
  await tap(page, ["fmt"]);
  await expect(texts(page).first()).toHaveAttribute("data-text", "5.00000000000E4");
  await expect(texts(page).first().locator(".math")).toHaveAttribute("data-latex", /times10\^\{4\}/);
});

test("R775: Fmt on a picked older row changes that row, not the last", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d3", "enter"]);
  await expect(texts(page)).toHaveCount(1);
  await tap(page, ["d4", "enter"]);
  await expect(texts(page)).toHaveCount(2);
  await tap(page, ["d5", "d0", "d0", "d0", "d0", "enter"]); // 50000 last, so rows 1 and 2 stay plain
  await expect(texts(page)).toHaveCount(3);
  await tap(page, ["up", "up", "up"]); // picks row 1 (3)
  await expect(page.locator('article.item[data-selected="true"]')).toHaveCount(1);
  await tap(page, ["fmt"]);
  await expect(texts(page).nth(0)).toHaveAttribute("data-text", "3.00000000000E0");
  await expect(texts(page).nth(1)).toHaveAttribute("data-text", "4");
  await expect(texts(page).nth(2)).toHaveAttribute("data-text", "50000");
  // the pick stays, so a second press goes on round the cycle on the same row (G785: past eng, which draws 3 as sci does)
  await tap(page, ["fmt"]);
  await expect(texts(page).nth(0)).toHaveAttribute("data-text", "3");
  await expect(texts(page).nth(1)).toHaveAttribute("data-text", "4");
  await expect(texts(page).nth(2)).toHaveAttribute("data-text", "50000");
});

test("R775: a b/c after a refused line acts on the newest finished row", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d0", "dot", "d5", "enter"]);
  await expect(texts(page).last()).toHaveAttribute("data-text", "0.5");
  await errorRow(page);
  await tap(page, ["frac"]);
  await expect(texts(page).first()).toHaveAttribute("data-text", "1/2");
});

test("R775: a b/c on a picked older row changes that row, not the last", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d0", "dot", "d5", "enter"]);
  await expect(texts(page)).toHaveCount(1);
  await tap(page, ["d0", "dot", "d2", "d5", "enter"]);
  await expect(texts(page)).toHaveCount(2);
  await tap(page, ["up", "up", "frac"]);
  await expect(texts(page).nth(0)).toHaveAttribute("data-text", "1/2");
  await expect(texts(page).nth(1)).toHaveAttribute("data-text", "0.25");
});

test("R775: a picked error row: Fmt and a b/c do nothing and are dead presses", async ({ page }) => {
  await recordVibrations(page);
  await open(page, "");
  await ready(page);
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["d0", "dot", "d5", "enter"]);
  await expect(texts(page)).toHaveCount(1);
  await errorRow(page);
  await tap(page, ["up"]); // picks the newest row, the error
  await expect(page.locator('article.item[data-selected="true"][data-status="error"]')).toHaveCount(1);
  const v1 = (await vibrations(page)).length;
  await tap(page, ["fmt"]);
  await expect.poll(async () => (await vibrations(page)).length - v1).toBe(2); // the dead pulse alone (R777: no row to take)
  await tap(page, ["frac"]);
  await expect.poll(async () => (await vibrations(page)).length - v1).toBe(4);
  await expect(texts(page).first()).toHaveAttribute("data-text", "0.5");
});

test("R775 control: Fmt on the last row, nothing picked, as before", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d3", "enter"]);
  await tap(page, ["d5", "d0", "d0", "d0", "d0", "enter"]);
  await expect(texts(page)).toHaveCount(2);
  await tap(page, ["fmt"]);
  await expect(texts(page).nth(1)).toHaveAttribute("data-text", "5.00000000000E4");
  await expect(texts(page).nth(0)).toHaveAttribute("data-text", "3");
});

// G785: Fmt skips a step that would draw what the row shows; a press that changes nothing (Fmt or a b/c) is a dead press.
// Derived: 5 = 5×10^0, an exponent that is a multiple of 3, so ENG draws 5 as SCI does; STD draws 5 as the exact 5 and as PFX
// (10^0 has no prefix).
test("G785: the default cycle at 12 digits: 5, Fmt 5.00000000000E0, Fmt 5 again (ENG would draw what SCI does)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d5", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5.00000000000E0");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
});

test("G785: CAS, cycle STD SCI, digits 6: the first Fmt on 5 shows 5.00000E0 (STD draws the exact 5)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await page.evaluate(() => (window.n62.session.setDigits(6), ((window.n62.session.settings.fmtCycle = ["std", "sci"]), window.n62.session.save())));
  await tap(page, ["@cas"]);
  await tap(page, ["d5", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5.00000E0");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
});

test("G785: Home, Format PFX, cycle STD SCI, digits 6: the first Fmt on 5 shows 5.00000E0 (STD draws 5 as PFX does)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await page.evaluate(() => (window.n62.session.setDigits(6), ((window.n62.session.settings.fmtCycle = ["std", "sci"]), window.n62.session.save()), window.n62.session.setFormat("pfx")));
  await tap(page, ["d5", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5.00000E0");
});

/** Home, key vibration on (10 ms), the Format key cycle `cycle`, `5` Enter; then `key`'s press, once the forms code is in
 *  (main.ts loads it when idle) and says that press changes nothing. The pulses of the press, counted as onepulse.spec.ts does. */
async function pressOnFive(page: Page, cycle: string[], key: "fmt" | "frac", form: "cycleFormat" | "cycleForm"): Promise<number> {
  await recordVibrations(page);
  await open(page, "");
  await ready(page);
  await page.evaluate((c) => {
    const s = window.n62.session;
    s.setHaptics({ on: true, ms: 10 });
    s.settings.fmtCycle = (["std", "sci", "eng"] as const).filter((m) => c.includes(m)); // modeSets.ts's setFmtMode, which the page cannot reach (G792)
    s.save();
  }, cycle);
  expect(await page.evaluate(() => window.n62.session.settings.fmtCycle)).toEqual(cycle);
  await tap(page, ["d5", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
  await expect.poll(() => page.evaluate((k) => window.n62.session.formRow(k, null) === undefined, form)).toBe(true);
  const before = (await vibrations(page)).length;
  await tap(page, [key]);
  await page.waitForTimeout(300); // a dead key's second pulse comes ~80 ms after the first
  return (await vibrations(page)).length - before;
}

test("G785: Home, cycle STD only: Fmt on 5 is a dead press, the double pulse alone, and the row stays 5", async ({ page }) => {
  expect(await pressOnFive(page, ["std"], "fmt", "cycleFormat")).toBe(2); // the dead pulse alone (R777, docs/05 3.7)
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
});

test("G785: Home, a b/c on 5 (no other form) is a dead press, the double pulse alone; the row stays 5, the line empty", async ({ page }) => {
  expect(await pressOnFive(page, ["std", "sci", "eng"], "frac", "cycleForm")).toBe(2);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
  expect(await page.evaluate(() => window.n62.entry.empty)).toBe(true);
});
