// SPDX-License-Identifier: GPL-3.0-or-later
// R157, R856 (owner, 2026-11-22): Home's tile is the house in the segment's colour (R745's colour logo left the bar);
// CAS and the apps keep their glyphs; the N62 mark is faint on an
// empty history (--mark-faint, the hint's colour at 1.2 to 1.3:1 on --bg, R874), gone after one result; it takes no tap (R924). The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheet, tap } from "./helpers.ts";

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
    await m.applyLook({ ...l, shadow: true, pops: true, findFull: false, hand: "right" });
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

  /** Home's glyph (R856: the house, not the logo): its stroke against the tile's colour, its box and the tile's. */
  const house = (page: Page) =>
    tile(page).locator("svg").evaluate((el) => {
      const t = el.parentElement as HTMLElement;
      const b = el.getBoundingClientRect();
      const tb = t.getBoundingClientRect();
      return { stroke: getComputedStyle(el.querySelector("path")!).stroke, color: getComputedStyle(t).color, box: { l: b.left, t: b.top, r: b.right, b: b.bottom }, tile: { l: tb.left, t: tb.top, r: tb.right, b: tb.bottom, w: tb.width, h: tb.height } };
    });

  test("Home's tile is the house, not the logo (R856)", async ({ page }) => {
    await expect(tile(page).locator("svg")).toHaveCount(1);
    await expect(tile(page).locator("img")).toHaveCount(0);
    await expect(tile(page)).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByTestId("tab-home")).toHaveAttribute("aria-label", "Home");
  });

  test("the house is drawn in the segment's colour in N62, N62 Dark and Black & White (R856)", async ({ page }) => {
    for (const look of [LOOKS[1]!, LOOKS[0]!, LOOKS[2]!]) {
      await show(page, look);
      await expect(page.locator(":root")).toHaveAttribute("data-family", look.family);
      const h = await house(page);
      expect(h.stroke).toBe(h.color);
    }
  });

  for (const width of [360, 412])
    test(`the house fits Home's 16 px glyph at ${width} px, the ring still shows while busy`, async ({ page }) => {
      await page.setViewportSize({ width, height: 815 });
      const h = await house(page);
      expect(h.tile.w).toBe(16); // R856: the segment's glyph (--pill-tile-w); the target is the segment's 54 × 28 (tab-home)
      expect(h.tile.h).toBe(16);
      const target = (await page.getByTestId("tab-home").boundingBox())!;
      expect(target.width).toBeGreaterThanOrEqual(28);
      expect(target.height).toBeGreaterThanOrEqual(28);
      const eps = 0.5;
      expect(h.box.l).toBeGreaterThanOrEqual(h.tile.l - eps);
      expect(h.box.t).toBeGreaterThanOrEqual(h.tile.t - eps);
      expect(h.box.r).toBeLessThanOrEqual(h.tile.r + eps);
      expect(h.box.b).toBeLessThanOrEqual(h.tile.b + eps);
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
    await expect(tile(page).locator("svg")).toHaveCount(1);
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
    await expect(tile(page).locator("svg")).toHaveCount(1);
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
          expect(ratio(faintColour, bg)).toBeGreaterThanOrEqual(1.2); // R874: seen, faintly (B&W Dark's stood 1.11)
          // R874: the hint's colour, so on the hint's side of the screen (both lighter, or both darker)
          const hint = await page.getByText("Type a calculation and press Enter.").evaluate((el) => getComputedStyle(el).color);
          expect(lum(faintColour) > lum(bg), "the mark on the hint's side of --bg").toBe(lum(hint) > lum(bg));
          expect(await faint.evaluate((el) => getComputedStyle(el).maskImage + getComputedStyle(el).webkitMaskImage)).toContain("n62-mark.svg");
        });

      test("one result and it is gone", async ({ page }) => {
        await expect(page.locator(".faint")).toBeVisible();
        await tap(page, ["d1", "add", "d2", "enter"]);
        await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
        await expect(page.locator(".faint")).toHaveCount(0);
      });

      // R924 (owner, 2026-11-23): the mark takes no tap; a touch at its centre opens no sheet and leaves the line and
      // the history as they were (the credits stay on N62 then Enter, credits.spec.ts)
      test("a tap on it opens no sheet and submits nothing (R924)", async ({ page }) => {
        await tap(page, ["d1"]);
        const line = await entryValue(page);
        const b = (await page.locator(".faint").boundingBox())!;
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await page.waitForTimeout(500); // the credits come in a lazy chunk
        await expect(credits(page)).toHaveCount(0);
        await expect(sheet(page)).toHaveCount(0);
        expect(await entryValue(page)).toBe(line);
        expect(await page.evaluate(() => window.n62.session.items.length)).toBe(0);
        await expect(page.locator(".faint")).toBeVisible();
      });
    });
});

