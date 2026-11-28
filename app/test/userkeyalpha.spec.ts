// SPDX-License-Identifier: GPL-3.0-or-later
// R821 (docs/05 3.4 "Your keys", decisions.md "User keys: two layers, a switch for the third"): U1–U6 have a tap and a Shift
// layer; Alpha, their third (a flick down, its legend bottom left), is a switch in Settings › Your keys, off at first. Off: no
// letter line, a flick down and Alpha + the key are the tap. On: the letter line, the slot fires, the key's height unchanged, its
// face and legends still read (at least 11 px, inside the key, contrast 4.5:1) at 412 × 915 and 360 × 740 in the N62 looks and
// High contrast. A slot set after the first draw is fitted at once (no layer press needed).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const SIZES = [
  { width: 412, height: 915 },
  { width: 360, height: 740 },
];
const SINH = "\\sinh\\left(";
const TANH = "\\tanh\\left(";

/** U1 = sinh (tap), cosh (Shift), tanh (Alpha), as Settings › Your keys sets them. */
async function setU1(page: Page): Promise<void> {
  await page.evaluate(() => {
    const k = window.n62.userKeys;
    k.set("u1", "primary", { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } });
    k.set("u1", "shift", { label: "cosh", action: { insert: "\\cosh\\left(#0\\right)" } });
    k.set("u1", "alpha", { label: "tanh", action: { insert: "\\tanh\\left(#0\\right)" } });
  });
}
const setSwitch = (page: Page, on: boolean): Promise<void> => page.evaluate((v) => window.n62.userKeys.setAlphaLayer(v), on);
const u1 = (page: Page): Locator => page.locator('[data-key="u1"]');
const box = async (l: Locator): Promise<{ x: number; y: number; width: number; height: number }> => {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return b;
};
const fontPx = (l: Locator): Promise<number> => l.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

async function setLook(page: Page, family: string, brightness: "dark" | "light", contrast: boolean): Promise<void> {
  await page.evaluate(
    ([f, b, c]) => {
      const s = window.n62.session;
      s.settings.look = { ...s.settings.look, family: f as typeof s.settings.look.family, brightness: b as "dark" | "light", contrast: c as boolean };
      s.onLook?.({ ...s.settings.look });
    },
    [family, brightness, contrast] as const,
  );
  await page.waitForFunction(([f, b]) => document.documentElement.dataset["family"] === f && document.documentElement.dataset["brightness"] === b, [family, brightness]);
  await page.waitForTimeout(300); // the lazy family file is in
}

