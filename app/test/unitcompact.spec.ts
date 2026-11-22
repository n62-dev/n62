// SPDX-License-Identifier: GPL-3.0-or-later
// R852 (owner, 2026-11-22: "the area below the entry field is too tall"): the unit view keeps no height for what it does not
// show. sandra's probe on phase-1 (Pixel 7 profile): the field's bottom to the bar 65 px in the unit view, 8 px in Home. The
// reading sits beside → Check in the panel's last row (bottoms aligned), the empty `.below` takes no gap, the panel no bottom
// padding and the reading no min-height: the gap is about 36 px, and the field does not move when the first unit is typed.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
type Box = { top: number; bottom: number; left: number; right: number };
/** The test id's box once it has stopped moving (two equal reads a frame apart). */
const box = async (page: Page, id: string): Promise<Box> => {
  let was = "";
  let b: Box = { top: Number.NaN, bottom: Number.NaN, left: Number.NaN, right: Number.NaN };
  for (let n = 0; n < 20; n++) {
    b = await page.getByTestId(id).evaluate((e) => new Promise<Box>((done) => requestAnimationFrame(() => {
      const r = e.getBoundingClientRect();
      done({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
    })));
    const now = JSON.stringify(b);
    if (now === was) return b;
    was = now;
  }
  return b;
};

for (const size of [
  { width: 412, height: 915 },
  { width: 360, height: 740 },
]) {
  test(`the unit view is compact at ${size.width} × ${size.height}: field to bar ≤ 40 px, the reading beside → Check, the field still on the first unit`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(size);
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    await tap(page, ["d5"]);
    await flick(page, "tmpl", "up");
    await up(page);
    await expect(page.getByTestId("unit-check")).toHaveText("→ Check");

    const field = await box(page, "unit-field");
    const bar = await box(page, "bar");
    expect.soft(bar.top - field.bottom, `the field's bottom (${field.bottom.toFixed(1)}) to the bar's top (${bar.top.toFixed(1)}), open`).toBeLessThanOrEqual(40);

    await tap(page, ["d4", "d6"]); // 5 kg
    await expect(page.getByTestId("unit-reading")).toHaveText("kilogram");
    const typed = await box(page, "unit-field");
    expect.soft(typed.top - field.top, "the field's top after the first unit").toBe(0);
    expect.soft((await box(page, "bar")).top - typed.bottom, "the field's bottom to the bar's top, a unit typed").toBeLessThanOrEqual(40);

    const reading = await box(page, "unit-reading");
    const check = await box(page, "unit-check");
    expect.soft(Math.abs(reading.bottom - check.bottom), `the reading's bottom (${reading.bottom.toFixed(1)}) and → Check's (${check.bottom.toFixed(1)})`).toBeLessThanOrEqual(2);
    expect.soft(reading.right, "the reading lies left of → Check").toBeLessThanOrEqual(check.left + 0.5);
  });
}
