// SPDX-License-Identifier: GPL-3.0-or-later
// R801 (owner, 2026-11-20, walk point B4): a tap on a unit slot makes it the active slot (refused as ◀ ▶ is when the active
// slot cannot be left), and after any tap that opens no sheet the keys stay with the unit view (the focus is on its element).
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const activeId = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.unitView?.view.activeId);
const slot = (page: Page, id: string): Promise<string> =>
  page.evaluate((id) => {
    const s = window.n62.unitView?.view.model(id)?.slot;
    return (s?.tokens ?? []).map((t) => `${t.prefix ? `${t.prefix}:` : ""}${t.unit}`).join(" ");
  }, id);
const focusOnView = (page: Page): Promise<boolean> => page.evaluate(() => document.activeElement === window.n62.unitView?.element);
/** A tap in the slot's box (MathLive draws each prompt as a `.ML__prompt` span in the field's shadow root): in the middle,
 *  or `dx` box widths off the middle (-0.33: left of it, still inside the box). */
async function tapSlot(page: Page, index: number, dx = 0): Promise<void> {
  const box = await page.evaluate((i) => {
    const r = window.n62.unitView?.field.shadowRoot?.querySelectorAll(".ML__prompt")[i]?.getBoundingClientRect();
    return r && { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
  }, index);
  if (!box) throw new Error(`no prompt box ${index}`);
  await page.touchscreen.tap(box.x + dx * box.w, box.y);
}

/** A tap in the middle of the prompt box that is the `n`-th from the top (stacked boxes are drawn bottom to top in the
 *  shadow DOM, so the order of the boxes there says nothing about the slots). */
async function tapFromTop(page: Page, n: number): Promise<void> {
  const boxes = await page.evaluate(() =>
    [...(window.n62.unitView?.field.shadowRoot?.querySelectorAll(".ML__prompt") ?? [])].map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }),
  );
  const box = boxes.sort((a, b) => a.y - b.y)[n];
  if (!box) throw new Error(`no prompt box ${n} from the top`);
  await page.touchscreen.tap(box.x, box.y);
}

for (const [w, h] of [[412, 915], [360, 740]] as const) {
  test.describe(`R801: a tap on a unit slot, ${w} × ${h}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, "engine=fake");
      await tap(page, ["d5", "enter"]); // a Home row to tap later
      await tap(page, ["d1", "add", "d2"]);
      await flick(page, "tmpl", "up");
      await up(page);
    });

    test("a tap on the second slot's box makes it active, and the pad's k, m fill it", async ({ page }) => {
      expect(await activeId(page)).toBe("u1");
      await tap(page, ["d9"]); // m in u1, so that a tap on a filled slot is tested too
      await tapSlot(page, 1);
      await expect.poll(() => activeId(page)).toBe("u2");
      expect(await focusOnView(page)).toBe(true);
      await tap(page, ["d4", "d9"]);
      expect(await slot(page, "u2")).toBe("k:m");
      expect(await slot(page, "u1")).toBe("m");
      // a tap on a filled slot makes it active, in the middle of its box and off the middle of it
      await tapSlot(page, 0);
      await expect.poll(() => activeId(page)).toBe("u1");
      await tapSlot(page, 1, -0.33);
      await expect.poll(() => activeId(page)).toBe("u2");
      await tapSlot(page, 0, 0.33);
      await expect.poll(() => activeId(page)).toBe("u1");
      // a tap on the active one changes nothing
      await tapSlot(page, 0);
      expect(await activeId(page)).toBe("u1");
      expect(await slot(page, "u1")).toBe("m");
      expect(await page.getByTestId("unit-message").count()).toBe(0);
    });

    test("with k armed in the first slot a tap on the second is refused and k stays armed", async ({ page }) => {
      await tap(page, ["d4"]);
      await tapSlot(page, 1);
      await expect(page.getByTestId("unit-message")).toHaveText("A prefix needs a unit after it");
      expect(await activeId(page)).toBe("u1");
      expect(await focusOnView(page)).toBe(true);
      await tap(page, ["d9"]); // m after the armed k
      expect(await slot(page, "u1")).toBe("k:m");
    });

    test("a tap on the reading, then the hardware key m, still types into the slot", async ({ page }) => {
      await tapSlot(page, 0); // (a tap on the field moved the focus onto MathLive's own element)
      await page.getByTestId("unit-reading").click();
      expect(await focusOnView(page)).toBe(true);
      await page.keyboard.press("m");
      expect(await slot(page, "u1")).toBe("m");
    });

    test("a tap on a history row, then the hardware key m, still types into the slot", async ({ page }) => {
      await tapSlot(page, 0);
      await page.locator("section.history .item").first().tap();
      expect(await focusOnView(page)).toBe(true);
      await page.keyboard.press("m");
      expect(await slot(page, "u1")).toBe("m");
    });

    test("a tap on the active slot changes nothing, and a hardware key still types into the slot", async ({ page }) => {
      await tapSlot(page, 0);
      expect(await activeId(page)).toBe("u1");
      expect(await focusOnView(page)).toBe(true);
      await page.keyboard.press("m");
      expect(await slot(page, "u1")).toBe("m");
    });

    // audit, fix round 3: the boxes of a fraction are drawn bottom to top, so the n-th box is not the n-th slot
    test("a fraction: a tap on the numerator's slot makes u1 active, a tap on the denominator's makes u2", async ({ page }) => {
      await tap(page, ["esc"]);
      await page.waitForFunction(() => window.n62.unitView === undefined);
      await page.evaluate(() => window.n62.entry.clear());
      await tap(page, ["d3", "div", "d4"]);
      await flick(page, "tmpl", "up");
      await up(page);
      expect(await page.evaluate(() => window.n62.unitView?.view.ids)).toEqual(["u1", "u2"]);
      expect(await activeId(page)).toBe("u1");
      await tapFromTop(page, 1); // the denominator
      await expect.poll(() => activeId(page)).toBe("u2");
      await tapFromTop(page, 0); // the numerator
      await expect.poll(() => activeId(page)).toBe("u1");
      await tapFromTop(page, 1);
      await expect.poll(() => activeId(page)).toBe("u2");
      await tap(page, ["d4", "d9"]);
      expect(await slot(page, "u2")).toBe("k:m");
      expect(await slot(page, "u1")).toBe("");
      expect(await focusOnView(page)).toBe(true);
    });
  });
}
