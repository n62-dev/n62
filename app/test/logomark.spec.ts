// SPDX-License-Identifier: GPL-3.0-or-later
// R157, R745 (owner, 2026-11-17): Home's tile is the colour logo, the app icon (icons/icon.svg), the same file in every theme;
// CAS and the apps keep their glyphs; and faint on an
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
/** Home's tile: on the bar's Home tab since R722 (the place shows Apps, or an app's glyph). */
const tile = (page: Page) => page.getByTestId("tab-home").locator(".tile");

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

  /** The image of Home's tile: its source, whether it loaded, its box and the tile's. */
  const logoImg = (page: Page) =>
    tile(page).locator("img").evaluate((el) => {
      const i = el as HTMLImageElement;
      const t = i.parentElement as HTMLElement;
      const b = i.getBoundingClientRect();
      const tb = t.getBoundingClientRect();
      return { src: i.getAttribute("src") ?? "", loaded: i.complete && i.naturalWidth > 0, box: { l: b.left, t: b.top, r: b.right, b: b.bottom }, tile: { l: tb.left, t: tb.top, r: tb.right, b: tb.bottom, w: tb.width, h: tb.height } };
    });

  test("Home's tile is the colour logo, the app icon", async ({ page }) => {
    await expect(tile(page).locator("img")).toHaveCount(1);
    await expect(tile(page).locator(".logomark")).toHaveCount(0);
    const img = await logoImg(page);
    expect(img.src).toMatch(/icons\/icon\.svg$/);
    expect(img.loaded).toBe(true);
    await expect(tile(page)).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByTestId("tab-home")).toHaveAttribute("aria-label", "Home");
  });

  test("the logo is the same file in N62, N62 Dark and Black & White", async ({ page }) => {
    const srcs: string[] = [];
    for (const look of [LOOKS[1]!, LOOKS[0]!, LOOKS[2]!]) {
      await show(page, look);
      await expect(page.locator(":root")).toHaveAttribute("data-family", look.family);
      const img = await logoImg(page);
      expect(img.loaded).toBe(true);
      srcs.push(img.src);
    }
    expect(new Set(srcs).size).toBe(1);
    expect(srcs[0]).toMatch(/icons\/icon\.svg$/);
  });

  for (const width of [360, 412])
    test(`the logo fits Home's tile at ${width} px, the ring still shows while busy`, async ({ page }) => {
      await page.setViewportSize({ width, height: 815 });
      const img = await logoImg(page);
      expect(img.tile.w).toBe(22); // R745, R157: the logo stays 22 × 22 (R782: the pill's glyph tile, --pill-tile-w); the target is the pill's 56 × 28 (tab-home)
      expect(img.tile.h).toBe(22);
      const target = (await page.getByTestId("tab-home").boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(28);
      expect(target.height).toBeGreaterThanOrEqual(28);
      const eps = 0.5;
      expect(img.box.l).toBeGreaterThanOrEqual(img.tile.l - eps);
      expect(img.box.t).toBeGreaterThanOrEqual(img.tile.t - eps);
      expect(img.box.r).toBeLessThanOrEqual(img.tile.r + eps);
      expect(img.box.b).toBeLessThanOrEqual(img.tile.b + eps);
      await page.evaluate(() => (window.n62.session.engineState = "starting"));
      await expect(tile(page)).toHaveAttribute("data-ring", "true");
      const ring = await tile(page).evaluate((el) => getComputedStyle(el, "::after").borderTopWidth);
      expect(ring).toBe("2px");
    });

  test("one tap on the Home tab from CAS gives Home", async ({ page }) => {
    await page.evaluate(() => window.n62.session.setView("cas"));
    await page.getByTestId("tab-home").tap();
    await expect(page.getByTestId("tab-home")).toHaveAttribute("aria-selected", "true");
  });

  test("the mark file is served", async ({ page }) => {
    const r = await page.request.get("/n62-mark.svg");
    expect(r.ok()).toBe(true);
    expect(await r.text()).toContain('viewBox="34.04 29.87 39.92 48.25"');
  });

  test("CAS and an app keep their glyphs; the busy ring still draws over Home's tile", async ({ page }) => {
    await expect(tile(page).locator("img")).toHaveCount(1);
    await page.evaluate(() => window.n62.session.setView("cas"));
    const cas = page.getByTestId("tab-slot").locator(".tile");
    await expect(cas.locator(".logomark")).toHaveCount(0);
    await expect(cas).toHaveText("∫");
    await page.evaluate(() => window.n62.shell.open("function", "symb"));
    await expect(place(page).locator(".tile .logomark")).toHaveCount(0);
    await expect(place(page).locator(".tile")).toHaveText("ƒ");
    await page.evaluate(() => {
      window.n62.shell.close();
      window.n62.session.setView("home");
      window.n62.session.engineState = "starting";
    });
    await expect(tile(page)).toHaveAttribute("data-ring", "true");
    await expect(tile(page).locator("img")).toHaveCount(1);
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
          const faint = page.locator(".faint");
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
        await expect(page.locator(".faint")).toBeVisible();
        await tap(page, ["d1", "add", "d2", "enter"]);
        await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
        await expect(page.locator(".faint")).toHaveCount(0);
      });

      test("a tap on it opens the credits sheet, nothing is submitted", async ({ page }) => {
        await page.locator(".faint").tap();
        await expect(credits(page)).toBeVisible();
        await expect(credits(page)).toContainText("N62 stands for \"Number Six Two\": six is the first perfect number, and two is the first prime number.");
        expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
      });
    });
});
