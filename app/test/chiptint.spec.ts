// SPDX-License-Identifier: GPL-3.0-or-later
// R748: a chip's background lets the selection show and covers tall content. Before: the chip's solid inline background
// was drawn over MathLive's selection, so a selected chip's white text sat on the pale chip colour (nearly invisible),
// and the background painted only the content band, so a matrix chip's brackets stood outside it. Checked on real
// pixels (a screenshot at one pixel per CSS px), not on the styles: (a) a selected decimal chip's glyphs against what is
// behind them, in every look; (b) a tall chip's tint reaches the top and bottom row of its box.
import { inflateSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { lastResult, open, tap, tapTwice } from "./helpers.ts";

const LOOKS: [string, "dark" | "light"][] = [["n62", "dark"], ["n62", "light"], ["bw", "dark"], ["bw", "light"], ["solarized", "dark"], ["solarized", "light"]];
const ready = (page: Page) => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });

/** Put a look on the page as Settings › Appearance does, and wait for its colours (the lazy family file too). */
async function setLook(page: Page, family: string, brightness: "dark" | "light"): Promise<void> {
  await page.evaluate(
    ([f, b]) => {
      const s = window.n62.session;
      s.settings.look = { ...s.settings.look, family: f as typeof s.settings.look.family, brightness: b as "dark" | "light" };
      s.onLook?.({ ...s.settings.look });
    },
    [family, brightness],
  );
  await page.waitForFunction(([f, b]) => document.documentElement.dataset["family"] === f && document.documentElement.dataset["brightness"] === b, [family, brightness]);
  await page.waitForTimeout(300); // the lazy family file is in
}

type Rect = { x: number; y: number; width: number; height: number };
type Rgb = [number, number, number];

/** The box of the first chip: its own box joined with its brackets' (a tall chip's brackets stood outside the old inline box; glyph boxes do not count, they reach past the ink). */
const chipBox = (page: Page): Promise<Rect> =>
  page.evaluate(() => {
    const chip = window.n62.entry.field?.shadowRoot?.querySelector<HTMLElement>('[style*="--chip-"]');
    if (!chip) throw new Error("no chip on the line");
    const all = [chip, ...chip.querySelectorAll('[class*="ML__delim"]')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    const x = Math.min(...all.map((r) => r.left)), y = Math.min(...all.map((r) => r.top));
    return { x, y, width: Math.max(...all.map((r) => r.right)) - x, height: Math.max(...all.map((r) => r.bottom)) - y };
  });

/** The pixels of a region of the page, one per CSS pixel: PNG decoding (8 bit, not interlaced; Playwright's own format). */
async function pixels(page: Page, clip: Rect): Promise<{ w: number; h: number; at: (x: number, y: number) => Rgb }> {
  const png = await page.screenshot({ clip, scale: "css" });
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20), depth = png[24], type = png[25];
  if (depth !== 8 || (type !== 2 && type !== 6) || png[28] !== 0) throw new Error(`unexpected PNG ${depth}/${type}`);
  const bpp = type === 6 ? 4 : 3;
  const idat: Buffer[] = [];
  for (let p = 8; p < png.length; ) {
    const len = png.readUInt32BE(p);
    if (png.toString("latin1", p + 4, p + 8) === "IDAT") idat.push(png.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * bpp);
  const stride = w * bpp;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[y * stride + i - bpp]! : 0;
      const b = y > 0 ? out[(y - 1) * stride + i]! : 0;
      const c = i >= bpp && y > 0 ? out[(y - 1) * stride + i - bpp]! : 0;
      const v = raw[y * (stride + 1) + 1 + i]!;
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : (() => { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })();
      out[y * stride + i] = (v + pred) & 255;
    }
  }
  return { w, h, at: (x, y) => [out[y * stride + x * bpp]!, out[y * stride + x * bpp + 1]!, out[y * stride + x * bpp + 2]!] };
}

const lum = (c: Rgb): number => {
  const l = c.map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!;
};
const contrast = (a: Rgb, b: Rgb): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const dist = (a: Rgb, b: Rgb): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

for (const [family, brightness] of LOOKS)
  test(`(a) ${family} ${brightness}: a selected decimal chip's glyphs are at least 4.5:1 on what is behind them`, async ({ page }, info) => {
    await open(page, "");
    await ready(page);
    await setLook(page, family, brightness);
    await tap(page, ["d1", "div", "d3", "enter"]);
    await expect(lastResult(page)).toHaveAttribute("data-text", "0.333333333333");
    await tapTwice(lastResult(page));
    await tap(page, ["select"]);
    expect(await page.evaluate(() => window.n62.entry.field?.shadowRoot?.querySelector('[style*="--chip-"]')?.classList.contains("ML__selected"))).toBe(true);
    const box = await chipBox(page);
    const px = await pixels(page, { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) });
    const back = px.at(1, Math.floor(px.h / 2)); // the chip's left padding: only what is behind the text
    let glyph = back;
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (contrast(px.at(x, y), back) > contrast(glyph, back)) glyph = px.at(x, y);
    info.attach(`${family}-${brightness}`, { body: await page.locator("math-field").first().screenshot(), contentType: "image/png" });
    expect(contrast(glyph, back), `glyph ${glyph} on ${back}`).toBeGreaterThanOrEqual(4.5);
  });

for (const [family, brightness] of [["n62", "light"], ["n62", "dark"], ["bw", "dark"]] as const)
  test(`(b) ${family} ${brightness}: a matrix chip's tint reaches the top and the bottom row of its box, brackets inside`, async ({ page }, info) => {
    await open(page, "");
    await setLook(page, family, brightness);
    await page.evaluate(() => window.n62.entry.insertResult("\\begin{bmatrix}0.5&1.25\\\\2&3\\end{bmatrix}", { value: "[[0.5,1.25],[2,3]]", exact: false }));
    await page.waitForTimeout(150);
    const box = await chipBox(page);
    expect(box.height).toBeGreaterThan(50); // tall: the two rows and their brackets
    const pad = 6;
    const px = await pixels(page, { x: Math.floor(box.x) - pad, y: Math.floor(box.y), width: Math.ceil(box.width) + 2 * pad, height: Math.ceil(box.height) });
    info.attach(`matrix-${family}-${brightness}`, { body: await page.locator("math-field").first().screenshot(), contentType: "image/png" });
    const outside = px.at(1, Math.floor(px.h / 2)); // the field's own ground, left of the chip
    const x = pad + Math.floor(box.width / 2);
    const tint = px.at(pad + 1, Math.floor(px.h / 2)); // the chip's left padding at mid-height: the tint over the ground
    expect(dist(tint, outside), "the tint shows on the ground").toBeGreaterThanOrEqual(2);
    // the first and the last pixel row inside the box (the clip starts at the box's floor)
    for (const y of [Math.ceil(box.y) - Math.floor(box.y), Math.floor(box.y + box.height) - Math.floor(box.y) - 1])
      expect(dist(px.at(x, y), tint), `row ${y} of ${px.h}`).toBeLessThanOrEqual(1);
  });