// R860 (owner's point 17, 2026-11-22): the mark and the hint show whenever the open view has no rows and its stored
// history is read, also beside the Undo note of a Clear; the mark shrinks to the space left, is left out under 40 px,
// and is never cropped; the hint is never cut. sandra's S1 probe found it hidden after a Clear, cropped on a short
// history and in the page for a moment before the stored rows came.
test.describe("R860: the mark of an empty view", () => {
  /** How the boxes of the mark and the hint lie in the history: each inside it (0.5 px slack), or absent. */
  const boxes = (page: Page) =>
    page.evaluate(() => {
      const h = document.querySelector<HTMLElement>("section.history")!.getBoundingClientRect();
      const inside = (sel: string): boolean | null => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el || el.getClientRects().length === 0) return null;
        const b = el.getBoundingClientRect();
        return b.height > 0 && b.top >= h.top - 0.5 && b.bottom <= h.bottom + 0.5 && b.left >= h.left - 0.5 && b.right <= h.right + 0.5;
      };
      return { history: Math.round(h.height), faint: inside(".history .faint"), hint: inside(".history .empty + p") };
    });
  const note = (page: Page) => page.getByTestId("undo-note");

  test("after a Clear the mark shows above the Undo note, in Home, back from CAS and after a reload", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page);
    await tap(page, ["d1", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    await tap(page, ["shift", "esc"]);
    await expect(note(page)).toHaveText("History cleared · Undo");
    await expect(page.locator(".history .faint")).toBeVisible();
    expect(await boxes(page)).toMatchObject({ faint: true, hint: true });
    const [fb, nb] = await Promise.all([page.locator(".history .empty + p").boundingBox(), note(page).boundingBox()]);
    expect(fb!.y + fb!.height).toBeLessThanOrEqual(nb!.y); // the note stays the last row, at the foot
    await tap(page, ["@cas"]);
    await expect(page.locator(".history .faint")).toBeVisible();
    await tap(page, ["@home"]);
    await expect(note(page)).toBeVisible();
    await expect(page.locator(".history .faint")).toBeVisible();
    expect(await boxes(page)).toMatchObject({ faint: true, hint: true });
    await page.waitForTimeout(800); // the store write is debounced (400 ms)
    await open(page);
    await expect(note(page)).toHaveText("History cleared · Undo");
    await expect(page.locator(".history .faint")).toBeVisible();
    expect(await boxes(page)).toMatchObject({ faint: true, hint: true });
  });

  test("at 360 × 640 an empty CAS view shows the whole mark and the whole hint", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await open(page);
    await page.evaluate(() => window.n62.session.setView("cas"));
    await expect(page.locator(".history .faint")).toBeVisible();
    const b = await boxes(page);
    expect(b.history).toBeLessThan(160); // a short history: the mark has less than its 128 px plus the hint
    expect(b).toMatchObject({ faint: true, hint: true });
    const h = (await page.locator(".history .faint").boundingBox())!.height;
    expect(h).toBeGreaterThanOrEqual(40);
    expect(h).toBeLessThan(128); // it shrank to the space
  });

  // The history at 915 × 412 is 16 px, under the hint's one line (21 px): the hint cannot lie inside it there (the
  // landscape layout's, not this package's); it keeps its whole line in the scroller, and the mark is left out.
  test("at 915 × 412 the history is too short for the mark: it is left out, the hint keeps its line", async ({ page }) => {
    await page.setViewportSize({ width: 915, height: 412 });
    await open(page);
    await page.evaluate(() => window.n62.session.setView("cas"));
    await expect(page.locator(".history .empty + p")).toBeVisible();
    await expect(page.locator(".history .faint")).toBeHidden();
    const b = await boxes(page);
    expect(b.faint).toBeNull();
    expect(b.history).toBeLessThan(45);
    const hint = (await page.locator(".history .empty + p").boundingBox())!;
    expect(hint.height).toBeGreaterThanOrEqual(18); // never squashed or cut by the empty block
  });

  test("a start with a stored row never puts the mark in the page", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page);
    await tap(page, ["d1", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    await page.waitForTimeout(800); // the store write is debounced (400 ms)
    await page.addInitScript(() => {
      const w = window as unknown as { __faint: number };
      w.__faint = 0;
      new MutationObserver(() => {
        if (document.querySelector(".history .faint")) w.__faint++;
      }).observe(document, { childList: true, subtree: true });
    });
    await open(page);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { __faint: number }).__faint)).toBe(0);
  });
});
