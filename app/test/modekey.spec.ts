// SPDX-License-Identifier: GPL-3.0-or-later
// R322 (owner, 2026-11-14): Shift + Deselect (and a flick up on Deselect) opens Mode on Angle, as Shift + Fmt did from R85;
// Shift + Fmt is now a reserved cell (docs/06 section 3b): no legend, dimmed in the Shift layer only, a dead press that
// counts (R127). The Fmt key's tap is unchanged (fmt.spec.ts), and so is Deselect's (selectgrow.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, recordVibrations, sheet, sheetKey, tap, vibrations } from "./helpers.ts";

const title = (page: Page) => page.getByTestId("sheet-title");
const angle = (page: Page) => page.evaluate(() => window.n62.session.settings.angle);

test("Shift, Deselect opens Mode (on Angle: the next test steps its value)", async ({ page }) => {
  await open(page);
  await tap(page, ["shift", "deselect"]);
  await expect(title(page)).toHaveText("Mode");
});

test("a flick up on Deselect does what Shift, Deselect does", async ({ page }) => {
  await open(page);
  await flick(page, "deselect", "up");
  await expect(title(page)).toHaveText("Mode");
});

test("Shift, Deselect, ▶, Enter switches RAD → DEG (three keys after Shift)", async ({ page }) => {
  await open(page);
  expect(await angle(page)).toBe("rad");
  await tap(page, ["shift", "deselect"]);
  await sheetKey(page, ["right", "enter"]);
  await expect.poll(() => angle(page)).toBe("deg");
});

test("Shift, Deselect, 6 opens Settings (row 6 since R89)", async ({ page }) => {
  await open(page);
  await tap(page, ["shift", "deselect", "d6"]);
  await expect(title(page)).toHaveText("Mode › Settings");
});

test("Deselect's Shift legend reads Mode and fits its face in every theme family; Fmt has none", async ({ page }) => {
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
    expect(await legend("deselect"), family).toEqual({ text: "Mode", fits: true });
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
  await expect(page.locator('[data-key="deselect"]')).not.toHaveAttribute("data-dead", "true"); // Mode is live there
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
