// SPDX-License-Identifier: GPL-3.0-or-later
// R797 (owner, 2026-11-20 U7 and 2026-11-22 point 10; symbols, not words): a hold (500 ms) in the unit view copies. On the
// reading it copies the active slot's unit as slotText writes it (km/h, kg·m/s²), on a slot's box that slot's symbols (the active
// slot stays), on a message its text, on the result the Home row's string as a hold on that row does; an empty or incomplete slot
// is a dead press with no write. The panel takes no text selection (the phone's word selection never starts), and the Copy key
// (Shift + Select) in the view copies what a hold on the result copies. Each test has its own clipboard (A281: `open`).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { flick, open, setClipboard, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const activeId = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.unitView?.view.activeId);
const notice = (page: Page) => page.getByTestId("notice");

/** A key plan step: a key id, or ↑id for a flick up. */
async function plan(page: Page, steps: string): Promise<void> {
  for (const s of steps.split(" ")) {
    if (s.startsWith("↑")) await flick(page, s.slice(1), "up");
    else await tap(page, [s]);
  }
}

/** A mouse held 800 ms at a point. */
async function holdAt(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
}
async function hold(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error("not visible");
  await holdAt(page, box.x + Math.min(box.width / 2, 20), box.y + box.height / 2);
}
/** A finger held 1.2 s on `target` through CDP (the device's path: touch events, no mouse). */
async function touchHold(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error("not visible");
  const at = [{ x: Math.round(box.x + Math.min(box.width / 2, 20)), y: Math.round(box.y + box.height / 2), id: 1, radiusX: 8, radiusY: 8 }];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at });
  await page.waitForTimeout(1200);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}
/** The middle of the prompt box `n` (MathLive draws each slot as a `.ML__prompt` span in the field's shadow root; no fraction
 *  here, so the boxes stand in the slots' order). */
async function slotBox(page: Page, n: number): Promise<{ x: number; y: number }> {
  const boxes = await page.evaluate(() =>
    [...(window.n62.unitView?.field.shadowRoot?.querySelectorAll(".ML__prompt") ?? [])].map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }),
  );
  const box = boxes[n];
  if (!box) throw new Error(`no prompt box ${n}`);
  return box;
}

