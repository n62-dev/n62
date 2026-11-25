// SPDX-License-Identifier: GPL-3.0-or-later
// R922 (F372, F373; layers study 2026-11-23): a sheet takes what follows the focus. The focus stays on the line under every
// sheet, so a system paste (Ctrl+V, a paste event), a hardware symbol (`!`), a character MathLive types itself (µ from a
// layout or an IME) and Select all + cut went through the sheet to the line: under Mode, Ctrl+V with 5 gave 7+15; under
// "Store 7 in" the line became 7▶5. docs/05 rule 4: no key goes through a sheet to the line, a hardware keyboard's
// included. Under a sheet each is a dead press (the double pulse), the sheet and the line kept. The controls: the same
// channels with no sheet still reach the line. The fake engine; the clipboard lock (a real Ctrl+V reads the clipboard).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, recordVibrations, setClipboard, tap, useClipboardLock, vibrations } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
useClipboardLock();

const sheetId = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const sh = window.n62.shell.sheet as unknown as { id?: string } | null;
    return sh ? (sh.id ?? "?") : null;
  });
const store = (page: Page) => page.getByTestId("store");
const find = (page: Page) => page.getByTestId("find");

/** A system paste as Shift+Insert or the context menu deliver it: a `paste` event on the field's focused part. */
const pasteEvent = (page: Page, text: string): Promise<void> =>
  page.evaluate((t) => {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    const d = new DataTransfer();
    d.setData("text/plain", t);
    (el ?? document.body).dispatchEvent(new ClipboardEvent("paste", { clipboardData: d, bubbles: true, cancelable: true, composed: true }));
  }, text);

/** The channels that follow the focus, each with what it would put on the line. */
const CHANNELS: readonly [string, (page: Page) => Promise<void>][] = [
  [
    "Ctrl+V",
    async (page) => {
      await setClipboard(page, "5");
      await page.keyboard.press("ControlOrMeta+V");
    },
  ],
  ["a paste event", (page) => pasteEvent(page, "5")],
  ["a hardware !", (page) => page.keyboard.press("!")],
  ["µ (MathLive's own text input)", (page) => page.keyboard.insertText("µ")],
  [
    "Ctrl+A Ctrl+X",
    async (page) => {
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.press("ControlOrMeta+X");
    },
  ],
];

/** Fire `act`; it is a dead press: the double pulse (at least two vibrations), the line and the sheet as they were. */
async function deadUnder(page: Page, act: (page: Page) => Promise<void>, line: string, sheet: string): Promise<void> {
  const v = (await vibrations(page)).length;
  await act(page);
  await page.waitForTimeout(300); // (a paste takes the clipboard code's path: give it the time it would take)
  expect(await entryValue(page)).toBe(line);
  expect(await sheetId(page)).toBe(sheet);
  await expect.poll(async () => (await vibrations(page)).length - v).toBeGreaterThanOrEqual(2);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await recordVibrations(page);
  await open(page);
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["d7", "add", "d1"]);
  expect(await entryValue(page)).toBe("7+1");
});

for (const [name, act] of CHANNELS) {
  test(`under Mode, ${name} is a dead press: the line 7+1, Mode stays`, async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await expect.poll(() => sheetId(page)).toBe("settings"); // Settings › Mode (R927)
    await deadUnder(page, act, "7+1", "settings");
  });
}

test('"Store 7 in", Ctrl+V: a dead press, the title and the line 7▶ kept', async ({ page }) => {
  await tap(page, ["bksp", "bksp", "shift", "emark"]);
  await expect(store(page).getByTestId("sheet-title")).toHaveText("Store 7 in");
  const line = await entryValue(page);
  const sheet = await sheetId(page);
  await deadUnder(page, CHANNELS[0]![1], line, sheet ?? "");
  await expect(store(page).getByTestId("sheet-title")).toHaveText("Store 7 in");
});

test("Find with a query, Ctrl+V: a dead press, the line and the query unchanged", async ({ page }) => {
  await tap(page, ["math", "tmpl"]); // Tmpl types c (find.spec.ts)
  await expect(find(page).getByTestId("sheet-filter")).toHaveText("c");
  const sheet = await sheetId(page);
  await deadUnder(page, CHANNELS[0]![1], "7+1", sheet ?? "");
  await expect(find(page).getByTestId("sheet-filter")).toHaveText("c");
});

test.describe("controls: with no sheet each channel reaches the line", () => {
  const AFTER: readonly string[] = ["7+15", "7+15", "7+1!", "7+1µ", ""];
  CHANNELS.forEach(([name, act], i) => {
    test(`${name} edits the line`, async ({ page }) => {
      await act(page);
      await expect.poll(() => entryValue(page)).toBe(AFTER[i]);
    });
  });
});
