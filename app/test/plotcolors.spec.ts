// SPDX-License-Identifier: GPL-3.0-or-later
// R710 (F385): Plot draws its axes, tick numbers and trace dot in the theme's colours. Before: FunctionPlot.svelte gave
// JSXGraph's canvas renderer "var(--muted)", "var(--line)" and "var(--text)"; a canvas cannot resolve a custom property,
// so those strokes came out black (1.3:1 on N62 Dark's ground). Read from the canvas's own pixels, in every look, and
// once more after a look change with Plot open. The curves keep curveColors() (control).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

type Look = [string, "dark" | "light"];
const LOOKS: Look[] = [["n62", "dark"], ["n62", "light"], ["bw", "dark"], ["bw", "light"], ["solarized", "dark"], ["solarized", "light"]];
type Rgb = [number, number, number];

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
  await page.waitForTimeout(300); // the lazy family file is in, the board redrawn
}

/** Function, F1 = x² − 2, Plot; the trace on x = 1 (y = −1, off both axes). */
async function plotParabola(page: Page): Promise<void> {
  await tap(page, ["@symb", "x", "sq", "sub", "d2", "enter", "@plot"]);
  await page.waitForFunction(() => window.n62.plot.board !== undefined);
  await tap(page, Array<string>(10).fill("right"));
  await expect(page.getByTestId("trace-x")).toHaveText("1");
  await page.waitForTimeout(200);
}

/** The first curve colour of each list (app.svelte.ts CURVE_COLORS_DARK, _LIGHT, _N62_LIGHT). */
const firstCurve = (family: string, brightness: string): string => (brightness === "dark" ? "#e8743b" : family === "n62" ? "#cc561c" : "#e56120");

interface Seen {
  tokens: { bg: string; muted: string; text: string };
  /** Opaque pixels on the x axis's line and on the y axis's line (one per device column / row, the most opaque of five). */
  xAxis: Rgb[];
  yAxis: Rgb[];
  /** Opaque pixels of the tick numbers under the x axis, between x = 2 and x = 9.5 (nothing else is drawn there). */
  labels: Rgb[];
  /** The trace dot's centre. */
  dot: Rgb;
  /** The pixels round the curve at x = 3 (y = 7). */
  curve: Rgb[];
  view: string | undefined;
}

/** What the board's canvas shows now, with the root's tokens. */
const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const b = window.n62.plot.board as unknown as { origin: { scrCoords: number[] }; unitX: number; unitY: number };
    const c = document.querySelector<HTMLCanvasElement>(".board canvas");
    if (!c) throw new Error("no canvas");
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    const r = c.width / c.clientWidth;
    const px = (x: number, y: number): [number, number, number, number] => {
      const i = (y * c.width + x) * 4;
      return [d[i]!, d[i + 1]!, d[i + 2]!, d[i + 3]!];
    };
    const [, ox, oy] = b.origin.scrCoords as [number, number, number];
    const OX = Math.round(ox * r), OY = Math.round(oy * r);
    const near = (cx: number, cy: number): boolean => Math.abs(cx - OX) < 12 * r && Math.abs(cy - OY) < 12 * r; // the origin and its "0"
    const best = (pts: [number, number][]): [number, number, number, number] => pts.map(([x, y]) => px(x, y)).reduce((p, q) => (q[3] > p[3] ? q : p));
    const xAxis: [number, number, number][] = [], yAxis: [number, number, number][] = [], labels: [number, number, number][] = [], curve: [number, number, number][] = [];
    for (let x = 0; x < c.width; x++) {
      if (near(x, OY)) continue;
      const p = best([-2, -1, 0, 1, 2].map((k) => [x, OY + k]));
      if (p[3] >= 250) xAxis.push([p[0], p[1], p[2]]);
    }
    for (let y = 0; y < c.height; y++) {
      if (near(OX, y)) continue;
      const p = best([-2, -1, 0, 1, 2].map((k) => [OX + k, y]));
      if (p[3] >= 250) yAxis.push([p[0], p[1], p[2]]);
    }
    for (let y = Math.round((oy + 6) * r); y < Math.round((oy + 24) * r); y++)
      for (let x = Math.round((ox + 2 * b.unitX) * r); x < Math.round((ox + 9.5 * b.unitX) * r); x++) {
        const p = px(x, y);
        if (p[3] >= 250) labels.push([p[0], p[1], p[2]]);
      }
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const p = px(Math.round((ox + 3 * b.unitX) * r) + dx, Math.round((oy - 7 * b.unitY) * r) + dy);
        if (p[3] >= 250) curve.push([p[0], p[1], p[2]]);
      }
    const t = window.n62.shell.loaded.function!.instance as unknown as { traceX: number };
    const fy = t.traceX * t.traceX - 2;
    const dot = px(Math.round((ox + t.traceX * b.unitX) * r), Math.round((oy - fy * b.unitY) * r));
    const s = getComputedStyle(document.documentElement);
    const tok = (n: string): string => s.getPropertyValue(n).trim().toLowerCase();
    return {
      tokens: { bg: tok("--bg"), muted: tok("--muted"), text: tok("--text") },
      xAxis, yAxis, labels, curve,
      dot: [dot[0], dot[1], dot[2]],
      view: document.querySelector<HTMLElement>('[data-testid="place"]')?.dataset["view"],
    };
  });

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const lum = (c: Rgb): number => {
  const l = c.map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!;
};
const contrast = (a: Rgb, b: Rgb): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const dist = (a: Rgb, b: Rgb): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
/** The share of pixels within `tol` of a colour. */
const share = (pts: Rgb[], c: Rgb, tol: number): number => pts.filter((p) => dist(p, c) <= tol).length / Math.max(1, pts.length);
/** The most frequent pixel colour. */
function mode(pts: Rgb[]): Rgb {
  const n = new Map<string, number>();
  for (const p of pts) n.set(p.join(), (n.get(p.join()) ?? 0) + 1);
  const top = [...n].reduce((a, b) => (b[1] > a[1] ? b : a), ["0,0,0", 0] as [string, number]);
  return top[0].split(",").map(Number) as Rgb;
}

