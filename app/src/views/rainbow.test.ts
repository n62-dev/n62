// SPDX-License-Identifier: GPL-3.0-or-later
// R881: the rainbow egg's palette (views/rainbowPalette.ts) in every theme combination (every family, light and dark, with
// High contrast and Plain keys), at start hues 0–330° in steps of 30: every key face against its texts stays at 4.5:1 (a
// dimmed face 3:1), unturned and under the keypad's hue-rotate at 0–330°; the faces keep their token's OKLCH lightness and
// change colour; the history's wash keeps its texts at their floor. contrast() and the matrix are this test's own, not the module's.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast } from "../style.test.ts";
import { FACES, keyColours, keyHues, keyTexts, oklch, washOf, WASH_TEXTS } from "./rainbowPalette.ts";

/** Every theme block of style.css and the family files: its selector and its `--name: #rrggbb` tokens. */
const blocks: [string, Record<string, string>][] = ["../style.css", ...["n62", "bw", "solarized"].map((f) => `../theme/${f}.css`)].flatMap((f) =>
  [...readFileSync(new URL(f, import.meta.url), "utf8").matchAll(/:root(\[data-family="[a-z0-9]+"\]\[data-brightness="(?:dark|light)"\](?:\[data-[a-z]+="[a-z]+"\])*)\s*\{([^}]*)\}/g)].map(
    (m): [string, Record<string, string>] => [m[1] as string, Object.fromEntries([...(m[2] as string).matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((t) => [t[1] as string, (t[2] as string).toLowerCase()]))],
  ),
);

/** CSS `filter: hue-rotate(deg)` on an sRGB colour (Filter Effects 1, 13.1.1), clamped. */
function rotate(hex: string, deg: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const c = Math.cos((deg * Math.PI) / 180);
  const s = Math.sin((deg * Math.PI) / 180);
  const m = [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ];
  return `#${m.map(([x, y, z]) => Math.round(Math.min(1, Math.max(0, (x as number) * r + (y as number) * g + (z as number) * b)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** A keypad's grid cells (rows 1–10, columns 1–12, as Keypad.svelte places its keys). */
const GRID = Array.from({ length: 10 }, (_, r) => Array.from({ length: 12 }, (_, c) => [r + 1, c + 1] as const)).flat();
const STARTS = Array.from({ length: 12 }, (_, i) => i * 30);
const TURNS = STARTS;

it("reads the 24 theme combinations", () => expect(blocks).toHaveLength(24));

for (const [sel, t] of blocks)
  describe(`the rainbow palette, ${sel}`, () => {
    const hues = [...new Set(STARTS.flatMap((s) => keyHues(GRID, s)))];
    it("every key face against its texts: at least 4.5:1 (a dimmed face 3:1) at every start hue, unturned and turned 0–330°", () => {
      const low: string[] = [];
      const drawn = keyTexts(t);
      for (const h of hues) {
        const faces = keyColours(t, h);
        for (const [face, texts] of Object.entries(FACES))
          for (const [text, floor] of texts)
            for (const d of TURNS) {
              const r = contrast(rotate(drawn[text] as string, d), rotate(faces[face] as string, d));
              if (r < floor) low.push(`--${text} on --${face} at hue ${h}, turned ${d}°: ${r.toFixed(2)}`);
            }
      }
      expect(low).toEqual([]);
    });
    it("each face keeps its token's OKLCH lightness (a grey one, where no hue keeps the floor, moves at most 0.1); the faces change colour round the wheel", () => {
      const seen = new Set<string>();
      for (const h of hues) {
        const faces = keyColours(t, h);
        for (const face of Object.keys(FACES)) {
          const [L, C] = oklch(faces[face] as string);
          expect(Math.abs(L - oklch(t[face] as string)[0]), `--${face} at hue ${h}`).toBeLessThan(C > 0.005 ? 0.02 : 0.1 + 1e-6);
          seen.add(faces[face] as string);
        }
      }
      expect(seen.size).toBeGreaterThan(Object.keys(FACES).length * 6);
    });
    it("the key texts lose their hue (grey, which hue-rotate leaves as it is) and keep their lightness within 0.1", () => {
      for (const [x, c] of Object.entries(keyTexts(t))) {
        expect(Math.abs(oklch(c)[0] - oklch(t[x] as string)[0]), `--${x}`).toBeLessThanOrEqual(0.1 + 1e-6);
        for (const d of TURNS) expect(rotate(c, d), `--${x} turned ${d}°`).toBe(c);
      }
    });
    it("the keys' hues run along the diagonal: row + column, from the start hue", () => {
      const [first, right, below, last] = keyHues([[1, 1], [1, 2], [2, 1], [10, 12]], 90);
      expect([first, last]).toEqual([90, (90 + 330) % 360]);
      expect(right).toBe(below);
      expect(right).toBeGreaterThan(90);
    });
    it("the history's wash keeps its texts at 4.5:1 (7:1 where they had it on --bg) at every start hue", () => {
      const low: string[] = [];
      for (const s of STARTS)
        for (const w of washOf(t, s))
          for (const x of WASH_TEXTS) {
            const floor = contrast(t[x] as string, t["bg"] as string) >= 7 ? 7 : 4.5;
            if (contrast(t[x] as string, w) < floor) low.push(`--${x} on ${w} (start ${s}): ${contrast(t[x] as string, w).toFixed(2)}`);
          }
      expect(low).toEqual([]);
    });
  });
