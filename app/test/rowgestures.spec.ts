// SPDX-License-Identifier: GPL-3.0-or-later
// R276 (owner, 2026-11-10): a history row by touch. A hold (500 ms) on its input or result copies that part and opens
// no menu; a swipe left or right (40 % of the width, or a fling) deletes it through R98's path (the Undo note row);
// the history's vertical scroll wins; a long input scrolls sideways first; a running row does not slide. The picked
// row's bar keeps Store ▶ and Copy as ›. Values are derived (2+3 = 5).
import { expect, test, type Page } from "@playwright/test";
import { finger, STILL_MS } from "./core-lib.ts";
import { entryValue, open, setClipboard, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });

useClipboardLock(); // first hook: the lock is held before the page opens (copy.spec, rows.spec, the core list)

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const rows = (page: Page) => page.locator("article.item[data-status]");
const results = (page: Page) => rows(page).locator(".result");
const menu = (page: Page) => page.getByTestId("menu");
const bar = (page: Page) => page.getByTestId("row-actions");

async function ready(page: Page, query = ""): Promise<void> {
  await open(page, query);
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
}
/** Each line, entered and finished. */
async function enter(page: Page, ...lines: string[][]): Promise<void> {
  for (const keys of lines) await tap(page, [...keys, "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(lines.length);
}
/** A swipe across `share` of the last row's width, slowly and lifted at rest (no fling); two steps is a fling. */
async function swipe(page: Page, share: number, steps = 12): Promise<void> {
  const width = (await rows(page).last().boundingBox())?.width ?? 0;
  await finger(page, "row:last", { dx: share * width, steps, ...(steps > 2 && { still: STILL_MS }) });
}

test("a hold on a result copies its full value and says so; no menu opens, the row is not picked", async ({ page }) => {
  await ready(page);
  await enter(page, ["d2", "add", "d3"], ["d1", "div", "d3"]);
  await setClipboard(page, "before");
  await finger(page, "result:last", { ms: 700 });
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await expect.poll(() => clipboard(page)).toBe("0.3333333333333333333333333333333333333333"); // Copy: every confirmed digit to P (docs/04 2.6)
  await page.waitForTimeout(300);
  await expect(menu(page)).toHaveCount(0); // the nine-item menu on a hold is gone
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0); // the click after the lift was swallowed
  await expect(bar(page)).toHaveCount(0);
});

test("a hold on an input copies the entry text", async ({ page }) => {
  await ready(page);
  await enter(page, ["d2", "add", "d3"]);
  await setClipboard(page, "before");
  await finger(page, "input:last", { ms: 700 });
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await expect.poll(() => clipboard(page)).toBe("2+3");
  await expect(menu(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe(""); // not recalled either
});

test("before the gestures' chunk is in a hold is a tap; the row is marked once it is, and the hold then copies", async ({ page }) => {
  // R196 fix round 2: the chunk held back 3 s, as a loaded host does (the e2e hold on an input lost that race once)
  await page.route(/rowGesturesCode/, async (r) => {
    await new Promise((done) => setTimeout(done, 3000));
    await r.continue();
  });
  await ready(page);
  await enter(page, ["d2", "add", "d3"]);
  await setClipboard(page, "before");
  const input = "article.item[data-status] .in"; // a CSS name: finger does not wait for the chunk
  await finger(page, input, { ms: 700 });
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1); // the tap's pick (rowGestures.ts)
  await expect(page.getByTestId("notice")).toHaveCount(0);
  await expect(page.locator(input)).toHaveAttribute("data-gestures", "", { timeout: 15_000 });
  await finger(page, "input:last", { ms: 700 });
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await expect.poll(() => clipboard(page)).toBe("2+3");
});

test("a short hold or a tap is still a tap: the first picks, the second inserts", async ({ page }) => {
  await ready(page);
  await enter(page, ["d2", "add", "d3"]);
  await finger(page, "result:last", { ms: 200 });
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await results(page).last().tap();
  await expect.poll(() => entryValue(page)).not.toBe("");
});

test("a swipe right deletes the row through R98: the Undo note, and Undo brings it back", async ({ page }) => {
  await ready(page);
  await enter(page, ["d2"], ["d3"]);
  await swipe(page, 0.6);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByTestId("undo-note")).toHaveText(/Row deleted/);
  await page.waitForTimeout(250); // (Chrome takes a touch right after a drag as the stop of its fling)
  await tap(page, ["undo"]);
  await expect(rows(page)).toHaveCount(2);
  await expect(results(page).last()).toHaveAttribute("data-text", "3");
});

test("a short slow swipe springs back; a short fling deletes", async ({ page }) => {
  await ready(page);
  await enter(page, ["d2"], ["d3"]);
  await swipe(page, -0.25, 12);
  await page.waitForTimeout(400);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).last()).not.toHaveAttribute("style", /translate/);
  await swipe(page, -0.25, 2); // the same way in two quick moves: a fling
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByTestId("undo-note")).toBeVisible();
});

