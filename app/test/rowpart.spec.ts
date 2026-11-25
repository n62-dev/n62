// SPDX-License-Identifier: GPL-3.0-or-later
// R832 (owner, 2026-11-20; takes in R741): a tap on a history row's input lights the input, on its result the result, anywhere
// else the whole row (`data-part` "input", "result", "row" on the picked article). What is lit decides: Copy, Store ▶ and Enter
// take the result when the result or the row is lit, the input's text when the input is. A second tap on the lit part does its
// job (the input recalls, the result inserts; R858: text on the line takes the input at the caret, as Enter), on the other part
// moves the light; on a whole-picked row it recalls or inserts,
// elsewhere it drops the pick. A hold on the gap picks and copies nothing; a swipe or a drag never picks. Values are derived
// (1/3 = 0.333…, 2+3 = 5). Real engine (1/3 to 40 digits); the two phone widths of the app.
import { expect, test, type Page } from "@playwright/test";
import { finger, STILL_MS } from "./core-lib.ts";
import { entryValue, KEYCOPY, open, setClipboard, tap, useClipboardLock } from "./helpers.ts";
import type * as Finder from "../src/find/finder.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

useClipboardLock(); // first hook: Shift + Select and a hold write the clipboard

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const rows = (page: Page) => page.locator("article.item[data-status]");
const picked = (page: Page) => page.locator('[data-selected="true"]');
const part = (page: Page) => picked(page).getAttribute("data-part");
const bar = (page: Page) => page.getByTestId("row-actions");
const notice = (page: Page) => page.getByTestId("notice");
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const inputOf = (page: Page) => rows(page).last().locator(".in");
const resultOf = (page: Page) => rows(page).last().locator(".result");
const THIRD = "0.3333333333333333333333333333333333333333";

