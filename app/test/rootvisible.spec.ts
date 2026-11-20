// SPDX-License-Identifier: GPL-3.0-or-later
// R82 (F110): c46 (Function, F1 = x²−2, Plot, Menu, 1 Root) at phone sizes; the Root answer must be on screen and
// uncovered, the check core-lib's `text` expects make. The Fairphone 6 is 372×828 CSS px at DPR 3; the Pixel 7 the
// e2e default. "short" is the Fairphone's width on less height (bars, a larger font scale): there the stage above the
// keypad was squeezed below the readout's height, the board shrank to 0 and the keypad covered the readout (phase-1).
import { expect, test } from "@playwright/test";
import { loadCore, replay, seen, start } from "./core-lib.ts";

const c46 = loadCore().find((c) => c.id === "c46");
const SIZES = [
  ["Fairphone 6", 372, 828],
  ["Pixel 7", 412, 915],
  ["Fairphone 6 width, short", 372, 560],
] as const;

for (const [name, width, height] of SIZES)
  test(`c46's Root answer is on screen and uncovered at ${name} (${width}×${height})`, async ({ browser }) => {
    if (!c46) throw new Error("c46 is not in core.yaml");
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try {
      await start(page);
      await replay(page, c46.keys);
      const sel = '[data-testid="readout-x"]';
      await expect(page.locator(sel)).toHaveText("1.41421356237");
      await expect.poll(() => seen(page, sel), { message: `c46 ${sel} at ${width}×${height}`, timeout: 2000 }).toBe("");
      // the column fits the screen: nothing scrolls, the keypad's last row ends on screen and is uncovered (audit, run 268)
      const fit = await page.evaluate(() => {
        const keys = document.querySelector(".keys")?.getBoundingClientRect();
        const last = [...document.querySelectorAll(".keys [data-key]")].at(-1);
        const r = last?.getBoundingClientRect();
        const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
        return {
          scroll: (document.scrollingElement?.scrollHeight ?? 0) - innerHeight,
          keysBottom: (keys?.bottom ?? Infinity) - innerHeight,
          lastRowUncovered: !!(last && hit && (hit === last || last.contains(hit))),
        };
      });
      expect(fit.scroll, `c46 page scrolls at ${width}×${height}`).toBe(0);
      expect(fit.keysBottom, `c46 .keys bottom past the screen at ${width}×${height}`).toBeLessThanOrEqual(0);
      expect(fit.lastRowUncovered, `c46 keypad's last row covered at ${width}×${height}`).toBe(true);
    } finally {
      await ctx.close();
    }
  });

