// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key (fmt) and the key vibration settings. Uses the real engine (GIAC_OUT).
import { readFileSync } from "node:fs";
import { devices, expect, test, type Page } from "@playwright/test";
import { open, recordVibrations, savePicker, sheet, sheetKey, tap, tapTwice, vibrations, tapHistory } from "./helpers.ts";

const lastText = (page: Page) => page.locator('[data-testid="result"] .result').last();
const ready = (page: Page) => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });

/** ⚙, then a section of Settings (R49, R50e, R927: 3 Numbers, 4 Key vibration). */
async function openSettings(page: Page, section: "d3" | "d4"): Promise<void> {
  await tap(page, ["help", section]);
  await expect(page.getByTestId("sheet-title")).toHaveText(section === "d3" ? "Settings › Numbers" : "Settings › Key vibration");
}
/** The Mode sheet (format chip, ▲; Shift + Apps before R15c2). */
async function openMode(page: Page): Promise<void> {
  await tap(page, ["@mode"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Settings › Mode");
}
/** A section of Settings is two levels deep: Esc goes back one each. */
const closeSettings = async (page: Page) => {
  await tap(page, ["esc", "esc"]);
  await expect(sheet(page)).toBeHidden();
};
const row = (page: Page, id: string) => sheet(page).locator(`[data-id="${id}"]`);
/** The Format key cycle's ticks: Settings › Numbers › Fmt key cycle (R40), four levels deep. */
async function openCycle(page: Page): Promise<void> {
  await openSettings(page, "d3");
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
  await tap(page, ["d4", valueKey]);
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
  await openSettings(page, "d4");
  await row(page, "haptics").tap();
  for (let i = 0; i < 5; i++) await row(page, "ms").getByTestId("step-up").tap();
  await closeSettings(page);
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined);
  await page.waitForFunction(() => window.n62.session.settings.haptics.on === true);
  await openSettings(page, "d4");
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
  await openSettings(page, "d4");
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

// G795: FIX of a value whose integer part is longer than its confirmed digits falls back to SCI at fixed + 1 significant
// digits, as a too-small value does (G2 item 60). Oracle (mpmath): exp(100) = 2.68811714181613544841…E43.
/** Home, Fmt key cycle STD FIX, `decimals` decimals; `keys` tapped, the row's STD text checked. */
async function fixRow(page: Page, decimals: number, keys: string[], std: string): Promise<void> {
  await open(page, "");
  await ready(page);
  await page.evaluate((d) => {
    const s = window.n62.session;
    s.settings.fmtCycle = ["std", "fix"];
    s.settings.fixDecimals = d;
    s.save();
  }, decimals);
  await tap(page, keys);
  await expect(lastText(page)).toHaveAttribute("data-text", std);
}

test("G795: exp(100), Fmt to FIX 4: 2.6881E43 with ≈, never ⚠ 40 and 40 digits", async ({ page }) => {
  await fixRow(page, 4, ["shift", "ln", "d1", "d0", "d0", "enter"], "2.68811714182E43");
  await expect(markOfLast(page)).toHaveText("≈");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "2.6881E43");
  await expect(markOfLast(page)).toHaveText("≈");
});

test("G795 controls: 2^100 FIX 4 stays the exact integer with =; sqrt(2)·10^15 FIX 2 keeps its decimals", async ({ page }) => {
  await fixRow(page, 4, ["d2", "pow", "d1", "d0", "d0", "enter"], "1.26765060023E30");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1267650600228229401496703205376.0000");
  await expect(markOfLast(page)).toHaveText("=");
  await page.evaluate(() => {
    window.n62.session.settings.fixDecimals = 2;
    window.n62.session.save();
  });
  await tap(page, ["shift", "sq", "d2", "right", "mul", "d1", "d0", "pow", "d1", "d5", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1.41421356237E15");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1414213562373095.05");
  await expect(markOfLast(page)).toHaveText("≈");
});

// R871 (owner, 2026-11-22, his point 22: Fmt gave no feedback on the notation): Shift + Fmt opens Settings › Numbers › Fmt key
// cycle, whose last row "Say the format on each Fmt press" (off by default) has a Fmt press that changed the row say its notation
// for 1.5 s where "Copied" shows (R774). The record is its own (`fmtSay`, as R194's word), read lazily, a backup part.
const CYCLE = "Settings › Numbers › Fmt key cycle";
const SAY = "fmtSay";
const title = (page: Page) => page.getByTestId("sheet-title");
const notice = (page: Page) => page.getByTestId("notice");
const rowIds = (page: Page) => sheet(page).locator('[role="menuitem"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
/** Shift + Fmt: the Fmt key cycle's page. */
async function cyclePage(page: Page): Promise<void> {
  await tap(page, ["shift", "fmt"]);
  await expect(title(page)).toHaveText(CYCLE);
}
/** From the cycle's page: up to Numbers, Settings, closed. */
async function closeCycle(page: Page): Promise<void> {
  await tap(page, ["esc", "esc", "esc"]);
  await expect(sheet(page)).toBeHidden();
}
/** The switch, set from its page (a tap per change). */
async function setSay(page: Page, on: boolean): Promise<void> {
  await cyclePage(page);
  if ((await row(page, SAY).getAttribute("data-selected")) !== String(on)) await row(page, SAY).tap();
  await expect(row(page, SAY)).toHaveAttribute("data-selected", String(on));
  await closeCycle(page);
}

for (const [width, height] of [
  [360, 740],
  [412, 915],
] as const) {
  test(`R871: Shift + Fmt opens the Fmt key cycle's page in Home and CAS, Esc goes up one level; in an app it is dead (${width} × ${height})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await recordVibrations(page);
    await open(page);
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
    const fmt = page.locator('[data-key="fmt"]');
    await tap(page, ["shift"]);
    await expect(fmt).not.toHaveAttribute("data-dead", "true"); // the Shift layer is live now
    await tap(page, ["fmt"]);
    await expect(title(page)).toHaveText(CYCLE);
    expect(await rowIds(page)).toEqual(["std", "sci", "eng", "pfx", "fix", SAY]); // the five ticks, the switch last
    await expect(row(page, SAY)).toHaveText(/Say the format on each Fmt press/);
    await expect(row(page, SAY)).toHaveAttribute("data-selected", "false"); // off on a fresh profile
    await tap(page, ["esc"]); // one level up, as from Mode
    await expect(title(page)).toHaveText("Settings › Numbers");
    await tap(page, ["esc", "esc"]);
    await expect(sheet(page)).toBeHidden();
    await tap(page, ["@cas"]);
    await cyclePage(page);
    await closeCycle(page);
    // an app (Function's Symb): no Home result there, a dead press: the double pulse alone, no sheet
    await tap(page, ["@symb"]);
    await tap(page, ["shift"]);
    const v1 = (await vibrations(page)).length;
    await tap(page, ["fmt"]);
    await expect.poll(async () => (await vibrations(page)).length - v1).toBe(2);
    await page.waitForTimeout(300);
    await expect(sheet(page)).toBeHidden();
  });
}

test("R871: Say the format: off, 1/3 Enter Fmt says nothing; on, Fmt says Sci · this result for 1.5 s; a dead Fmt and a b/c say nothing", async ({ page }) => {
  await open(page, "");
  await ready(page);
  // off (a fresh profile): no notice after a Fmt that changed the row, nor after a b/c
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.333333333333");
  await tap(page, ["fmt"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "3.33333333333E-1");
  await tap(page, ["frac"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1/3");
  await page.waitForTimeout(600);
  await expect(notice(page)).toHaveCount(0);
  // on
  await setSay(page, true);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "0.333333333333");
  const t0 = Date.now();
  await tap(page, ["fmt"]);
  await expect(notice(page)).toHaveText("Sci · this result", { timeout: 300 });
  await expect(lastText(page)).toHaveAttribute("data-text", "3.33333333333E-1");
  await expect(notice(page)).toBeHidden({ timeout: Math.max(1, 2000 - (Date.now() - t0)) });
  expect(Date.now() - t0).toBeGreaterThanOrEqual(1400); // it stayed its 1.5 s
  // a b/c says nothing with the switch on too
  await tap(page, ["frac"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "1/3");
  await page.waitForTimeout(600);
  await expect(notice(page)).toHaveCount(0);
  // a press that changes nothing (G785: cycle STD only, on 5) says nothing
  await page.evaluate(() => {
    window.n62.session.settings.fmtCycle = ["std"];
    window.n62.session.save();
  });
  await tap(page, ["d5", "enter"]);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
  await tap(page, ["fmt"]);
  await page.waitForTimeout(600);
  await expect(notice(page)).toHaveCount(0);
  await expect(lastText(page)).toHaveAttribute("data-text", "5");
});

test("R871: Say the format survives a reload, and a backup and restore carries it", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 412, height: 915 });
  await savePicker(page, "none"); // the backup comes back as a download
  await open(page);
  await setSay(page, true);
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined);
  await cyclePage(page);
  await expect(row(page, SAY)).toHaveAttribute("data-selected", "true");
  await closeCycle(page);
  // the backup holds the part
  await tap(page, ["help"]);
  await row(page, "data").tap();
  await expect(title(page)).toHaveText("Settings › Data");
  const download = page.waitForEvent("download");
  await row(page, "backup").tap();
  const path = (await (await download).path()) as string;
  const parts = (JSON.parse(readFileSync(path, "utf8")) as { parts: Record<string, { value: unknown }> }).parts;
  expect(parts[SAY]?.value).toBe(true);
  // restored into an empty store (a new context), where it was off
  const ctx = await browser.newContext({ ...devices["Pixel 7"], baseURL: new URL(page.url()).origin });
  const other = await ctx.newPage();
  await open(other);
  await cyclePage(other);
  await expect(row(other, SAY)).toHaveAttribute("data-selected", "false");
  await closeCycle(other);
  await tap(other, ["help"]);
  await row(other, "data").tap();
  const chooser = other.waitForEvent("filechooser");
  await row(other, "restore").tap();
  await (await chooser).setFiles(path);
  await expect(title(other)).toHaveText("Restore from a file");
  await expect(row(other, SAY)).toBeVisible();
  const load = other.waitForEvent("load");
  await row(other, "restore").tap();
  await load;
  await other.waitForFunction(() => window.n62 !== undefined);
  await cyclePage(other);
  await expect(row(other, SAY)).toHaveAttribute("data-selected", "true");
  await ctx.close();
});
