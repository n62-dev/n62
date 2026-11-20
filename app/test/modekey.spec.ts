// SPDX-License-Identifier: GPL-3.0-or-later
// R723 (owner, 2026-11-17): Mode has no key. It opens from the bar's STD (format) and 12 (digits) chips, a free key that
// holds it, ‹ from Settings and a desktop chord (Alt + Shift + O); Shift + Deselect is Paste now (R322 is reversed).
// Shift + Fmt stays a reserved cell (docs/06 section 3b): no legend, dimmed in the Shift layer only, a dead press that counts
// (R127). The Fmt key's tap is unchanged (fmt.spec.ts), and so is Deselect's (selectgrow.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, recordVibrations, sheet, sheetKey, tap, vibrations } from "./helpers.ts";

const title = (page: Page) => page.getByTestId("sheet-title");
const angle = (page: Page) => page.evaluate(() => window.n62.session.settings.angle);

test("the STD chip opens Mode", async ({ page }) => {
  await open(page);
  await page.getByTestId("chip-format").tap();
  await expect(title(page)).toHaveText("Mode");
});

test("the chip's Mode has Significant digits as the next row after Format (R785)", async ({ page }) => {
  await open(page);
  await page.getByTestId("chip-format").tap();
  await tap(page, ["d3"]);
  await expect(title(page)).toHaveText("Mode › Significant digits");
});

test("the STD chip, ◀ to Angle (▲), ▶, Enter switches RAD → DEG", async ({ page }) => {
  await open(page);
  expect(await angle(page)).toBe("rad");
  await tap(page, ["@mode"]); // (the format chip, then ▲ to Angle)
  await sheetKey(page, ["right", "enter"]);
  await expect.poll(() => angle(page)).toBe("deg");
});

test("the STD chip, 6 opens Settings (row 6 since R89)", async ({ page }) => {
  await open(page);
  await page.getByTestId("chip-format").tap();
  await sheetKey(page, ["d6"]);
  await expect(title(page)).toHaveText("Mode › Settings");
});

test("Deselect's Shift legend reads Paste and fits its face in every theme family; Fmt has none", async ({ page }) => {
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
    expect((await legend("fmt")).text, family).toBe("");
  }
});

test("Shift + Fmt is reserved: dimmed in the Shift layer only, a tap or a flick up opens nothing, and each press is counted under its layer", async ({ page }) => {
  await recordVibrations(page);
  await open(page);
  await page.evaluate(() => window.n62.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["d1", "add", "d2"]);
  const fmt = page.locator('[data-key="fmt"]');
  await expect(fmt).not.toHaveAttribute("data-dead", "true"); // the tap is live
  const keys = (): Promise<Record<string, number>> => page.evaluate(() => ({ ...window.n62.session.taps.counts.keys }));
  const base = await keys();
  await tap(page, ["shift"]);
  await expect(fmt).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="deselect"]')).not.toHaveAttribute("data-dead", "true"); // Paste is live there
  const v1 = (await vibrations(page)).length;
  await tap(page, ["fmt"]); // Shift + Fmt: reserved
  await expect.poll(async () => (await vibrations(page)).length - v1).toBe(3); // the dead key's double pulse
  await expect(sheet(page)).toHaveCount(0);
  await flick(page, "fmt", "up");
  await expect.poll(async () => (await keys())["fmt:up"] ?? 0).toBe(1);
  await expect(sheet(page)).toHaveCount(0);
  const now = await keys();
  expect(now["fmt:shift"]).toBe(1);
  expect(base["fmt:shift"]).toBeUndefined();
  expect(await entryValue(page)).toBe("1+2");
  expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
});