/** The axes and their numbers in --muted (≥ 4.5:1 on --bg), the trace dot in --text, the curve in its list's colour. */
function expectInk(s: Seen, family: string, brightness: string): void {
  const muted = rgb(s.tokens.muted), bg = rgb(s.tokens.bg), text = rgb(s.tokens.text);
  for (const [name, pts] of [["x axis", s.xAxis], ["y axis", s.yAxis]] as const) {
    expect(pts.length, `${name}: drawn`).toBeGreaterThan(100);
    // (the tick marks, in --line, and the curve cross the line at a few columns)
    expect(share(pts, muted, 6), `${name}: --muted ${s.tokens.muted}, drawn ${mode(pts).join(",")}`).toBeGreaterThan(0.7);
    expect(contrast(mode(pts), bg), `${name} on --bg ${s.tokens.bg}`).toBeGreaterThanOrEqual(4.5);
  }
  expect(s.labels.length, "tick numbers: drawn").toBeGreaterThan(10);
  expect(share(s.labels, muted, 6), `tick numbers: --muted ${s.tokens.muted}, drawn ${mode(s.labels).join(",")}`).toBeGreaterThan(0.7);
  expect(contrast(mode(s.labels), bg), "tick numbers on --bg").toBeGreaterThanOrEqual(4.5);
  expect(dist(s.dot, text), `trace dot: --text ${s.tokens.text}, drawn ${s.dot.join(",")}`).toBeLessThanOrEqual(6);
  const curve = rgb(firstCurve(family, brightness));
  expect(s.curve.some((p) => dist(p, curve) <= 6), `curve: ${firstCurve(family, brightness)}`).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

for (const [family, brightness] of LOOKS)
  test(`${family} ${brightness}: Plot draws its axes and tick numbers in --muted and the trace dot in --text (R710)`, async ({ page }) => {
    await setLook(page, family, brightness);
    await plotParabola(page);
    expectInk(await seen(page), family, brightness);
  });

test("a look change with Plot open: the axes, numbers and trace dot take the new colours in the same view (R710)", async ({ page }) => {
  await setLook(page, "n62", "dark");
  await plotParabola(page);
  expectInk(await seen(page), "n62", "dark");
  for (const [family, brightness] of [["solarized", "light"], ["bw", "dark"]] as Look[]) {
    await setLook(page, family, brightness);
    const s = await seen(page);
    expect(s.view).toBe("plot");
    expectInk(s, family, brightness);
  }
});
