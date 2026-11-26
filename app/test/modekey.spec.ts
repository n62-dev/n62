// SPDX-License-Identifier: GPL-3.0-or-later
// R723 (owner, 2026-11-17): Mode has no key. It opens from the bar's STD (format) and 12 (digits) chips, a free key that
// holds it, Settings' row 1 (R927) and a desktop chord (Alt + Shift + O); Shift + Deselect is Paste now (R322 is reversed).
// A reserved cell (docs/06 section 3b; Shift + 7 since R871 filled Shift + Fmt): no legend, dimmed in the Shift layer only, a dead
// press that counts (R127). The Fmt key's tap is unchanged (fmt.spec.ts), and so is Deselect's (selectgrow.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, recordVibrations, sheet, sheetKey, tap, vibrations } from "./helpers.ts";

const title = (page: Page) => page.getByTestId("sheet-title");
const angle = (page: Page) => page.evaluate(() => window.n62.session.settings.angle);

test("the STD chip opens Mode", async ({ page }) => {
  await open(page);
  await page.getByTestId("chip-format").tap();
  await expect(title(page)).toHaveText("Settings › Mode");
});

test("the chip's Mode has Significant digits as the next row after Format (R785)", async ({ page }) => {
  await open(page);
  await page.getByTestId("chip-format").tap();
  await tap(page, ["d4"]); // (R927: Preset is row 1)
  await expect(title(page)).toHaveText("Settings › Mode › Significant digits");
});

test("the STD chip, ◀ to Angle (▲), ▶, Enter switches RAD → DEG", async ({ page }) => {
  await open(page);
  expect(await angle(page)).toBe("rad");
  await tap(page, ["@mode"]); // (the format chip, then ▲ to Angle)
  await sheetKey(page, ["right", "enter"]);
  await expect.poll(() => angle(page)).toBe("deg");
});

test("the STD chip, Esc goes up to Settings, Mode its row 1 (R927)", async ({ page }) => {
  await open(page);
  await page.getByTestId("chip-format").tap();
  await sheetKey(page, ["esc"]);
  await expect(title(page)).toHaveText("Settings");
});

test("Deselect's Shift legend reads Paste and Fmt's Cycle (R871), each fitting its face in every theme family; 7 has none", async ({ page }) => {
  await open(page);
  for (const family of ["n62", "bw", "solarized"]) {
    await page.evaluate(
      async (family) => {
        const url = "/src/theme/apply.ts";
        const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
        await m.applyTheme({ family, brightness: "dark", contrast: "normal", keys: "colour" } as never, document.documentElement);
      },
      family,
    );
    const legend = (id: string) =>
      page.locator(`[data-key="${id}"]`).evaluate((key) => {
        const l = key.querySelector<HTMLElement>(".shiftlegend");
        return { text: l?.textContent?.trim() ?? "", fits: l ? l.scrollWidth <= key.clientWidth : true };
      });
    expect(await legend("deselect"), family).toEqual({ text: "Paste", fits: true });
    expect(await legend("fmt"), family).toEqual({ text: "Cycle", fits: true }); // R871: the Fmt key cycle's page
    expect((await legend("d7")).text, family).toBe("");
  }
});

test("Shift + 7 is reserved (R871: Shift + Fmt was, until it opened its page): dimmed in the Shift layer only, a tap or a flick up opens nothing, and each press is counted under its layer", async ({ page }) => {
  await recordVibrations(page);
  await open(page);
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["d1", "add", "d2"]);
  const seven = page.locator('[data-key="d7"]');
  await expect(seven).not.toHaveAttribute("data-dead", "true"); // the tap is live
  const keys = (): Promise<Record<string, number>> => page.evaluate(() => ({ ...window.n62.session.taps.counts.keys }));
  const base = await keys();
  await tap(page, ["shift"]);
  await expect(seven).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="deselect"]')).not.toHaveAttribute("data-dead", "true"); // Paste is live there
  const v1 = (await vibrations(page)).length;
  await tap(page, ["d7"]); // Shift + 7: reserved
  await expect.poll(async () => (await vibrations(page)).length - v1).toBe(2); // drawn dead (R777): the double pulse alone, no key pulse
  await expect(sheet(page)).toHaveCount(0);
  await flick(page, "d7", "up");
  await expect.poll(async () => (await keys())["d7:up"] ?? 0).toBe(1);
  await expect(sheet(page)).toHaveCount(0);
  const now = await keys();
  expect(now["d7:shift"]).toBe(1);
  expect(base["d7:shift"]).toBeUndefined();
  expect(await entryValue(page)).toBe("1+2");
  expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
});