for (const [w, h] of [[412, 915], [360, 740]] as const) {
  test.describe(`R797: a hold in the unit view copies, ${w} × ${h}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
    });

    test.describe("slots and the reading (no engine)", () => {
      test.beforeEach(async ({ page }) => {
        await open(page, "engine=fake");
        await setClipboard(page, "before");
      });

      test("a hold on the reading copies km/h, says Copied km/h, and the reading still reads kilometer per hour", async ({ page }) => {
        await plan(page, "d7 d2");
        await unitsKey(page);
        await plan(page, "d4 d9 div ↑d3");
        await expect(page.getByTestId("unit-reading")).toHaveText("kilometer per hour");
        await hold(page, page.getByTestId("unit-reading"));
        await expect.poll(() => clipboard(page)).toBe("km/h");
        await expect(notice(page)).toHaveText("Copied: km/h");
        await expect(page.getByTestId("unit-reading")).toHaveText("kilometer per hour");
        expect(await activeId(page)).toBe("u1");
      });

      test("a finger held on the reading copies km/h too (touch, as on the phone)", async ({ page }) => {
        await plan(page, "d7 d2");
        await unitsKey(page);
        await plan(page, "d4 d9 div ↑d3");
        await touchHold(page, page.getByTestId("unit-reading"));
        await expect.poll(() => clipboard(page)).toBe("km/h");
        await expect(notice(page)).toHaveText("Copied: km/h");
      });

      test("a hold on the reading of k g × m ÷ s x² copies kg·m/s²", async ({ page }) => {
        await plan(page, "d7 d2");
        await unitsKey(page);
        await plan(page, "d4 d6 mul d9 div d3 sq");
        await hold(page, page.getByTestId("unit-reading"));
        await expect.poll(() => clipboard(page)).toBe("kg·m/s²");
      });

      test("two slots: a hold on the first slot's box copies kg and the second slot stays active", async ({ page }) => {
        await tap(page, ["d1", "add", "d2"]);
        await unitsKey(page);
        await tap(page, ["d4", "d6", "right", "d9"]); // k g, ▶ to the second slot, m
        expect(await activeId(page)).toBe("u2");
        const b = await slotBox(page, 0);
        await holdAt(page, b.x, b.y);
        await expect.poll(() => clipboard(page)).toBe("kg");
        await expect(notice(page)).toHaveText("Copied: kg");
        await page.waitForTimeout(100);
        expect(await activeId(page)).toBe("u2");
        await hold(page, page.getByTestId("unit-reading"));
        await expect.poll(() => clipboard(page)).toBe("m");
      });

      test("a hold on an empty slot, or on the reading of an empty or incomplete slot, writes nothing and says nothing", async ({ page }) => {
        await tap(page, ["d1", "add", "d2"]);
        await unitsKey(page);
        await tap(page, ["d9"]); // m in u1; u2 empty
        const b = await slotBox(page, 1);
        await holdAt(page, b.x, b.y);
        await page.waitForTimeout(300);
        expect(await clipboard(page)).toBe("before");
        await expect(notice(page)).toHaveCount(0);
        expect(await activeId(page)).toBe("u1");
        await tap(page, ["right", "d4"]); // u2 active, k armed alone
        await hold(page, page.getByTestId("unit-reading"));
        await page.waitForTimeout(300);
        expect(await clipboard(page)).toBe("before");
        await expect(notice(page)).toHaveCount(0);
      });

      test("a hold on a message copies its text", async ({ page }) => {
        await tap(page, ["d1", "add", "d2"]);
        await unitsKey(page);
        await tap(page, ["d4"]);
        const b = await slotBox(page, 1);
        await page.touchscreen.tap(b.x, b.y); // refused: k armed alone
        await expect(page.getByTestId("unit-message")).toHaveText("A prefix needs a unit after it");
        await hold(page, page.getByTestId("unit-message"));
        await expect.poll(() => clipboard(page)).toBe("A prefix needs a unit after it");
      });

      test("the panel takes no text selection and no callout", async ({ page }) => {
        await unitsKey(page);
        const style = await page.getByTestId("unit-view").evaluate((e) => {
          const s = getComputedStyle(e);
          return [s.userSelect, s.getPropertyValue("-webkit-touch-callout")];
        });
        expect(style[0]).toBe("none");
        expect(style[1]).toBe("none");
      });
    });

    test.describe("the result (engine)", () => {
      test.beforeEach(async ({ page }) => {
        await open(page, "");
        await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
        await setClipboard(page, "before");
      });

      /** What a hold on the last Home row's result copies (the row stands under the view: a hold on it copies, R918). */
      async function rowCopy(page: Page): Promise<string> {
        await setClipboard(page, "before");
        await hold(page, page.locator('[data-testid="result"] .result').last());
        await expect.poll(() => clipboard(page)).not.toBe("before");
        return clipboard(page);
      }

      test("after Enter on 72 km/h a hold on the result copies the Home row's string", async ({ page }) => {
        await plan(page, "d7 d2");
        await unitsKey(page);
        await plan(page, "d4 d9 div ↑d3 ↑enter");
        await expect(page.getByTestId("unit-result")).toHaveAttribute("data-unit", "km/h");
        await hold(page, page.getByTestId("unit-result").locator(".value"));
        await expect.poll(() => clipboard(page)).not.toBe("before");
        const held = await clipboard(page);
        expect(held).toContain("72");
        expect(held).toContain("km/h");
        await expect(notice(page)).toContainText("72");
        expect(await rowCopy(page)).toBe(held);
      });

      test("the Copy key (Shift + Select) in the view copies what a hold on the result copies", async ({ page }) => {
        await plan(page, "d7 d2");
        await unitsKey(page);
        await plan(page, "d4 d9 ↑enter");
        await expect(page.getByTestId("unit-result")).toHaveAttribute("data-unit", "km");
        await tap(page, ["shift", "select"]);
        await expect.poll(() => clipboard(page)).toBe("72 km");
        await expect(notice(page)).toHaveText("Copied: 72 km");
        await expect(page.getByTestId("unit-view")).toBeVisible();
        expect(await rowCopy(page)).toBe("72 km");
      });

      test("the Copy key with no result is a dead press", async ({ page }) => {
        await plan(page, "d7 d2");
        await unitsKey(page);
        await plan(page, "d4 d9");
        await tap(page, ["shift", "select"]);
        await page.waitForTimeout(300);
        expect(await clipboard(page)).toBe("before");
        await expect(notice(page)).toHaveCount(0);
      });

      test("a hold on the refusal 1 m + 1 s copies its text", async ({ page }) => {
        await tap(page, ["d1", "add", "d1"]);
        await unitsKey(page);
        await plan(page, "d9 enter d3 ↑enter");
        await expect(page.getByTestId("unit-message")).toHaveText("Units don't match: L vs T");
        await hold(page, page.getByTestId("unit-message"));
        await expect.poll(() => clipboard(page)).toBe("Units don't match: L vs T");
      });
    });
  });
}
