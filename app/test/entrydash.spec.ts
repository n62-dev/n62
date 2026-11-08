// SPDX-License-Identifier: GPL-3.0-or-later
// R155: while a job runs (or the engine starts) a short flat dash runs round the entry field's outline. It shows once the
// job has run 150 ms (a quick job never flashes it) and goes with the job. Under reduced motion nothing moves: the dash
// is not drawn and the outline stands in --text.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const DASH = '[data-testid="entry-dash"]';

/** Record, on every DOM change, whether the dash is in the page (with the time of the first and the last sighting). */
async function watchDash(page: Page): Promise<void> {
  await page.evaluate((sel) => {
    const log = { firstAt: -1, lastAt: -1, seen: 0 };
    (window as unknown as { __dash: typeof log }).__dash = log;
    const look = (): void => {
      if (!document.querySelector(sel)) return;
      const now = performance.now();
      if (log.firstAt < 0) log.firstAt = now;
      log.lastAt = now;
      log.seen++;
    };
    new MutationObserver(look).observe(document.body, { childList: true, subtree: true, attributes: true });
    (window as unknown as { __dashLook: () => void }).__dashLook = look;
  }, DASH);
}
const dashLog = (page: Page) => page.evaluate(() => (window as unknown as { __dash: { firstAt: number; lastAt: number; seen: number } }).__dash);

test("a job over a second: the dash shows 150 ms after Enter and is gone with the result", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "engine=fake&delay=1200");
  await watchDash(page);
  await expect(page.locator(DASH)).toHaveCount(0);
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator(DASH)).toBeVisible();
  await expect(page.locator(DASH)).toHaveAttribute("aria-hidden", "true");
  const start = await page.evaluate(() => window.n62.session.items.at(-1)!.startedAt);
  const log = await dashLog(page);
  expect(log.firstAt - start).toBeGreaterThan(120); // not before the job has run 150 ms (a frame of slack)
  // it runs: the rect has an animation, and its dash is on the outline's path
  const anim = await page.locator(`${DASH} rect`).evaluate((r) => ({ n: r.getAnimations().length, len: r.getAttribute("pathLength"), dash: getComputedStyle(r).strokeDasharray }));
  expect(anim.n).toBe(1);
  expect(anim.len).toBe("100");
  expect(anim.dash.replace(/px|\s/g, "")).toBe("14,86");
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(page.locator(DASH)).toHaveCount(0);
});

test("a job under 50 ms never shows the dash", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "engine=fake&delay=30");
  await watchDash(page);
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await page.waitForTimeout(500); // past the 150 ms, in case a timer had been left behind
  expect((await dashLog(page)).seen).toBe(0);
});

test("reduced motion: nothing animates and the outline is --text, still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "engine=fake&delay=1500");
  await tap(page, ["d2", "add", "d3", "enter"]);
  await page.waitForSelector(DASH, { state: "attached" });
  const s = await page.evaluate((sel) => {
    const dash = document.querySelector(sel)!;
    const mf = window.n62.entry.field!;
    const d = document.createElement("div");
    d.style.color = "var(--text)";
    document.body.append(d);
    const text = getComputedStyle(d).color;
    d.remove();
    return { anims: dash.getAnimations({ subtree: true }).length, colour: getComputedStyle(mf).outlineColor, text };
  }, DASH);
  expect(s.anims).toBe(0);
  expect(s.colour).toBe(s.text);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(page.locator(DASH)).toHaveCount(0);
});

test("while the engine starts the dash runs too", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "engine=fake&readydelay=3000");
  expect(await page.evaluate(() => window.n62.session.engineState)).toBe("starting");
  await expect(page.locator(DASH)).toBeVisible();
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 10_000 });
  await expect(page.locator(DASH)).toHaveCount(0);
});

test("R155f1: before MathLive has mounted the dash still has the field's height", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // hold the MathLive chunk back, so the .field box is empty while the engine starts (the cold start on the Tab One)
  await page.route(/mathlive[^/]*\.js(\?|$)/, async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto("/?engine=fake&readydelay=3000&tips=off");
  await page.waitForFunction(() => window.n62 !== undefined);
  expect(await page.evaluate(() => customElements.get("math-field") === undefined)).toBe(true); // MathLive is not in yet
  await expect(page.locator(DASH)).toBeAttached({ timeout: 2000 });
  const box = await page.locator(DASH).evaluate((e) => e.getBoundingClientRect().toJSON());
  expect(box.height).toBeGreaterThan(0);
  expect(box.width).toBeGreaterThan(0);
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 10_000 });
  await expect(page.locator(DASH)).toHaveCount(0);
});
