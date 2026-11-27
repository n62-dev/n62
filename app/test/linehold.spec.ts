// SPDX-License-Identifier: GPL-3.0-or-later
// R903 (owner-style hunt 2026-11-23, h2 #16): a hold on the entry line copies it, as a hold on a history row's input
// does (R276): the line's plain text, or the selection it had, with the "Copied: …" notice. R277's hold still selects
// the term under the finger, and a drag still scrolls the line and copies nothing (linetouch.spec.ts holds the rest).
// Synthetic touches through CDP; the fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, setClipboard, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const ranges = (page: Page) => page.evaluate(() => JSON.stringify(window.n62.entry.field?.selection.ranges));

/** One finger at (x, y): down, `ms` still, then a slide by `dx` in ten steps, then up. */
async function finger(page: Page, x: number, y: number, how: { ms?: number; dx?: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const at = (u: number) => [{ x: Math.round(x + u), y: Math.round(y), id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0) });
  if (how.ms) await page.waitForTimeout(how.ms);
  for (let i = 1; how.dx && i <= 10; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at((how.dx * i) / 10) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** The middle of the drawn atom at offset `o` (after a render: MathLive keeps bounds from one, lineTouch.ts). */
const atomAt = (page: Page, o: number): Promise<{ x: number; y: number }> =>
  page.evaluate(async (k) => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.minFontScale = mf.minFontScale;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = mf.getElementInfo(k)?.bounds;
    if (!b) throw new Error(`no bounds at ${k}`);
    return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
  }, o);

/** A hold (700 ms, still) on the atom at offset `o`. */
async function holdAt(page: Page, o: number): Promise<void> {
  const p = await atomAt(page, o);
  await finger(page, p.x, p.y, { ms: 700 });
}

test.beforeEach(async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.n62.entry.ready);
  await setClipboard(page, "before");
});

test("a hold on the line copies its plain text, with the notice; R277's term is still selected", async ({ page }) => {
  await tap(page, ["d1", "add", "d2"]);
  await page.waitForTimeout(150);
  await holdAt(page, 1);
  await expect(page.getByTestId("notice")).toHaveText("Copied: 1+2");
  await expect.poll(() => clipboard(page)).toBe("1+2");
  expect(await ranges(page)).toBe("[[0,1]]"); // the hold on 1 selected it (R277)
});

test("a hold on empty space or an operator copies the whole line too", async ({ page }) => {
  await tap(page, ["d1", "add", "d2"]);
  await page.waitForTimeout(150);
  await holdAt(page, 2);
  await expect(page.getByTestId("notice")).toHaveText("Copied: 1+2");
  await expect.poll(() => clipboard(page)).toBe("1+2");
});

test("with a selection on the line, the hold copies the selection and keeps it", async ({ page }) => {
  await tap(page, ["d1", "add", "d2", "select"]); // R279: Select takes the term before the caret, the 2
  await expect.poll(() => ranges(page)).toBe("[[2,3]]");
  await holdAt(page, 1);
  await expect(page.getByTestId("notice")).toHaveText("Copied: 2");
  await expect.poll(() => clipboard(page)).toBe("2");
  expect(await ranges(page)).toBe("[[2,3]]"); // the selection the hold copied, not the 1 under the finger
});

test("control: a hold that drags scrolls the line and copies nothing (R277)", async ({ page }) => {
  await page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (!mf) throw new Error("no field");
    mf.value = "1234567890".repeat(6);
    mf.focus();
    mf.executeCommand("moveToMathfieldEnd");
  });
  await page.waitForTimeout(150);
  const box = await page.locator('[data-testid="entry"] math-field').boundingBox();
  if (!box) throw new Error("no field");
  const left = () => page.evaluate(() => window.n62.entry.field?.shadowRoot?.querySelector<HTMLElement>("[part=content]")?.scrollLeft ?? 0);
  const before = await left();
  await finger(page, box.x + box.width / 2, box.y + box.height / 2, { dx: 150 });
  await expect.poll(left).toBeLessThan(before - 100);
  await page.waitForTimeout(700);
  await expect(page.getByTestId("notice")).toHaveCount(0);
  expect(await clipboard(page)).toBe("before");
});
