// SPDX-License-Identifier: GPL-3.0-or-later
// A66: the optional key click, off by default. One click per touch at finger-down, beside R112's pulse (none for pad
// steps or flicks; a dead key's double pulse has one click); Settings › Key vibration › Key click is a switch that
// survives a relaunch and goes into a preset's Key vibration group and a backup. The web click is one oscillator started.
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, flick, lastResult, open, recordVibrations, savedText, savePicker, sheet, tap, touch, vibrations } from "./helpers.ts";

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

/** Turn the click on and wait for its lazy chunk (App's effect imports it): a press before that makes no click, by design. */
const clickOn = async (page: Page): Promise<void> => {
  await page.evaluate(async (path) => {
    window.n62.session.setHaptics({ click: true });
    await ((await import(/* @vite-ignore */ path)) as typeof import("../src/input/haptics.ts")).loadClick();
  }, HAPTICS);
};

const row = (page: Page, id: string) => page.getByTestId("menu").locator(`[data-id="${id}"]`);
const HAPTICS = "/src/input/haptics.ts";
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
    await clickOn(page);
    expect(await since(page, () => tap(page, ["d7"]))).toEqual({ clicks: 1, pulses: 0 });
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
    expect(await since(page, () => tap(page, ["d8"]))).toEqual({ clicks: 1, pulses: 1 });
  });

  test("on: a flick and a pad drag are one click each, and still fire; a dead key is the double pulse and no click (R777)", async ({ page }) => {
    await clickOn(page);
    await tap(page, ["d1", "d2", "d3", "d4", "d5", "d6"]);
    expect((await since(page, () => drag(page, "left", -64, 0))).clicks).toBe(1); // five steps
    expect((await since(page, () => flick(page, "dot", "up"))).clicks).toBe(1);
    expect(await entryValue(page)).toContain("=");
    await tap(page, ["@symb"]);
    await page.waitForFunction(() => window.n62.shell.app !== null && window.n62.shell.current !== undefined);
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
    expect(await since(page, () => tap(page, ["fmt"]))).toEqual({ clicks: 0, pulses: 2 }); // R777: the app has no Fmt: the double pulse alone
  });
});