// R82f1 (F117): Plot's ☰ at the Fairphone's size. Every entry is on screen and uncovered without scrolling at 372×828
// and at 372×767 (the WebView's height there, bars taken off: CORE DEVICE's log); on the short screen each one is
// reachable: on screen, or the count cue shown and scrolled to. Phase-1 cut Settings, the ninth row, by 3 px at both.
// R770: every sheet is in the viewport now, so under 1000 px tall the Menu scrolls inside it and each row is scrolled to.
// R722: under 1000 px tall the rows are 43 px (owner, 2026-11-17), so the Fairphone's Menu scrolls at its floor (every row
// reachable, the cue showing). At 412 × 1000 (R722's threshold for full-height rows) the list is 428 px tall: the ten rows with
// c46's one reason line (To Home off, "No result yet": 9 × 42 + 58 = 436 px) are 8 px too much, so the cue shows and each row is
// reached (R785, pass 222: no viewport is picked so that ten rows fit; the Menu may scroll at 1000 px tall)
const MENU_SIZES = [
  ["Fairphone 6", 372, 828, false],
  ["Fairphone 6 WebView", 372, 767, false],
  ["Fairphone 6 width, short", 372, 560, false],
  ["a tall phone", 412, 1000, false],
] as const;
for (const [name, width, height, all] of MENU_SIZES)
  test(`Plot's Menu entries are all ${all ? "on screen" : "reachable"} at ${name} (${width}×${height})`, async ({ browser }) => {
    if (!c46) throw new Error("c46 is not in core.yaml");
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try {
      await start(page);
      await replay(page, c46.keys.slice(0, c46.keys.indexOf("@menu") + 1));
      const rows = page.locator('[data-testid="menu"] .row[data-id]');
      await expect(rows.first()).toBeVisible();
      const ids = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset["id"] ?? ""));
      expect(ids.slice(0, 2), "the Menu's first rows").toEqual(["root", "extremum"]);
      const cue = page.getByTestId("sheet-count");
      if (all) await expect(cue, `no scroll cue at ${width}×${height}`).toHaveCount(0);
      else await expect(cue, `the list scrolls, so the cue shows at ${width}×${height}`).toBeVisible();
      for (const id of ids) {
        const sel = `[data-testid="menu"] .row[data-id="${id}"]`;
        if (!all && (await seen(page, sel)) !== "") {
          await expect(cue, `${id} is cut, so the cue shows`).toBeVisible();
          await page.locator(sel).evaluate((e) => e.scrollIntoView({ block: "nearest" }));
        }
        // R770: at 372×560 the sheet is the 88 px above the keys, its list 48 px: a row with a reason line (58 px) cannot be whole
        // there, so such a row is reached when it fills the list's box (the row is the picked one; its text is in sight)
        const [row, list] = await Promise.all([page.locator(sel).boundingBox(), page.locator('[data-testid="menu"] .list').boundingBox()]);
        if (!all && row && list && row.height > list.height) {
          expect(row.y, `${id} fills the list at ${width}×${height}`).toBeLessThanOrEqual(list.y + 0.5);
          expect(row.y + row.height, `${id} fills the list at ${width}×${height}`).toBeGreaterThanOrEqual(list.y + list.height - 0.5);
          continue;
        }
        await expect.poll(() => seen(page, sel), { message: `Menu row ${id} at ${width}×${height}`, timeout: 2000 }).toBe("");
      }
    } finally {
      await ctx.close();
    }
  });

// R262, R785: after a Root, Plot's Menu has its ninth row (To Home, off until then) and Mode as the tenth. R722: under 1000 px tall (the
// Fairphone's sizes and the Pixel 7's) the 43 px rows leave 290 px, the ten rows need 420: the list scrolls with its cue and
// every row is reached. At 412 × 1000 the list has 428 px and the ten 42 px rows (no reason line: the answer is there, nothing
// is off) need 420: all ten are on screen, no cue.
const ANSWER_SIZES = [
  ["Fairphone 6", 372, 828, false],
  ["Fairphone 6 WebView", 372, 767, false],
  ["Pixel 7", 412, 915, false],
  ["a tall phone", 412, 1000, true],
] as const;
for (const [name, width, height, all] of ANSWER_SIZES)
  test(`Plot's Menu after a Root shows its ten rows, Mode last (To Home the ninth), ${all ? "on screen" : "each reached"} at ${name} (${width}×${height})`, async ({ browser }) => {
    if (!c46) throw new Error("c46 is not in core.yaml");
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try {
      await start(page);
      await replay(page, c46.keys);
      await expect(page.locator('[data-testid="readout-x"]')).toHaveText("1.41421356237");
      await replay(page, ["@menu"]);
      const rows = page.locator('[data-testid="menu"] .row[data-id]');
      await expect(rows).toHaveCount(10);
      const ids = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset["id"] ?? ""));
      expect(ids.slice(-2)).toEqual(["tohome", "mode"]);
      const cue = page.getByTestId("sheet-count");
      if (all) await expect(cue, `no scroll cue at ${width}×${height}`).toHaveCount(0);
      else await expect(cue, `the list scrolls, so the cue shows at ${width}×${height}`).toBeVisible();
      for (const id of ids) {
        const sel = `[data-testid="menu"] .row[data-id="${id}"]`;
        if (!all && (await seen(page, sel)) !== "") {
          await expect(cue, `${id} is cut, so the cue shows`).toBeVisible();
          await page.locator(sel).evaluate((e) => e.scrollIntoView({ block: "nearest" }));
        }
        await expect.poll(() => seen(page, sel), { message: `Menu row ${id} at ${width}×${height}`, timeout: 2000 }).toBe("");
      }
    } finally {
      await ctx.close();
    }
  });