type Rgb = [number, number, number];
const lum = ([r, g, b]: Rgb): number => {
  const c = [r, g, b].map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
};
const ratio = (a: Rgb, b: Rgb): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const rgb = (css: string): Rgb => {
  const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(css);
  if (!m) throw new Error(`not a colour: ${css}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

for (const size of SIZES) {
  test.describe(`${size.width} × ${size.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
      await open(page);
    });

    test("off (the default): no letter line; a flick down and Alpha + the key are the tap", async ({ page }) => {
      await setU1(page);
      await expect(u1(page)).toHaveAttribute("data-user", "set");
      await expect(u1(page)).not.toHaveAttribute("data-letters", "true");
      await expect(u1(page).locator(".alphalegend")).toHaveCount(0);
      await expect(u1(page).locator(".main")).toHaveText("sinh");
      await expect(u1(page).locator(".shiftlegend")).toHaveText("cosh");
      await flick(page, "u1", "down");
      expect(await entryValue(page)).toContain(SINH);
      await tap(page, ["alpha", "u1"]);
      expect((await entryValue(page)).split("\\sinh").length - 1).toBe(2);
      expect(await entryValue(page)).not.toContain("tanh");
    });

    test("on: the letter reads tanh bottom left, a flick down types it, the key keeps its height and everything stays at 11 px or more inside it", async ({ page }) => {
      await setU1(page);
      const off = await box(u1(page));
      await setSwitch(page, true);
      const letter = u1(page).locator(".alphalegend");
      await expect(letter).toHaveText("tanh");
      await expect(u1(page)).toHaveAttribute("data-letters", "true");
      await flick(page, "u1", "down");
      expect(await entryValue(page)).toContain(TANH);
      const on = await box(u1(page));
      expect(Math.abs(on.height - off.height)).toBeLessThanOrEqual(0.5);
      for (const part of [".main", ".shiftlegend", ".alphalegend"]) {
        const l = u1(page).locator(part);
        expect(await fontPx(l), part).toBeGreaterThanOrEqual(11);
        const b = await box(l);
        expect(b.x, part).toBeGreaterThanOrEqual(on.x - 1);
        expect(b.x + b.width, part).toBeLessThanOrEqual(on.x + on.width + 1);
        expect(b.y, part).toBeGreaterThanOrEqual(on.y - 0.5);
        expect(b.y + b.height, part).toBeLessThanOrEqual(on.y + on.height + 0.5);
      }
      // the letter is at the bottom, to the left of the face's middle
      const lb = await box(letter);
      expect(lb.y + lb.height / 2).toBeGreaterThan(on.y + on.height / 2);
      expect(lb.x).toBeLessThan(on.x + on.width / 2);
      // the keys below do not move: the next row keeps its place against the off state
      await setSwitch(page, false);
      const back = await box(u1(page));
      expect(Math.abs(back.y - off.y)).toBeLessThanOrEqual(0.5);
    });

    for (const [family, brightness, contrast] of [["n62", "dark", false], ["n62", "light", false], ["n62", "dark", true]] as const)
      test(`on: the letter reads at 4.5:1 or more in ${family} ${brightness}${contrast ? " with High contrast" : ""}`, async ({ page }) => {
        await setU1(page);
        await setSwitch(page, true);
        await setLook(page, family, brightness, contrast);
        const { fg, bg, op } = await u1(page).locator(".alphalegend").evaluate((el) => {
          const key = el.closest(".key") as HTMLElement;
          return { fg: getComputedStyle(el).color, bg: getComputedStyle(key).backgroundColor, op: parseFloat(getComputedStyle(el).opacity) };
        });
        expect(op).toBe(1);
        expect(ratio(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(4.5);
      });

    test("a slot set after the first draw is fitted at once: U4 on Settings fits its key with no Shift or Alpha press", async ({ page }) => {
      await page.evaluate(() => window.n62.userKeys.set("u4", "primary", { label: "Settings", action: { special: "settings" } }));
      const key = page.locator('[data-key="u4"]');
      await expect(key.locator(".main")).toHaveText("Settings");
      await expect
        .poll(async () => {
          const k = await box(key);
          const m = await box(key.locator(".main"));
          return m.x >= k.x - 0.5 && m.x + m.width <= k.x + k.width + 0.5;
        })
        .toBe(true);
      await expect(key.locator(".main")).not.toHaveAttribute("data-cut", /.*/); // fitted, not ellipsed
      const px = await fontPx(key.locator(".main"));
      expect(px).toBeGreaterThanOrEqual(9);
      expect(px).toBeLessThan(14); // the unfitted face is 15 px
    });

    test("the switch turning on refits at once: U4 on Settings with an Alpha slot set first fits at 11 px or more inside its key, no Shift or Alpha press (R821 fix)", async ({ page }) => {
      await page.evaluate(() => {
        const k = window.n62.userKeys;
        k.set("u4", "primary", { label: "Settings", action: { special: "settings" } });
        k.set("u4", "alpha", { label: "tanh", action: { insert: "\\tanh\\left(#0\\right)" } });
      });
      const key = page.locator('[data-key="u4"]');
      await expect(key.locator(".main")).toHaveText("Settings");
      await expect(key.locator(".alphalegend")).toHaveCount(0); // off: the slot is kept, not drawn
      await setSwitch(page, true);
      await expect(key.locator(".alphalegend")).toHaveText("tanh");
      await expect
        .poll(async () => {
          const k = await box(key);
          const m = await box(key.locator(".main"));
          return m.x >= k.x - 0.5 && m.x + m.width <= k.x + k.width + 0.5 && (await fontPx(key.locator(".main"))) >= 11 && (await fontPx(key.locator(".main"))) < 14;
        })
        .toBe(true);
      await expect(key.locator(".main")).not.toHaveAttribute("data-cut", /.*/);
    });
  });
}
