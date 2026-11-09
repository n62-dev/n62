// SPDX-License-Identifier: GPL-3.0-or-later
// R157 (owner, 2026-11-07, docs/mockups/n62-teal-2026-11-07.html): the logo as the app icon draws it on Home's tile (black
// mark on the logo teal #529997, the same in every family and mode), CAS and the apps keep their glyphs; and faint on an
// empty history (--mark-faint, at most 1.3:1 on --bg), gone after one result, a tap on it opens the credits sheet. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

interface Look {
  family: "n62" | "bw" | "solarized";
  brightness: "light" | "dark";
  contrast: boolean;
  plain: boolean;
}
const LOOKS: Look[] = [
  { family: "n62", brightness: "dark", contrast: false, plain: false },
  { family: "n62", brightness: "light", contrast: false, plain: false },
  { family: "bw", brightness: "dark", contrast: false, plain: false },
  { family: "solarized", brightness: "light", contrast: false, plain: false },
  { family: "n62", brightness: "dark", contrast: true, plain: true },
  { family: "solarized", brightness: "light", contrast: true, plain: false },
  { family: "bw", brightness: "light", contrast: false, plain: true },
];
const name = (l: Look): string => `${l.family} ${l.brightness}${l.contrast ? " + High contrast" : ""}${l.plain ? " + Plain keys" : ""}`;

/** Put a look on the page as Appearance does (theme/lookApply.ts), its files loaded. */
const show = (page: Page, look: Look): Promise<void> =>
  page.evaluate(async (l) => {
    const url = "/src/theme/lookApply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/lookApply.ts");
    await m.applyLook({ ...l, shadow: true, pops: true });
  }, look);

const credits = (page: Page) => page.getByTestId("credits");
const place = (page: Page) => page.getByTestId("place");
const tile = (page: Page) => place(page).locator(".tile");

/** The colour of a role as rgb(). */
const role = (page: Page, name: string): Promise<string> =>
  page.evaluate((r) => {
    const probe = document.createElement("i");
    probe.style.color = `var(--${r})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);
const rgb = (c: string): number[] => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number);
const lum = (c: string): number => {
  const [r, g, b] = rgb(c).map((v) => ((v / 255) <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

test.describe("fake engine", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page);
  });

  for (const look of LOOKS)
    test(`Home's tile: black mark on #529997 (${name(look)})`, async ({ page }) => {
      await show(page, look);
      await expect(page.locator(":root")).toHaveAttribute("data-family", look.family);
      const mark = tile(page).getByTestId("logo-mark");
      await expect(mark).toBeVisible();
      expect(await tile(page).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(82, 153, 151)");
      expect(await mark.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(0, 0, 0)");
      expect(await mark.evaluate((el) => getComputedStyle(el).maskImage + getComputedStyle(el).webkitMaskImage)).toContain("n62-mark.svg");
      const [tb, mb] = await Promise.all([tile(page).boundingBox(), mark.boundingBox()]);
      expect(tb && mb && mb.height > tb.height * 0.7 && mb.height < tb.height).toBe(true); // fills the tile, not a small mark in the middle
      expect(await tile(page).evaluate((el) => el.getBoundingClientRect().width)).toBe(30); // the tile keeps its size
      await expect(place(page)).toHaveAttribute("aria-label", /^Place: Home/); // the button keeps its label; the tile is for the eye only
      await expect(tile(page)).toHaveAttribute("aria-hidden", "true");
    });

  test("the mark file is served", async ({ page }) => {
    const r = await page.request.get("/n62-mark.svg");
    expect(r.ok()).toBe(true);
    expect(await r.text()).toContain('viewBox="29.8 30.5 48.4 47"');
  });

  test("CAS and an app keep their glyphs; the busy ring still draws over Home's tile", async ({ page }) => {
    await expect(tile(page).getByTestId("logo-mark")).toHaveCount(1);
    await page.evaluate(() => window.n62.session.setView("cas"));
    await expect(tile(page).getByTestId("logo-mark")).toHaveCount(0);
    await expect(tile(page)).toHaveText("∫");
    await page.evaluate(() => window.n62.shell.open("function", "symb"));
    await expect(tile(page).getByTestId("logo-mark")).toHaveCount(0);
    await expect(tile(page)).toHaveText("ƒ");
    await page.evaluate(() => {
      window.n62.shell.close();
      window.n62.session.setView("home");
      window.n62.session.engineState = "starting";
    });
    await expect(tile(page)).toHaveAttribute("data-ring", "true");
    await expect(tile(page).getByTestId("logo-mark")).toHaveCount(1);
    const ring = await tile(page).evaluate((el) => {
      const s = getComputedStyle(el, "::after");
      return { w: s.borderTopWidth, c: s.borderTopColor, content: s.content };
    });
    expect(ring.w).toBe("2px");
    expect(ring.c).toBe(await role(page, "alpha"));
  });

  for (const view of ["home", "cas"] as const)
    test.describe(`empty history, ${view}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.evaluate((v) => window.n62.session.setView(v), view);
      });

      for (const look of LOOKS)
        test(`the faint mark above the hint (${name(look)})`, async ({ page }) => {
          await show(page, look);
          await expect(page.locator(":root")).toHaveAttribute("data-family", look.family);
          const faint = page.getByTestId("empty-mark");
          await expect(faint).toBeVisible();
          await expect(faint).toHaveAttribute("aria-hidden", "true");
          const [fb, hb] = await Promise.all([faint.boundingBox(), page.getByText("Type a calculation and press Enter.").boundingBox()]);
          expect(fb && Math.round(fb.height)).toBe(128);
          expect(fb && hb && fb.y + fb.height <= hb.y).toBe(true); // above the hint
          const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
          const faintColour = await faint.evaluate((el) => getComputedStyle(el).backgroundColor);
          expect(faintColour).toBe(await role(page, "mark-faint"));
          expect(ratio(faintColour, bg)).toBeLessThanOrEqual(1.3);
          expect(ratio(faintColour, bg)).toBeGreaterThan(1.03); // seen, faintly
          expect(await faint.evaluate((el) => getComputedStyle(el).maskImage + getComputedStyle(el).webkitMaskImage)).toContain("n62-mark.svg");
        });

      test("one result and it is gone", async ({ page }) => {
        await expect(page.getByTestId("empty-mark")).toBeVisible();
        await tap(page, ["d1", "add", "d2", "enter"]);
        await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
        await expect(page.getByTestId("empty-mark")).toHaveCount(0);
      });

      test("a tap on it opens the credits sheet, nothing is submitted", async ({ page }) => {
        await page.getByTestId("empty-mark").tap();
        await expect(credits(page)).toBeVisible();
        await expect(credits(page)).toContainText("N for number, 6 first perfect number, 2 first prime number");
        expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
      });
    });
});