test("a diagonal drag that goes more down than across scrolls the history and never deletes", async ({ page }) => {
  await ready(page);
  const lines = Array.from({ length: 8 }, (_, i) => [`d${i + 1}`]);
  await enter(page, ...lines);
  const n = await rows(page).count();
  const history = page.getByRole("region", { name: /history/i }).or(page.locator("section.history")).first();
  await history.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const before = await history.evaluate((el) => el.scrollTop);
  const width = (await rows(page).last().boundingBox())?.width ?? 0;
  await finger(page, "row:last", { dx: -0.6 * width, dy: 0.6 * width + 40, steps: 12 }); // down and left: 60 % across
  await page.waitForTimeout(400);
  await expect(rows(page)).toHaveCount(n);
  await expect(page.getByTestId("undo-note")).toHaveCount(0);
  expect(await history.evaluate((el) => el.scrollTop)).toBeLessThan(before); // the history scrolled instead
});

test("a long input scrolls sideways first; the row slides only from the end of that scroll", async ({ page }) => {
  await ready(page);
  const long = Array.from({ length: 30 }, () => ["d1", "add"]).flat();
  await enter(page, [...long, "d1"]);
  const input = rows(page).last().locator(".in");
  const max = await input.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(max).toBeGreaterThan(100); // (the input is wider than the row)
  await input.evaluate((el) => (el.scrollLeft = 0));
  const width = (await rows(page).last().boundingBox())?.width ?? 0;
  // a drag left on the input shorter than its scroll: the input scrolls, the row stays
  await finger(page, "input:last", { dx: -Math.min(max - 10, 0.6 * width), steps: 12 });
  await page.waitForTimeout(400);
  await expect(rows(page)).toHaveCount(1);
  expect(await input.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);
  // at the end of the scroll, the next drag left slides the row out
  await input.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  await finger(page, "input:last", { dx: -0.6 * width, steps: 12 });
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByTestId("undo-note")).toBeVisible();
});

test("a running row does not slide", async ({ page }) => {
  await ready(page, "engine=fake&delay=3000");
  await tap(page, ["d2", "enter"]);
  await expect(rows(page).last()).toHaveAttribute("data-status", "pending");
  const width = (await rows(page).last().boundingBox())?.width ?? 0;
  await finger(page, "row:last", { dx: -0.6 * width, steps: 12 });
  await page.waitForTimeout(300);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByTestId("undo-note")).toHaveCount(0);
});

test("the picked row's bar holds Store ▶ and Copy as ›; Copy as opens its three for that row", async ({ page }) => {
  await ready(page);
  await enter(page, ["d1", "div", "d3"], ["d2", "add", "d3"]);
  await setClipboard(page, "before");
  await results(page).first().tap();
  await expect(bar(page).getByRole("button")).toHaveText(["Store ▶", "Copy as ›"]);
  await bar(page).getByRole("button", { name: "Copy as ›" }).tap();
  await expect(menu(page).getByRole("menuitem")).toHaveText([/As shown/, /Exact/, /LaTeX/]);
  await menu(page).locator('[data-id="exact"]').tap();
  await expect.poll(() => clipboard(page)).toBe("1/3"); // the picked row's, not the last one's
  await expect(bar(page)).toHaveCount(0); // the pick ended with the button
  // ☰ keeps its nine (Delete for TalkBack, which cannot swipe)
  await page.getByTestId("menu-button").tap();
  await expect(menu(page).locator(".row[data-id]")).toHaveCount(9);
  await expect(menu(page).locator('.row[data-id="delete"]')).toBeVisible();
});
