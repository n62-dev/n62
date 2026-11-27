// SPDX-License-Identifier: GPL-3.0-or-later
// R895 (owner-style hunt 2026-11-23, h2 #6): Paste in the unit view says why it cannot. The view holds units, not a number the
// line takes, so Shift + Deselect (the Paste key) and a system paste (Ctrl+V, the paste event) give the notice "Paste: leave
// the unit view to change the number" and the view stays as it was. Controls: Copy (Shift + Select, R797) in the view still
// copies (its own tests, unitcopy.spec.ts), and a dead Copy gives no paste notice.
import { expect, test, type Page } from "@playwright/test";
import { flick, KEYPASTE, open, setClipboard, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const WORDS = "Paste: leave the unit view to change the number";
const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const panelText = (page: Page): Promise<string> => page.evaluate(() => window.n62.unitView?.element.textContent ?? "");

test.beforeEach(async ({ page }) => {
  await open(page, "engine=fake");
  await setClipboard(page, "5");
  await tap(page, ["d7", "d2"]);
  await flick(page, "tmpl", "up");
  await up(page);
});

test("the Paste key (Shift + Deselect) in the view gives the notice and changes nothing", async ({ page }) => {
  const before = await panelText(page);
  await tap(page, KEYPASTE);
  await expect(page.getByTestId("notice")).toHaveText(WORDS);
  expect(await panelText(page)).toBe(before);
});

test("a system paste (Ctrl+V) in the view gives the same notice and changes nothing", async ({ page }) => {
  const before = await panelText(page);
  await page.keyboard.press("Control+V");
  await expect(page.getByTestId("notice")).toHaveText(WORDS);
  expect(await panelText(page)).toBe(before);
});

test("the paste event itself (a menu's Paste, a long press) gives the notice", async ({ page }) => {
  await page.evaluate(() => {
    const d = new DataTransfer();
    d.setData("text/plain", "5");
    window.n62.unitView?.element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: d, bubbles: true, cancelable: true, composed: true }));
  });
  await expect(page.getByTestId("notice")).toHaveText(WORDS);
});

test("control: Copy (Shift + Select) with no result in the view stays a dead press, with no paste notice", async ({ page }) => {
  await tap(page, ["shift", "select"]);
  await page.waitForTimeout(300);
  await expect(page.getByTestId("notice")).toHaveCount(0);
});
