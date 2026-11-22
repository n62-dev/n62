// SPDX-License-Identifier: GPL-3.0-or-later
// R792 (owner K5): under High contrast every key at rest has a 1.5 px outline just inside its edge (theme/modes.css); the
// Shift legend sits on the key's top edge, so the outline ran through its letters. The pad is shot with and without the
// outline (a style injected that removes it), and once more with the Shift legends transparent: no pixel of a legend's
// ink may change with the outline. Ink, not the whole box: the box's top-left corner meets the outline's rounded corner,
// which is the key's ground. Controls: no key face or Alpha legend moves with High contrast, a Shift legend moves only
// down and its ink meets no face's ink. 412 and 360 px, N62 Dark and Light.
import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers.ts";

const set = (page: Page, brightness: "dark" | "light", contrast: "normal" | "high"): Promise<void> =>
  page.evaluate(
    async ([brightness, contrast]) => {
      const url = "/src/theme/apply.ts";
      const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
      await m.applyTheme(
        { family: "n62", brightness: brightness as "dark", contrast: contrast as "normal", keys: "colour" },
        document.documentElement,
      );
      await document.fonts.ready;
    },
    [brightness, contrast],
  );

type Box = number[];
/** Every box of `sel` inside the pad, in CSS px of the page. */
const boxes = (page: Page, sel: string): Promise<Box[]> =>
  page.evaluate(
    (s) =>
      [...document.querySelectorAll(`.pad .key[data-key] ${s}`)]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => [r.x, r.y, r.width, r.height]),
    sel,
  );

const NO_OUTLINE = ".key, .trackpad { outline: none !important; }";
const NO_LEGEND = ".shiftlegend, .shiftlegend::after { color: transparent !important; }";
const NO_FACE = ".main, .main::after { color: transparent !important; }";

/** The pad as a PNG (base64), shot with these styles injected. */
async function shot(page: Page, ...css: string[]): Promise<string> {
  const pad = (await page.locator(".pad").boundingBox())!;
  const tags = await Promise.all(css.map((content) => page.addStyleTag({ content })));
  const png = await page.screenshot({ clip: pad, animations: "disabled" });
  for (const t of tags) await t.evaluate((el) => (el as Element).remove());
  return png.toString("base64");
}

/** Device pixels inside the Shift legends' boxes where `base` differs from `a` by more than `by[0]` in a channel and from
 *  `b` by more than `by[1]`. Ink is a pixel that hiding its text changes by more than 32 levels (a translated legend
 *  shifts the ground under its box by a few levels). */
async function both(page: Page, base: string, a: string, b: string, by: [number, number]): Promise<number> {
  const pad = (await page.locator(".pad").boundingBox())!;
  const legends = await boxes(page, ".shiftlegend");
  expect(legends.length).toBeGreaterThan(20);
  return page.evaluate(
    async ({ shots, by, legends, pad }) => {
      const decode = async (b64: string): Promise<ImageData> => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const cv = document.createElement("canvas");
        [cv.width, cv.height] = [bmp.width, bmp.height];
        const g = cv.getContext("2d", { willReadFrequently: true });
        if (!g) throw new Error("no canvas");
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [p, q, r] = await Promise.all(shots.map(decode));
      const differ = (u: ImageData, v: ImageData, o: number, d: number): boolean =>
        [0, 1, 2].some((c) => Math.abs(u.data[o + c]! - v.data[o + c]!) > d);
      const k = p!.width / pad.width; // device pixels per CSS px
      let n = 0;
      for (const [x, y, w, h] of legends) {
        const [x0, y0] = [Math.floor((x! - pad.x) * k), Math.floor((y! - pad.y) * k)];
        const [x1, y1] = [Math.ceil((x! + w! - pad.x) * k), Math.ceil((y! + h! - pad.y) * k)];
        for (let j = Math.max(0, y0); j < Math.min(p!.height, y1); j++)
          for (let i = Math.max(0, x0); i < Math.min(p!.width, x1); i++) {
            const o = (j * p!.width + i) * 4;
            if (differ(p!, q!, o, by[0]) && differ(p!, r!, o, by[1])) n++;
          }
      }
      return n;
    },
    { shots: [base, a, b], by, legends, pad },
  );
}

for (const width of [412, 360]) {
  for (const brightness of ["dark", "light"] as const) {
    test(`High contrast at ${width} px, N62 ${brightness}: no outline pixel on a Shift legend; faces and Alpha legends stay`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 412 ? 915 : 800 });
      await open(page);
      await set(page, brightness, "normal");
      const [faces, alphas, shifts] = [await boxes(page, ".main"), await boxes(page, ".alphalegend"), await boxes(page, ".shiftlegend")];
      await set(page, brightness, "high");
      expect(await page.locator('[data-key="x"]').evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
      // legend ink (changed by hiding the legends) that the outline changes (any change)
      const bare = await shot(page, NO_OUTLINE);
      expect(await both(page, bare, await shot(page, NO_OUTLINE, NO_LEGEND), await shot(page), [32, 0])).toBe(0);
      // the controls: High contrast moves no face and no Alpha legend; a Shift legend moves straight down, no more than 3 px
      expect(await boxes(page, ".main")).toEqual(faces);
      expect(await boxes(page, ".alphalegend")).toEqual(alphas);
      const moved = await boxes(page, ".shiftlegend");
      expect(moved.length).toBe(shifts.length);
      moved.forEach(([x, y, w, h], i) => {
        const [x0, y0, w0, h0] = shifts[i]!;
        expect([x, w, h]).toEqual([x0, w0, h0]);
        expect(y! - y0!).toBeGreaterThanOrEqual(0);
        expect(y! - y0!).toBeLessThanOrEqual(3);
      });
      // the moved legend touches no face: no pixel is ink of both (the boxes overlap already: a face's line box is taller)
      expect(await both(page, bare, await shot(page, NO_OUTLINE, NO_LEGEND), await shot(page, NO_OUTLINE, NO_FACE), [32, 32])).toBe(0);
    });
  }
}
