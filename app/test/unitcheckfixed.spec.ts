// SPDX-License-Identifier: GPL-3.0-or-later
// R790 (the owner's U1, 2026-11-20): the unit view's → Check / ✕ Check stays put. The panel sits on the keypad and grows
// upward; with the button above the reading it moved up by a line for a message, a reading wrapped to two lines or a result
// (58 px at 412 × 915), which breaks docs/03 rule 8 (nothing jumps while typing). It is the panel's last row, directly above
// the keys: its top is the same (±0.5 px) whatever the reading, the message or the result holds, Check on or off. The real
// engine (a result and a refusal of an incompatible unit).
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const check = (page: Page) => page.getByTestId("unit-check");
const reading = (page: Page) => page.getByTestId("unit-reading");
/** The button's top once it has stopped moving (two equal reads a frame apart). */
const top = async (page: Page): Promise<number> => {
  let was = Number.NaN;
  for (let n = 0; n < 20; n++) {
    const y = await check(page).evaluate((b) => new Promise<number>((done) => requestAnimationFrame(() => done(b.getBoundingClientRect().top))));
    if (y === was) return y;
    was = y;
  }
  return was;
};

for (const size of [
  { width: 412, height: 915 },
  { width: 360, height: 740 },
]) {
  test(`→ Check keeps its place at ${size.width} × ${size.height}: empty, a unit, Check on, a message, a result, a reading on two lines`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(size);
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    await tap(page, ["d5"]);
    await flick(page, "tmpl", "up");
    await up(page);
    await expect(check(page)).toHaveText("→ Check");
    const at: Record<string, number> = { empty: await top(page) };

    await tap(page, ["d4", "d9"]); // 5 km
    await expect(reading(page)).toHaveText("kilometer");
    at["one unit"] = await top(page);

    await check(page).tap(); // the end slot, active and empty
    await expect(check(page)).toHaveText("✕ Check");
    at["Check on"] = await top(page);

    await tap(page, ["d3"]); // → s: incompatible
    await flick(page, "enter", "up");
    await expect(page.getByTestId("unit-message")).toBeVisible();
    at["a message"] = await top(page);

    await tap(page, ["bksp", "bksp"]); // s out, then the empty end slot off
    await expect(check(page)).toHaveText("→ Check");
    await flick(page, "enter", "up");
    await expect(page.getByTestId("unit-result")).toBeVisible();
    await expect(page.getByTestId("unit-alts")).toHaveAttribute("data-fit", /^\d+$/);
    at["a result"] = await top(page);

    // a reading on two lines: km² kg kA per ks h, in the first slot
    await tap(page, ["sq", "mul", "d4", "d6", "mul", "d4", "sin", "div", "d4", "d3", "div"]);
    await flick(page, "d3", "up");
    const lines = await reading(page).evaluate((r) => {
      const range = document.createRange();
      range.selectNodeContents(r);
      return new Set([...range.getClientRects()].map((b) => Math.round(b.top))).size;
    });
    expect(lines, `the reading "${await reading(page).textContent()}" is on two lines`).toBeGreaterThanOrEqual(2);
    at["a reading on two lines"] = await top(page);

    const base = at["empty"] ?? Number.NaN;
    const moved = Object.entries(at).filter(([, y]) => !(Math.abs(y - base) <= 0.5)).map(([state, y]) => `${state}: ${(y - base).toFixed(1)} px`);
    expect(moved, `→ Check's top, ${base.toFixed(1)} on an empty line`).toEqual([]);
  });
}