// R777 (docs/05 3.7): a key drawn dead has no click, no press look and no pop at finger-down; it gives the dead key's double
// pulse and nothing else. A live key keeps its click, its one pulse and the look.
test.describe("a key drawn dead: no click, no look, the double pulse", () => {
  test.beforeEach(async ({ page }) => {
    await recordVibrations(page);
    await recordClicks(page);
    await open(page);
    await clickOn(page);
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  });
  /** A finger down on the key: what is lit and popped while it is held, then the clicks and pulses once the lift and the dead pulses are in. */
  const press = async (page: Page, id: string): Promise<{ lit: number; pop: number; clicks: number; pulses: number }> => {
    await expect(page.locator(".pad [data-down]")).toHaveCount(0); // (the last press shows out its 80 ms first, R161)
    const [c, p] = [await clicks(page), (await vibrations(page)).length];
    const f = await touch(page, id);
    const lit = await page.locator(".pad [data-down]").count();
    const pop = await page.getByTestId("key-pop").count();
    await f.end();
    await page.waitForTimeout(300);
    return { lit, pop, clicks: (await clicks(page)) - c, pulses: (await vibrations(page)).length - p };
  };
  const DEAD = { lit: 0, pop: 0, clicks: 0, pulses: 2 };

  test("Find open: Help is drawn dead and is a dead press", async ({ page }) => {
    await tap(page, ["math"]);
    await expect(page.getByTestId("find")).toBeVisible();
    await expect(page.locator('[data-key="help"]')).toHaveAttribute("data-dead", "true");
    expect(await press(page, "help")).toEqual(DEAD);
  });
  test("Find open: an empty free key (U1) is a dead press", async ({ page }) => {
    await tap(page, ["math"]);
    await expect(page.getByTestId("find")).toBeVisible();
    await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-dead", "true");
    expect(await press(page, "u1")).toEqual(DEAD);
  });
  test("☰ open: sin is a dead press and the sheet stays", async ({ page }) => {
    await tap(page, ["@menu"]);
    await expect(page.getByTestId("menu").getByRole("menuitem").first()).toBeVisible();
    expect(await press(page, "sin")).toEqual(DEAD);
    await expect(page.getByTestId("menu")).toBeVisible();
  });
  // the route turns these into nothing (the state decides, keyboard/quiet.ts): the same as a key drawn dead
  test("Fmt on an empty Home is a dead press: no look, no click, the double pulse", async ({ page }) => {
    await expect(page.locator('[data-key="fmt"]')).not.toHaveAttribute("data-dead", "true");
    expect(await press(page, "fmt")).toEqual(DEAD);
  });
  test("☰ open: ⌫ on an empty filter is a dead press: no look, no click, the double pulse; with a letter typed it is live", async ({ page }) => {
    await tap(page, ["@menu"]);
    await expect(page.getByTestId("menu").getByRole("menuitem").first()).toBeVisible();
    await expect(page.locator('[data-key="bksp"]')).not.toHaveAttribute("data-dead", "true");
    expect(await press(page, "bksp")).toEqual(DEAD);
    await expect(page.getByTestId("menu")).toBeVisible();
  });
  test("Fmt is live once Home has a result; in Plot a digit is a dead press", async ({ page }) => {
    await tap(page, ["d2", "enter"]);
    await expect(lastResult(page)).toBeVisible();
    expect(await press(page, "fmt")).toMatchObject({ lit: 1, clicks: 1, pulses: 1 });
    await tap(page, ["@plot"]);
    await page.waitForFunction(() => window.n62.shell.app !== null && window.n62.shell.current !== undefined);
    expect(await press(page, "d7")).toEqual(DEAD);
  });
  const LIVE = { lit: 1, clicks: 1, pulses: 1 };
  // keys the sheet reads for a job of its own are drawn dead by the sheet's key table, yet act: their feedback stays (route.ts sheetPress)
  test("Shift + 6: ÷ sits at a grid cell's place and picks it: the look, one click, one pulse", async ({ page }) => {
    await tap(page, ["shift", "d6"]);
    await expect(page.getByTestId("sheet-title")).toBeVisible();
    expect(await press(page, "div")).toMatchObject(LIVE);
    expect(await entryValue(page)).not.toBe(""); // (the cell is inserted)
  });
  test("Settings › Your keys: a free key goes to its row, with the feedback", async ({ page }) => {
    await tap(page, ["@mode", "d6", "d4"]);
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Your keys");
    expect(await press(page, "u1")).toMatchObject(LIVE);
    await expect(sheet(page).locator('[data-active="true"]')).toHaveAttribute("data-id", "u1:primary");
  });
  test("Store ▶ (Shift + ᴇ): with no result a dead press, with a result live and the store sheet opens", async ({ page }) => {
    await tap(page, ["shift"]);
    expect(await press(page, "emark")).toEqual(DEAD);
    await tap(page, ["d2", "enter"]);
    await expect(lastResult(page)).toBeVisible();
    await tap(page, ["shift"]);
    expect(await press(page, "emark")).toMatchObject(LIVE);
    await expect(page.getByTestId("store")).toBeVisible();
  });
  test("◀ on a picked row with an empty line: a running row is a dead press, a finished one gives its input back", async ({ page }) => {
    await tap(page, ["d2", "enter"]);
    await expect(lastResult(page)).toBeVisible();
    await tap(page, ["up"]);
    expect(await press(page, "left")).toMatchObject(LIVE);
    await expect.poll(() => entryValue(page)).toBe("2");
    await open(page, "engine=fake&delay=3000"); // a job that runs for a while
    await clickOn(page);
    await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
    await tap(page, ["d2", "enter"]);
    await expect(page.locator('[data-status="pending"]')).toHaveCount(1);
    await tap(page, ["up"]);
    expect(await press(page, "left")).toEqual(DEAD);
  });
  test("in Plot the keys that need the entry line are dead presses; on Home each is live", async ({ page }) => {
    const needs = ["math", "help", "tmpl", "vars", "select", "deselect"];
    for (const id of needs.slice(0, 5)) { // (Deselect with nothing selected is the line's own dead press, not asked)
      await tap(page, ["d1", "d2"]); // (something to select)
      expect(await press(page, id), id).toMatchObject(LIVE);
      await tap(page, ["esc", "esc"]);
    }
    await tap(page, ["@plot"]);
    await page.waitForFunction(() => window.n62.shell.app !== null && window.n62.shell.current !== undefined);
    for (const id of needs) expect(await press(page, id), id).toEqual(DEAD);
    await tap(page, ["shift"]);
    expect(await press(page, "deselect"), "paste").toEqual(DEAD); // Shift + Deselect
  });
  test("controls: a live key has the look, the pop, one click and one pulse; Find's letter keys do too", async ({ page }) => {
    expect(await press(page, "d7")).toEqual({ lit: 1, pop: 1, clicks: 1, pulses: 1 });
    await tap(page, ["math"]);
    await expect(page.getByTestId("find")).toBeVisible();
    const before = await clicks(page);
    expect(await press(page, "sin")).toMatchObject({ lit: 1, clicks: 1, pulses: 1 }); // Find types its letters
    expect((await clicks(page)) - before).toBe(1);
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
