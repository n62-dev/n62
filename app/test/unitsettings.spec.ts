// SPDX-License-Identifier: GPL-3.0-or-later
// R838: Settings and Mode open as sheets over the unit view and close back onto it (docs/05, the unit view): the slots, the
// active slot, an armed prefix and the result stay; while the sheet is open every key is the sheet's; on close the focus is
// on the view again (a hardware ← moves between slots) and a changed setting the view shows redraws its result (the decimal mark,
// no engine call) or asks for it again (the digits, which the engine's answer holds).
// Home, CAS and Apps stay places: they close the view. Expected values: derived (2π·25 = 157.0796326794896…, from the
// oracle value of tasks.yaml t04, 2π·0.025 = 0.1570796326794896…; at 6 significant digits 157.080).
import { expect, test, type Page } from "@playwright/test";
import { flick, open, recordVibrations, tap, vibrations } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
/** The view's slot as text: `k:m`, `h`, `` (empty). */
const slotText = (page: Page, id: string): Promise<string> =>
  page.evaluate((id) => {
    const s = window.n62.unitView?.view.model(id)?.slot;
    return (s?.tokens ?? []).map((t, i) => `${i === s?.per ? "/ " : ""}${t.prefix ? `${t.prefix}:` : ""}${t.unit}${t.power ? `^${t.power}` : ""}`).join(" ");
  }, id);
const active = (page: Page): Promise<number | undefined> => page.evaluate(() => window.n62.unitView?.view.active);
const viewOpen = (page: Page): Promise<boolean> => page.evaluate(() => window.n62.unitView !== undefined && document.querySelector('[data-testid="unit-field"]') !== null);
const depth = (page: Page): Promise<number> => page.evaluate(() => window.n62.shell.sheet?.depth ?? 0);
/** The sheet is closed and the focus is on the unit view's element (the hardware keys reach it at once). */
const backOnView = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.shell.sheet === null && window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element);

/** 3 ÷ 2 on the line, the unit view on it: u1 = km, u2 = h (the active slot). */
async function kmPerH(page: Page): Promise<void> {
  await tap(page, ["d3", "div", "d2"]);
  await unitsKey(page);
  await tap(page, ["d4", "d9", "enter"]);
  await flick(page, "d3", "up");
  expect(await slotText(page, "u1")).toBe("k:m");
  expect(await slotText(page, "u2")).toBe("h");
  expect(await active(page)).toBe(1);
}

/** The view as kmPerH left it, with the focus on it: a hardware ← makes u1 the active slot. */
async function sameView(page: Page): Promise<void> {
  await backOnView(page);
  expect(await viewOpen(page)).toBe(true);
  expect(await page.evaluate(() => window.n62.unitView?.view.line)).toBe("\\frac32");
  expect(await slotText(page, "u1")).toBe("k:m");
  expect(await slotText(page, "u2")).toBe("h");
  expect(await active(page)).toBe(1);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => active(page)).toBe(0);
}

