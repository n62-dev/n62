// SPDX-License-Identifier: GPL-3.0-or-later
// R794 (owner's K9, 2026-11-20): the four arrows of the round pad sit on its axes, at one distance from its centre, the
// same size. Measured in pixels (the ink, wherever it is drawn), at 4 device px per CSS px, so a box edge is good to
// 0.25 px: each arrow's ink box centre within 0.5 px of its axis, the four distances equal within 0.5 px, the four boxes
// (along and across their arrow) equal within 0.5 px. The zones keep their hit boxes and names (controls below).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const set = (page: Page, brightness: string): Promise<void> =>
  page.evaluate(async (brightness) => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme({ family: "n62", brightness, contrast: "normal", keys: "colour" } as never, document.documentElement);
  }, brightness);

type Ink = { cx: number; cy: number; along: number; across: number; max: number };

/** The ink box of each arrow, centre as an offset from the circle's centre (CSS px), and the circle's diameter. */
async function arrows(page: Page): Promise<{ d: number; ink: Record<string, Ink> }> {
  const box = await page.locator(".pad .trackpad").boundingBox();
  if (!box) throw new Error("no trackpad");
  const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width) + 2, height: Math.ceil(box.height) + 2 };
  const png = await page.screenshot({ clip, scale: "device" });
  return page.evaluate(
    async ({ b64, clip, box }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const cv = document.createElement("canvas");
      [cv.width, cv.height] = [bmp.width, bmp.height];
      const g = cv.getContext("2d", { willReadFrequently: true });
      if (!g) throw new Error("no canvas");
      g.drawImage(bmp, 0, 0);
      const px = g.getImageData(0, 0, bmp.width, bmp.height).data;
      const s = bmp.width / clip.width; // device px per CSS px
      const [ox, oy] = [(box.x + box.width / 2 - clip.x) * s, (box.y + box.height / 2 - clip.y) * s]; // the circle's centre
      const r = (box.width / 2) * s;
      const at = (x: number, y: number): number[] => [...px.slice((y * bmp.width + x) * 4, (y * bmp.width + x) * 4 + 3)];
      const bg = at(Math.round(ox), Math.round(oy)); // the hub draws nothing: the pad's own colour
      const sectors: Record<string, { diff: number; x: number; y: number }[]> = { up: [], down: [], left: [], right: [] };
      for (let y = 0; y < bmp.height; y++)
        for (let x = 0; x < bmp.width; x++) {
          const [dx, dy] = [x + 0.5 - ox, y + 0.5 - oy];
          if (Math.hypot(dx, dy) > 0.47 * 2 * r) continue; // off the circle's anti-aliased edge
          const p = at(x, y);
          const diff = Math.max(...p.map((v, i) => Math.abs(v - (bg[i] ?? v))));
          const side = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
          sectors[side]?.push({ diff, x, y });
        }
      const ink: Record<string, Ink> = {};
      for (const [id, pts] of Object.entries(sectors)) {
        const max = Math.max(...pts.map((p) => p.diff));
        const on = pts.filter((p) => p.diff >= max / 2);
        const [x0, x1] = [Math.min(...on.map((p) => p.x)), Math.max(...on.map((p) => p.x)) + 1];
        const [y0, y1] = [Math.min(...on.map((p) => p.y)), Math.max(...on.map((p) => p.y)) + 1];
        const [w, h] = [(x1 - x0) / s, (y1 - y0) / s];
        const vertical = id === "up" || id === "down";
        ink[id] = { cx: ((x0 + x1) / 2 - ox) / s, cy: ((y0 + y1) / 2 - oy) / s, along: vertical ? h : w, across: vertical ? w : h, max };
      }
      return { d: box.width, ink };
    },
    { b64: png.toString("base64"), clip, box },
  );
}

const ROUND = (v: number): number => Math.round(v * 100) / 100;

for (const viewport of [
  { width: 412, height: 915 },
  { width: 360, height: 740 },
])
  test.describe(`${viewport.width} × ${viewport.height}`, () => {
    test.use({ viewport, deviceScaleFactor: 4 });
    for (const brightness of ["dark", "light"])
      test(`the pad's four arrows: on its axes, one distance from its centre, one size (N62 ${brightness})`, async ({ page }) => {
        await open(page);
        await set(page, brightness);
        const { d, ink } = await arrows(page);
        const all = Object.entries(ink);
        const said = JSON.stringify({ d: ROUND(d), ink: Object.fromEntries(all.map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, ROUND(b)]))])) });
        for (const [id, a] of all) {
          expect(a.max, `${id}: ink drawn ${said}`).toBeGreaterThan(40);
          const off = id === "up" || id === "down" ? a.cx : a.cy;
          expect(Math.abs(off), `${id}: on its axis ${said}`).toBeLessThanOrEqual(0.5);
        }
        const dist = all.map(([, a]) => Math.hypot(a.cx, a.cy));
        expect(Math.max(...dist) - Math.min(...dist), `one distance ${said}`).toBeLessThanOrEqual(0.5);
        for (const r of dist) expect(r / d, `about a third of the diameter ${said}`).toBeGreaterThan(0.3);
        for (const r of dist) expect(r / d, `about a third of the diameter ${said}`).toBeLessThan(0.36);
        for (const k of ["along", "across"] as const) {
          const v = all.map(([, a]) => a[k]);
          expect(Math.max(...v) - Math.min(...v), `one size, ${k} ${said}`).toBeLessThanOrEqual(0.5);
        }
      });

    // controls: the zones keep their boxes (the four keys tile the pad's grid area as before) and their spoken names
    test("the four zones keep their hit boxes and names; a tap on each moves the cursor", async ({ page }) => {
      await open(page);
      await expect(page.locator('.pad [data-key="sin"]')).toHaveAttribute("aria-description", /Shift/); // (the key names are in)
      const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const id of ["up", "down", "left", "right"]) {
        const b = await page.locator(`.pad [data-key="${id}"]`).boundingBox();
        if (!b) throw new Error(`no ${id}`);
        boxes[id] = b;
        expect(await page.locator(`.pad [data-key="${id}"]`).getAttribute("aria-label")).toBeTruthy();
      }
      const [u, dn, l, rt] = [boxes["up"], boxes["down"], boxes["left"], boxes["right"]];
      if (!u || !dn || !l || !rt) throw new Error("no zones");
      // up and down span the pad's two columns, left and right one each, in three rows: the grid's cells, as on phase-1
      for (const b of [dn, l]) expect(Math.abs(b.x - u.x)).toBeLessThan(1);
      for (const b of [dn, rt]) expect(Math.abs(b.x + b.width - (u.x + u.width))).toBeLessThan(1);
      expect(l.y).toBeGreaterThanOrEqual(u.y + u.height - 1);
      expect(Math.abs(rt.y - l.y)).toBeLessThan(1);
      expect(dn.y).toBeGreaterThanOrEqual(l.y + l.height - 1);
      await tap(page, ["d1", "d2", "left", "d3"]);
      expect(await entryValue(page)).toBe("132");
    });
  });
