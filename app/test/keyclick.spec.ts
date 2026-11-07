// SPDX-License-Identifier: GPL-3.0-or-later
// A66: the optional key click, off by default. One click per touch at finger-down, beside R112's pulse (none for pad
// steps or flicks; a dead key's double pulse has one click); Settings › Key vibration › Key click is a switch that
// survives a relaunch and goes into a preset's Key vibration group and a backup. The web click is one oscillator started.
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, flick, open, recordVibrations, savedText, savePicker, tap, vibrations } from "./helpers.ts";

/** Count the Web Audio clicks: every oscillator started (haptics.ts makes one per click). */
async function recordClicks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: number[] = [];
    (window as unknown as { __clicks: number[] }).__clicks = calls;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, ...a: [number?]) {
      calls.push(performance.now());
      return start.apply(this, a);
    };
  });
}
const clicks = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __clicks: number[] }).__clicks.length);

const row = (page: Page, id: string) => page.getByTestId("menu").locator(`[data-id="${id}"]`);
const MODE_SHEET = "/src/views/modeSheet.ts";
type ModeSheet = typeof import("../src/views/modeSheet.ts");

test.describe("the click at finger-down", () => {
  test.beforeEach(async ({ page }) => {
    await recordVibrations(page);
    await recordClicks(page);
    await open(page);
  });
  const since = async (page: Page, run: () => Promise<void>): Promise<{ clicks: number; pulses: number }> => {
    const [c, p] = [await clicks(page), (await vibrations(page)).length];
    await run();
    await page.waitForTimeout(300); // a dead key's second pulse comes ~80 ms after the first
    return { clicks: (await clicks(page)) - c, pulses: (await vibrations(page)).length - p };
  };

  test("off (the default): nothing clicks, whatever the vibration does", async ({ page }) => {
    expect(await page.evaluate(() => window.n62.session.settings.haptics.click)).toBe(false);
    expect((await since(page, () => tap(page, ["d7"]))).clicks).toBe(0);
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
    expect(await since(page, () => tap(page, ["d7"]))).toEqual({ clicks: 0, pulses: 1 });
  });

  test("on: a tap is one click, with the pulse when that is on too, and without it when it is off", async ({ page }) => {
    await page.evaluate(() => window.n62.session.setHaptics({ click: true }));
    expect(await since(page, () => tap(page, ["d7"]))).toEqual({ clicks: 1, pulses: 0 });
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
    expect(await since(page, () => tap(page, ["d8"]))).toEqual({ clicks: 1, pulses: 1 });
  });

  test("on: a flick and a pad drag are one click each, and still fire; a dead key is one click", async ({ page }) => {
    await page.evaluate(() => window.n62.session.setHaptics({ click: true }));
    await tap(page, ["d1", "d2", "d3", "d4", "d5", "d6"]);
    expect((await since(page, () => drag(page, "left", -64, 0))).clicks).toBe(1); // five steps
    expect((await since(page, () => flick(page, "dot", "up"))).clicks).toBe(1);
    expect(await entryValue(page)).toContain("=");
    await tap(page, ["@symb"]);
    await page.waitForFunction(() => window.n62.shell.app !== null && window.n62.shell.current !== undefined);
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
    expect(await since(page, () => tap(page, ["fmt"]))).toEqual({ clicks: 1, pulses: 3 }); // the double pulse stays
  });
});

test("Settings › Key vibration › Key click: a switch, off; it survives a relaunch", async ({ page }) => {
  await open(page);
  await tap(page, ["@mode", "d6", "d3"]);
  await expect(row(page, "click")).toHaveAttribute("data-selected", "false");
  await row(page, "click").tap();
  await expect(row(page, "click")).toHaveAttribute("data-selected", "true");
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Key vibration"); // the sheet stays
  expect(await page.evaluate(() => window.n62.session.settings.haptics)).toMatchObject({ on: false, click: true });
  await page.waitForTimeout(1300); // the store writes are asynchronous
  await page.reload();
  await page.waitForFunction(() => window.n62 !== undefined);
  await page.evaluate(() => window.n62.entry.ready);
  await expect.poll(() => page.evaluate(() => window.n62.session.settings.haptics.click)).toBe(true);
});

test("the click goes into a preset's Key vibration group and into a backup", async ({ page }) => {
  await savePicker(page, "fake");
  await open(page);
  const group = await page.evaluate(async (path) => {
    const { session, userKeys } = window.n62;
    const presets = await ((await import(/* @vite-ignore */ path)) as ModeSheet).presetsFor(session, userKeys);
    session.setHaptics({ click: true });
    const id = presets.capture("Clicky", ["vibration"]);
    session.setHaptics({ click: false });
    const held = presets.list.find((p) => p.id === id)?.groups["vibration"];
    await presets.apply(id);
    return { held, after: session.settings.haptics.click };
  }, MODE_SHEET);
  expect(group.held).toMatchObject({ click: true });
  expect(group.after).toBe(true);
  await page.waitForTimeout(900);
  await tap(page, ["@mode", "d6", "d5"]);
  await row(page, "backup").tap();
  await expect(page.getByTestId("notice")).toHaveText("Backup saved");
  const b = JSON.parse((await savedText(page))?.text ?? "{}") as { parts: Record<string, { value: { haptics?: { click?: boolean } } }> };
  expect(b.parts["settings"]?.value.haptics?.click).toBe(true);
});