async function ready(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: width === 412 ? 815 : 740 });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
}
/** Each line entered and finished before the next (Enter is ignored while a row runs). */
async function enter(page: Page, ...lines: string[][]): Promise<void> {
  const before = await page.locator('[data-status="done"]').count();
  for (const [k, keys] of lines.entries()) {
    await tap(page, [...keys, "enter"]);
    await done(page, before + k + 1);
  }
}
/** A point on the last row that is neither its input nor its result: right of the input, on the row itself. */
async function gap(page: Page): Promise<{ x: number; y: number }> {
  const row = await rows(page).last().boundingBox();
  const inp = await inputOf(page).boundingBox();
  if (!row || !inp) throw new Error("no row");
  const at = { x: row.x + row.width - 8, y: inp.y + inp.height / 2 };
  const onRow = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.matches("article.item") === true, at);
  expect(onRow, "the point is on the row itself").toBe(true);
  return at;
}
const tapGap = async (page: Page): Promise<void> => {
  const at = await gap(page);
  await page.touchscreen.tap(at.x, at.y);
};
/** A finger held `ms` on a point, then lifted. */
async function holdAt(page: Page, at: { x: number; y: number }, ms: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const pt = [{ x: Math.round(at.x), y: Math.round(at.y), id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
  await page.waitForTimeout(ms);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}
const counts = (page: Page) => page.evaluate(async () => ({ ...(await window.n62.session.uses()).state.counts }));
/** Fold the keypad by the entry line's swipe (R283). */
async function fold(page: Page): Promise<void> {
  await finger(page, '[data-testid="entry"]', { dy: 40, steps: 4 });
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
}

for (const width of [412, 360]) {
  test.describe(`at ${width} px`, () => {
    test.beforeEach(async ({ page }) => ready(page, width));

    test("1/3: a tap on the input lights only the input, Shift + Select copies its text and says so", async ({ page }) => {
      await enter(page, ["d1", "div", "d3"]);
      await setClipboard(page, "before");
      await inputOf(page).tap();
      await expect(picked(page)).toHaveCount(1);
      expect(await part(page)).toBe("input");
      await expect(inputOf(page)).toHaveCSS("outline-style", "solid"); // the lit half: a 2 px --focus outline on its box
      await expect(resultOf(page)).toHaveCSS("outline-style", "none");
      await tap(page, KEYCOPY);
      await expect.poll(() => clipboard(page)).toBe("1/3");
      await expect(notice(page)).toHaveText("Copied: 1/3");
    });

    test("1/3: a tap on the result lights the result; Shift + Select copies 40 digits and names them", async ({ page }) => {
      await enter(page, ["d1", "div", "d3"]);
      await setClipboard(page, "before");
      await resultOf(page).tap();
      expect(await part(page)).toBe("result");
      await tap(page, KEYCOPY);
      await expect.poll(() => clipboard(page)).toBe(THIRD);
      await expect(notice(page)).toHaveText("Copied 40 digits: 0.333 333 333 333…");
      await expect(notice(page)).toHaveCSS("white-space", "nowrap"); // one line
    });

    test("a hold copies the half under the finger and the notice says what", async ({ page }) => {
      await enter(page, ["d1", "div", "d3"]);
      await finger(page, "result:last", { ms: 700 });
      await expect(notice(page)).toHaveText("Copied 40 digits: 0.333 333 333 333…");
      await expect.poll(() => clipboard(page)).toBe(THIRD);
      await finger(page, "input:last", { ms: 700 });
      await expect(notice(page)).toHaveText("Copied: 1/3");
      await expect(picked(page)).toHaveCount(0);
    });

    test("a tap right of the input picks the row; the bar shows Store ▶ and Copy ›; then the result inserts, or the input recalls", async ({ page }) => {
      await enter(page, ["d2", "add", "d3"]);
      await tapGap(page);
      expect(await part(page)).toBe("row");
      await expect(bar(page).getByRole("button", { name: "Store ▶" })).toBeVisible();
      await expect(bar(page).getByRole("button", { name: "Copy ›" })).toBeVisible();
      await resultOf(page).tap(); // whole-picked: the result inserts
      await expect.poll(() => entryValue(page)).not.toBe("");
      await expect(picked(page)).toHaveCount(0);
      await page.evaluate(() => window.n62.entry.clear());
      await tapGap(page);
      await inputOf(page).tap(); // whole-picked: the input recalls
      await expect.poll(() => entryValue(page)).toBe("2+3");
      await expect(picked(page)).toHaveCount(0);
      await page.evaluate(() => window.n62.entry.clear());
      await tapGap(page); // whole-picked: a tap elsewhere on the row drops the pick
      await tapGap(page);
      await expect(picked(page)).toHaveCount(0);
      expect(await entryValue(page)).toBe("");
    });

    test("input lit: a tap on the result lights it, a second inserts; the bar offers Copy, not Copy ›", async ({ page }) => {
      await enter(page, ["d2", "add", "d3"]);
      await inputOf(page).tap();
      await expect(bar(page).getByRole("button", { name: /^Copy$/ })).toBeVisible();
      await expect(bar(page).getByRole("button", { name: "Copy ›" })).toHaveCount(0);
      await resultOf(page).tap();
      expect(await part(page)).toBe("result");
      await expect(bar(page).getByRole("button", { name: "Copy ›" })).toBeVisible();
      expect(await entryValue(page)).toBe("");
      await resultOf(page).tap();
      await expect.poll(() => entryValue(page)).not.toBe("");
      await expect(picked(page)).toHaveCount(0);
    });

    test("input lit: a second tap on it recalls the row's input", async ({ page }) => {
      await enter(page, ["d2", "add", "d3"]);
      await inputOf(page).tap();
      expect(await part(page)).toBe("input");
      await inputOf(page).tap();
      await expect.poll(() => entryValue(page)).toBe("2+3");
      await expect(picked(page)).toHaveCount(0);
    });

    test("R858: with text on the line the second tap on a lit input puts it at the caret, as Enter does; the pick drops", async ({ page }) => {
      await enter(page, ["d5"]);
      await inputOf(page).tap();
      await inputOf(page).tap(); // an empty line: the recall
      await expect.poll(() => entryValue(page)).toBe("5");
      await inputOf(page).tap();
      expect(await part(page)).toBe("input");
      await inputOf(page).tap(); // text on the line: at the caret (it used to keep `5` and drop the pick)
      await expect.poll(() => entryValue(page)).toBe("55");
      await expect(picked(page)).toHaveCount(0);
    });

    test("R858: `7` on the line, the caret after it: two taps on the input of row 5 give 75", async ({ page }) => {
      await enter(page, ["d5"]);
      await tap(page, ["d7"]);
      await inputOf(page).tap();
      await inputOf(page).tap();
      await expect.poll(() => entryValue(page)).toBe("75");
    });

    test("R858: a whole-picked row with text on the line: a tap on its input puts it at the caret", async ({ page }) => {
      await enter(page, ["d5"]);
      await tap(page, ["d7"]); // (▲ picks the whole row from an empty line only; with text on the line the gap's tap does)
      await tapGap(page);
      expect(await part(page)).toBe("row");
      await inputOf(page).tap();
      await expect.poll(() => entryValue(page)).toBe("75");
      await expect(picked(page)).toHaveCount(0);
    });

    test("R858: folded, text on the line: the second tap on the input puts it at the caret and the keys come back", async ({ page }) => {
      await enter(page, ["d5"]);
      await tap(page, ["d7"]);
      await fold(page);
      await inputOf(page).tap();
      await inputOf(page).tap();
      await expect.poll(() => entryValue(page)).toBe("75");
      await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");
    });

    test("input lit: Store ▶ puts the input and ▶ on the line and opens Store in; the bar's Copy copies the input", async ({ page }) => {
      await enter(page, ["d2", "add", "d3"]);
      await setClipboard(page, "before");
      await inputOf(page).tap();
      await bar(page).getByRole("button", { name: /^Copy$/ }).tap();
      await expect.poll(() => clipboard(page)).toBe("2+3");
      await expect(notice(page)).toHaveText("Copied: 2+3");
      await inputOf(page).tap();
      await bar(page).getByRole("button", { name: "Store ▶" }).tap();
      await expect(page.getByTestId("store")).toBeVisible();
      await expect(page.getByTestId("store").getByTestId("sheet-title")).toHaveText("Store 2+3 in");
      const line = await entryValue(page);
      expect(line).toContain("2+3");
      expect(line).toContain("blacktriangleright");
    });

    test("input lit: Enter on an empty line recalls it; result lit: Store ▶ stores the result", async ({ page }) => {
      await enter(page, ["d2", "add", "d3"]);
      await inputOf(page).tap();
      await tap(page, ["enter"]);
      await expect.poll(() => entryValue(page)).toBe("2+3");
      await page.evaluate(() => window.n62.entry.clear());
      await resultOf(page).tap();
      await bar(page).getByRole("button", { name: "Store ▶" }).tap();
      await expect(page.getByTestId("store").getByTestId("sheet-title")).toHaveText("Store = 5 in");
    });

    test("input lit, a line with text, the input carries a result chip: Enter takes the chip in with its own value (R832)", async ({ page }) => {
      await enter(page, ["d1", "div", "d3"]);
      await resultOf(page).tap();
      await resultOf(page).tap(); // 1/3 as a chip on the line (the first tap picks, the second inserts)
      await expect.poll(() => entryValue(page)).toContain("\\res");
      await tap(page, ["mul", "d3", "enter"]);
      await done(page, 2);
      await enter(page, ["d2", "div", "d7"]);
      await page.waitForTimeout(900); // the writes are debounced and asynchronous
      await page.reload(); // the chip numbers start again: the next chip taken is the key the second row's input already names
      await page.waitForFunction(() => window.n62 !== undefined);
      await page.evaluate(() => window.n62.entry.ready);
      await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
      await done(page, 3);
      await tap(page, ["d1", "add"]);
      await resultOf(page).tap();
      await resultOf(page).tap(); // 2/7 as a chip: the line is `1+` and it
      await expect.poll(() => entryValue(page)).toContain("\\res");
      await rows(page).nth(1).locator(".in").tap();
      expect(await part(page)).toBe("input");
      await tap(page, ["enter"]);
      await expect.poll(async () => ((await entryValue(page)).match(/\\res\{/g) ?? []).length).toBe(2); // (the input goes in through the clipboard chunk: not at once)
      const line = await entryValue(page);
      const chips = await page.evaluate(() => window.n62.entry.chips);
      const keys = [...line.matchAll(/\\res\{(\d+)\}\{([^}]*)\}/g)].map((m) => [m[1], m[2]]);
      expect(keys.length).toBe(2);
      expect(new Set(keys.map((k) => k[0])).size).toBe(2); // two chips, two keys
      // each chip is worth what it is drawn as: the second row's `0.333…`, the line's own `0.2857…`
      for (const [k, shown] of keys) expect(chips[`res:${k}`]?.value, `res:${k} drawn ${shown}`).toMatch(shown!.startsWith("0.2857") ? /^(0\.2857|2\/7)/ : /^(0\.3333|1\/3)/);
    });

    test("input lit: ☰ 1 deletes the whole row and Undo brings it back; ▲ from an empty line picks the whole row", async ({ page }) => {
      await enter(page, ["d2", "add", "d3"], ["d7"]);
      await tap(page, ["up"]);
      expect(await part(page)).toBe("row");
      await tap(page, ["esc"]);
      await rows(page).last().locator(".in").tap();
      expect(await part(page)).toBe("input");
      await tap(page, ["@menu", "d1"]);
      await done(page, 1);
      await tap(page, ["undo"]);
      await done(page, 2);
    });

    test("folded, the same: the input lights the input, the result the result, the gap the row", async ({ page }) => {
      await enter(page, ["d2", "add", "d3"]);
      await fold(page);
      await inputOf(page).tap();
      expect(await part(page)).toBe("input");
      await resultOf(page).tap();
      expect(await part(page)).toBe("result");
      await tapGap(page);
      expect(await part(page)).toBe("row");
    });

    test("an error's message picks the row", async ({ page }) => {
      await tap(page, ["d1", "emark", "d2", "dot", "d5", "enter"]);
      const error = page.locator('[data-status="error"]');
      await expect(error).toHaveCount(1);
      await error.getByRole("alert").tap();
      expect(await part(page)).toBe("row");
    });

    test("a ⚠ row's reason line picks nothing (it opens its text)", async ({ page }) => {
      const differ = "\\operatorname{int}\\left(\\operatorname{abs}\\left(x-\\sin\\left(10^{50}\\right)\\right),x,-1,1\\right)";
      await page.evaluate((l) => window.n62.session.submit(l), differ);
      await done(page, 1);
      const reason = page.getByTestId("mark-reason");
      await expect(reason).toHaveAttribute("data-open", "false");
      await reason.tap();
      await expect(reason).toHaveAttribute("data-open", "true");
      await expect(picked(page)).toHaveCount(0);
    });

    test("a σ row: the picking tap shows σ, the dropping tap hides it", async ({ page }) => {
      await page.evaluate(async () => {
        const url = "/src/find/finder.ts";
        const f = (await import(/* @vite-ignore */ url)) as typeof Finder;
        const it = (await f.loadIndex(true)).byId.get("const:G");
        if (!it) throw new Error("no constant G");
        f.putOnLine(window.n62.entry, it);
      });
      await tap(page, ["mul", "d5", "dot", "d9", "d7", "d2", "emark", "d2", "d4", "enter"]);
      await done(page, 1);
      const sigma = page.getByTestId("sigma");
      await expect(sigma).toHaveCount(0);
      await page.getByTestId("mark").last().tap();
      await expect(sigma).toHaveCount(1);
      expect(await part(page)).toBe("row");
      await page.getByTestId("mark").last().tap();
      await expect(sigma).toHaveCount(0);
      await expect(picked(page)).toHaveCount(0);
    });

    test("a 700 ms hold on the gap picks and copies nothing", async ({ page }) => {
      await enter(page, ["d2", "add", "d3"]);
      await setClipboard(page, "before");
      await page.waitForFunction(() => document.querySelector("article.item[data-status]")?.hasAttribute("data-gestures"));
      await holdAt(page, await gap(page), 700);
      await page.waitForTimeout(300);
      await expect(picked(page)).toHaveCount(0);
      await expect(notice(page)).toHaveCount(0);
      expect(await clipboard(page)).toBe("before");
    });

    test("a vertical drag scrolls the history and picks nothing", async ({ page }) => {
      for (let i = 1; i <= 14; i++) await page.evaluate((n) => window.n62.session.submit(String(n)), i);
      await done(page, 14);
      const scroller = page.locator("section.history");
      const before = await scroller.evaluate((e) => e.scrollTop);
      await finger(page, "row:last", { dy: 160, steps: 8, still: STILL_MS });
      await expect.poll(() => scroller.evaluate((e) => e.scrollTop)).toBeLessThan(before);
      await expect(picked(page)).toHaveCount(0);
    });

    test("a swipe left that deletes counts swipe.left once; one that springs back counts nothing and picks nothing", async ({ page }) => {
      await enter(page, ["d2"], ["d3"]);
      const w = (await rows(page).last().boundingBox())?.width ?? 0;
      await finger(page, "row:last", { dx: -0.2 * w, steps: 10, still: STILL_MS });
      await page.waitForTimeout(400);
      await expect(rows(page)).toHaveCount(2);
      await expect(picked(page)).toHaveCount(0);
      expect((await counts(page))["swipe.left"]).toBeUndefined();
      await finger(page, "row:last", { dx: -0.6 * w, steps: 10, still: STILL_MS });
      await expect(rows(page)).toHaveCount(1);
      await expect.poll(async () => (await counts(page))["swipe.left"]).toBe(1);
    });
  });
}
