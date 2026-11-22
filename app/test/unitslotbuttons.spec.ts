// SPDX-License-Identifier: GPL-3.0-or-later
// R853 (owner, 2026-11-22: "two buttons ← and → below, where → Check is"): ← and → left of → Check in the unit view's last
// row step one whole slot, as a tap on that slot would (R801); dim and dead at the ends; a 44 px hit box each that takes no
// tap from the bar; → Check stays where it was (R790).
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const activeId = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.unitView?.view.activeId);
const focusOnView = (page: Page): Promise<boolean> => page.evaluate(() => document.activeElement === window.n62.unitView?.element);
type Box = { top: number; bottom: number; left: number; right: number };
const box = (page: Page, id: string): Promise<Box> =>
  page.getByTestId(id).evaluate((e) => new Promise<Box>((done) => requestAnimationFrame(() => {
    const r = e.getBoundingClientRect();
    done({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  })));
/** Where a tap reaches the button: the points (1 px steps through its middle, across and down) whose hit target is it. */
const hitBox = (page: Page, id: string): Promise<Box> =>
  page.getByTestId(id).evaluate((b) => {
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const on = (x: number, y: number): boolean => {
      const at = document.elementFromPoint(x, y);
      return at !== null && (at === b || b.contains(at));
    };
    let top = cy, bottom = cy, left = cx, right = cx;
    while (on(cx, top - 1)) top--;
    while (on(cx, bottom + 1)) bottom++;
    while (on(left - 1, cy)) left--;
    while (on(right + 1, cy)) right++;
    return { top, bottom: bottom + 1, left, right: right + 1 };
  });

for (const [w, h] of [[412, 915], [360, 740]] as const) {
  test.describe(`R853: ← and → beside → Check, ${w} × ${h}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, "engine=fake");
      await tap(page, ["d1", "add", "d2"]);
      await flick(page, "tmpl", "up");
      await up(page);
      await tap(page, ["d4", "d6", "right", "d9"]); // k g, ▶ to the second slot, m
      expect(await activeId(page)).toBe("u2");
    });

    test("← makes the first slot active, → the second; at the first ← is dim and dead", async ({ page }) => {
      const prev = page.getByTestId("unit-prev");
      const next = page.getByTestId("unit-next");
      await expect(prev).toHaveText("←");
      await expect(next).toHaveText("→");
      await expect(prev).toHaveAttribute("aria-label", "Previous unit slot");
      await expect(next).toHaveAttribute("aria-label", "Next unit slot");
      await expect(next).toHaveAttribute("aria-disabled", "true"); // u2 is the last slot (no Check)
      await expect(prev).not.toHaveAttribute("aria-disabled", "true");
      await prev.tap();
      await expect.poll(() => activeId(page)).toBe("u1");
      await expect(page.getByTestId("unit-reading")).toHaveText("kilogram");
      expect(await focusOnView(page)).toBe(true);
      await expect(prev).toHaveAttribute("aria-disabled", "true");
      await expect(next).not.toHaveAttribute("aria-disabled", "true");
      await prev.tap(); // dead at the first slot
      expect(await activeId(page)).toBe("u1");
      await expect(page.getByTestId("unit-reading")).toHaveText("kilogram");
      expect(await page.getByTestId("unit-message").count()).toBe(0);
      await next.tap();
      await expect.poll(() => activeId(page)).toBe("u2");
      await expect(page.getByTestId("unit-reading")).toHaveText(/^met(er|re)$/);
      expect(await focusOnView(page)).toBe(true);
      await page.keyboard.press("s"); // the hardware keys still go to the view
      await expect.poll(() => page.evaluate(() => window.n62.unitView?.view.model("u2")?.slot.tokens.length)).toBe(2);
    });

    test("with k armed in the second slot ← is refused with its message and k stays armed", async ({ page }) => {
      await tap(page, ["d4"]); // k after m: a prefix with nothing after it
      await page.getByTestId("unit-prev").tap();
      await expect(page.getByTestId("unit-message")).toHaveText("A prefix needs a unit after it");
      expect(await activeId(page)).toBe("u2");
      expect(await focusOnView(page)).toBe(true);
    });

    test("each hit box is 44 × 44 px or more and lies above the bar; → Check does not move for the buttons", async ({ page }) => {
      const bar = await box(page, "bar");
      for (const id of ["unit-prev", "unit-next"]) {
        const hit = await hitBox(page, id);
        expect.soft(hit.bottom - hit.top, `${id}'s hit height`).toBeGreaterThanOrEqual(44);
        expect.soft(hit.right - hit.left, `${id}'s hit width`).toBeGreaterThanOrEqual(44);
        expect.soft(hit.bottom, `${id}'s hit box above the bar's top (${bar.top})`).toBeLessThanOrEqual(bar.top);
      }
      const prev = await hitBox(page, "unit-prev");
      const next = await hitBox(page, "unit-next");
      expect.soft(prev.right, "← and →'s hit boxes do not overlap").toBeLessThanOrEqual(next.left);
      const check = await box(page, "unit-check");
      expect.soft(next.right, "→'s hit box left of → Check").toBeLessThanOrEqual(check.left);
      // R790: → Check's top with the buttons is its top without them
      await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-testid="unit-prev"], [data-testid="unit-next"]').forEach((b) => (b.style.display = "none")));
      const without = await box(page, "unit-check");
      expect.soft(check.top, "→ Check's top with the buttons and without them").toBe(without.top);
      const reading = await box(page, "unit-reading");
      expect.soft(reading.right, "the reading lies left of ←").toBeLessThanOrEqual(check.left);
    });
  });
}