for (const width of [412, 360]) {
  test.describe(`Settings and Mode over the unit view (R838), ${width} px`, () => {
    test.use({ viewport: { width, height: 860 } });
    test.beforeEach(async ({ page }) => open(page));

    test("the ⚙ key (R863) opens Settings over the view; Esc twice comes back to it, slots and focus as they were", async ({ page }) => {
      await kmPerH(page);
      await tap(page, ["help"]);
      await expect(page.getByTestId("menu")).toBeVisible();
      expect(await depth(page)).toBe(2); // Mode › Settings
      expect(await viewOpen(page)).toBe(true);
      await tap(page, ["esc", "esc"]);
      await sameView(page);
    });

    test("Mode from Alt + Shift + O and from the bar's chip opens over the view; Esc comes back to it", async ({ page }) => {
      await kmPerH(page);
      await page.keyboard.press("Alt+Shift+O");
      await expect(page.getByTestId("menu")).toBeVisible();
      expect(await viewOpen(page)).toBe(true);
      await tap(page, ["esc"]);
      await sameView(page);
      await page.keyboard.press("ArrowRight"); // u2 active again
      await expect.poll(() => active(page)).toBe(1);
      await tap(page, ["@mode"]);
      await expect(page.getByTestId("menu")).toBeVisible();
      await tap(page, ["esc"]);
      await sameView(page);
    });

    test("with Settings open over the view every key is the sheet's: 4 picks its row 4, ▲ ▼ move; the slots stay", async ({ page }) => {
      await kmPerH(page);
      await tap(page, ["help"]);
      await expect(page.getByTestId("menu")).toBeVisible();
      const hl = (): Promise<number | undefined> => page.evaluate(() => window.n62.shell.sheet?.level.highlight);
      const first = await hl();
      await tap(page, ["down"]);
      await expect.poll(hl).not.toBe(first);
      await tap(page, ["up"]);
      await expect.poll(hl).toBe(first);
      await tap(page, ["d4"]); // Settings' row 4 opens its level (no k into a slot)
      await expect.poll(() => depth(page)).toBe(3);
      expect(await slotText(page, "u1")).toBe("k:m");
      expect(await slotText(page, "u2")).toBe("h");
      await tap(page, ["esc", "esc", "esc"]);
      await sameView(page);
    });

    test("the ⚙ key with a prefix armed (k): after close the prefix is still armed, m makes km", async ({ page }) => {
      await tap(page, ["d3"]);
      await unitsKey(page);
      await tap(page, ["d4"]); // k, armed
      expect(await slotText(page, "u1")).toBe("");
      await tap(page, ["help"]);
      await expect(page.getByTestId("menu")).toBeVisible();
      await tap(page, ["esc", "esc"]);
      await backOnView(page);
      await tap(page, ["d9"]);
      expect(await slotText(page, "u1")).toBe("k:m");
    });

    test("Shift + the ⚙ key (Help, R863) does not open Settings over the view and leaves it as it was", async ({ page }) => {
      await kmPerH(page);
      await tap(page, ["shift", "help"]);
      await page.waitForTimeout(300); // (a sheet would be up by now)
      await expect(page.getByTestId("menu")).toBeHidden();
      expect(await page.evaluate(() => window.n62.session.shift)).toBe(false);
      await sameView(page);
    });

    test("control: Home, CAS, Apps and the place switch still close the view", async ({ page }) => {
      // Apps (Alt + A), CAS (slot 2) from Home, Home from CAS, Alt + H (the switch); the pills by a touch tap (R838f1)
      const steps: [() => Promise<unknown>, "home" | "cas"][] = [
        [() => page.keyboard.press("Alt+A"), "home"],
        [() => page.getByTestId("tab-slot").tap(), "cas"],
        [() => page.getByTestId("tab-home").tap(), "home"],
        [() => page.keyboard.press("Alt+H"), "cas"],
      ];
      for (const [go, to] of steps) {
        await page.evaluate(() => window.n62.entry.clear());
        await tap(page, ["d3"]);
        await unitsKey(page);
        await go();
        await page.waitForFunction(() => window.n62.unitView === undefined);
        if (await page.getByTestId("apps").isVisible()) await tap(page, ["esc"]);
        expect(await page.evaluate(() => window.n62.session.view)).toBe(to);
      }
    });
  });
}

// R838f1 (F474): a touch tap on a bar control right after the flick that opened the view (Shift + Tmpl's flick up) does its
// job. Chromium ran the flick as a scroll gesture ending in a fling, and a tap within the fling's time made no click (the pad
// now cancels its touchmoves, keyboard/noFling.ts). The view is opened once first, so the second opening, with its chunks
// in, follows the flick at once and the tap comes within that time.
for (const width of [412, 360]) {
  test.describe(`a touch tap on the bar right after the flick that opened the unit view (R838f1), ${width} px`, () => {
    test.use({ viewport: { width, height: 860 } });
    test.beforeEach(async ({ page }) => {
      await recordVibrations(page);
      await open(page);
    });

    /** The view on `3`, opened by the flick a second time (the first opening loads its chunks; Esc leaves it). */
    async function flickedOpen(page: Page): Promise<void> {
      await tap(page, ["d3"]);
      await unitsKey(page);
      await tap(page, ["esc"]);
      await page.waitForFunction(() => window.n62.unitView === undefined);
      await unitsKey(page);
    }
    const gone = (page: Page): Promise<unknown> => page.waitForFunction(() => window.n62.unitView === undefined, undefined, { timeout: 3000 });

    test("tab-slot gives CAS", async ({ page }) => {
      await flickedOpen(page);
      await page.getByTestId("tab-slot").tap();
      await gone(page);
      expect(await page.evaluate(() => window.n62.session.view)).toBe("cas");
    });

    test("tab-home gives Home (from CAS)", async ({ page }) => {
      await tap(page, ["@cas"]);
      await expect.poll(() => page.evaluate(() => window.n62.session.view)).toBe("cas");
      await flickedOpen(page);
      await page.getByTestId("tab-home").tap();
      await gone(page);
      expect(await page.evaluate(() => window.n62.session.view)).toBe("home");
    });

    test("place opens the Apps sheet", async ({ page }) => {
      await flickedOpen(page);
      await page.getByTestId("place").tap();
      await gone(page);
      await expect(page.getByTestId("apps")).toBeVisible();
    });

    test("menu-button does what a mouse click on it does: the Units sheet over the view (R862), a second ☰ closes it onto the view", async ({ page }) => {
      const press = async (how: "click" | "tap"): Promise<string> => {
        await page.getByTestId("menu-button")[how]();
        await expect(page.getByTestId("menu")).toBeVisible({ timeout: 3000 });
        const title = (await page.getByTestId("menu").getByTestId("sheet-title").textContent()) ?? "";
        expect(await viewOpen(page)).toBe(true);
        await page.getByTestId("menu-button").click();
        await backOnView(page);
        expect(await viewOpen(page)).toBe(true);
        return title;
      };
      await tap(page, ["d3"]);
      await unitsKey(page);
      await page.waitForTimeout(1000); // (no flick just before: the mouse's own result)
      const byMouse = await press("click");
      expect(byMouse).toBe("Units");
      await tap(page, ["esc"]);
      await page.waitForFunction(() => window.n62.unitView === undefined);
      await unitsKey(page);
      expect(await press("tap")).toBe(byMouse);
    });
  });
}

test.describe("a setting changed over the unit view redraws its result (R838)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  /** 2π·25 mm in the unit view, its result shown at 12 digits; the engine's unit calls counted from here (window.unitCalls). */
  async function twoPi(page: Page): Promise<() => Promise<string>> {
    await tap(page, ["d2", "mul"]);
    await flick(page, "d3", "up");
    await tap(page, ["mul", "d2", "d5"]);
    await unitsKey(page);
    await tap(page, ["enter", "d1", "d9"]);
    await flick(page, "enter", "up");
    const value = page.getByTestId("unit-result").locator(".value");
    const plain = async (): Promise<string> => ((await value.textContent()) ?? "").replace(/\s/g, ""); // (the screen's digit groups)
    await expect.poll(plain).toBe("157.079632679");
    await page.evaluate(() => {
      const calc = window.n62.calc;
      const units = calc.units.bind(calc);
      const w = window as unknown as { unitCalls: number };
      w.unitCalls = 0;
      calc.units = (...a) => {
        w.unitCalls++;
        return units(...a);
      };
    });
    return plain;
  }
  const calls = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { unitCalls: number }).unitCalls);
  const dataText = (page: Page): Promise<string | undefined> => page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="unit-result"]')?.dataset["text"]);

  test("2π·25 mm: Mode › Significant digits 6 over the result asks again: the screen, Copy's text and the Home row show 157.080", async ({ page }) => {
    const plain = await twoPi(page);
    await page.keyboard.press("Alt+Shift+O"); // Mode
    await expect(page.getByTestId("menu")).toBeVisible();
    await tap(page, ["d3", "d2"]); // › Significant digits › 6: the pick closes the sheet
    await backOnView(page);
    // the digits are in the engine's answer (its facts, σ's text, the Home row), so the result is asked for again, once
    await expect.poll(plain).toMatch(/^157\.080?$/);
    await expect.poll(() => dataText(page)).toMatch(/^157\.080?$/);
    await expect(page.getByTestId("unit-unit")).toHaveText("mm");
    expect(await page.evaluate(() => window.n62.session.home.at(-1)?.text)).toMatch(/^157\.080?$/); // the visit's Home row
    expect(await calls(page)).toBe(1);
  });

  test("2π·25 mm: the decimal mark changed over the result draws it again with no engine call", async ({ page }) => {
    const plain = await twoPi(page);
    await page.keyboard.press("Alt+Shift+O"); // Mode
    await expect(page.getByTestId("menu")).toBeVisible();
    await page.evaluate(() => window.n62.session.setDecimalMark("comma")); // (Settings › Numbers › Decimal mark, while the sheet is open)
    await tap(page, ["esc"]);
    await backOnView(page);
    await expect.poll(plain).toBe("157,079632679");
    await expect.poll(() => dataText(page)).toBe("157,079632679");
    expect(await calls(page)).toBe(0);
  });
});
