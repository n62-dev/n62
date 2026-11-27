// SPDX-License-Identifier: GPL-3.0-or-later
// R153 (owner, 2026-11-07, docs/archive/mockups/n62-teal-2026-11-07.html): N62 is the teal family, one colour family on the
// logo's hue; the black-and-white family that was N62 stays as Black & White (`bw`); R150's Teal is gone.
import { describe, expect, it } from "vitest";
import { FAMILIES } from "./theme-families.ts";
import { combos, KEYS, selector, theme } from "./theme-gen.ts";

/** OKLCH chroma and hue (degrees) of #rrggbb (Ottosson's OKLab, polar). */
function oklch(h: string): [number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const s = parseInt(h.slice(i, i + 2), 16) / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

/** The owner's table (R153), the roles the plain blocks must carry. */
const TABLE = {
  dark: { bg: "#092726", "key-num": "#194241", "key-fn": "#123736", "key-enter": "#529997", text: "#ebf6f6", shift: "#ffa800", alpha: "#6ae5e2" },
  light: { bg: "#cae6e5", "key-num": "#eefaf9", "key-fn": "#d7efee", "key-enter": "#c26a00", text: "#062424", shift: "#a03f00", alpha: "#005b5a" },
} as const;
/** The generator's moves of the table's roles above (theme-gen.ts, R140): N62 Light's Shift #a03f00 and Alpha #005b5a are
 *  0.099 apart for protanopia (floor 0.12), so Shift moves darker until they are not. The family data keeps the table's value. */
const MOVED: Record<"dark" | "light", Record<string, string>> = { dark: {}, light: { shift: "#5b2400" } };

/** Phase-1's N62 start blocks (style.css before R153): Black & White must draw exactly these, but for Enter (R872: the one white key in Dark, black in Light). */
const OLD_N62 = {
  dark: { bg: "#000000", panel: "#0c1011", line: "#2a3536", "key-num": "#1b2122", "key-op": "#121718", "key-fn": "#121718", "key-ctl": "#121718", "key-nav": "#121718", "key-enter": "#e6ebeb", "on-enter": "#000000", text: "#eef2f2", "text-dead": "#6f7d7e", muted: "#a7b4b4", shift: "#ff9a33", alpha: "#529997", error: "#ff7b72", "chip-bg": "#163231", approx: "#539b99", warn: "#f2c94c", pick: "#1c2b2b", focus: "#529997", "key-on": "#529997", "on-key-on": "#000000", "key-text": "#eef2f2", "key-muted": "#a7b4b4", "key-text-dead": "#6f7d7e", "key-shift": "#ff9a33", "key-alpha": "#529997", "key-pfx": "#1e2829", "on-error": "#000000", "on-shift": "#000000", "on-alpha": "#000000", "on-key-shift": "#000000", "on-key-alpha": "#000000" },
  light: { bg: "#f4f6f6", panel: "#e8eded", line: "#b9c6c6", "key-num": "#ffffff", "key-op": "#e6ecec", "key-fn": "#e6ecec", "key-ctl": "#e6ecec", "key-nav": "#e6ecec", "key-enter": "#1b2122", "on-enter": "#ffffff", text: "#0b1213", "text-dead": "#687474", muted: "#44504f", shift: "#a14600", alpha: "#2e706e", error: "#aa241d", "chip-bg": "#d6e8e6", approx: "#286160", warn: "#725400", pick: "#b9d6d4", focus: "#2e706e", "key-on": "#2e706e", "on-key-on": "#ffffff", "key-text": "#0b1213", "key-muted": "#44504f", "key-text-dead": "#687474", "key-shift": "#a14600", "key-alpha": "#2e706e", "key-pfx": "#d9e9e8", "on-error": "#ffffff", "on-shift": "#ffffff", "on-alpha": "#ffffff", "on-key-shift": "#ffffff", "on-key-alpha": "#ffffff" },
} as const;

/** R933 (owner, 2026-11-24): Black & White Light's four non-digit fills darken until they stand --key-num's contrast to the
 *  keypad less 0.05; Alpha #2e706e falls to 4.26:1 on them and darkens to its 4.5 floor, Shift then moves from it as R140 holds
 *  them apart, and the prefix cells follow the new colours (withPfx). Dark is not part of R933. Every other role is phase-1's. */
const R933_MOVED: Record<"dark" | "light", Record<string, string>> = {
  dark: {},
  light: { "key-op": "#d9dfdf", "key-fn": "#d9dfdf", "key-ctl": "#d9dfdf", "key-nav": "#d9dfdf", alpha: "#2c6b69", "key-alpha": "#2c6b69", shift: "#9c4400", "key-shift": "#9c4400", "key-pfx": "#cfe2e2" },
};

describe("R153: N62 in teal", () => {
  it("the families are n62, bw, solarized, named N62, Black & White, Solarized", () => {
    expect(FAMILIES.map((f) => f.id)).toEqual(["n62", "bw", "solarized"]);
    expect(FAMILIES.map((f) => f.name)).toEqual(["N62", "Black & White", "Solarized"]);
  });
  for (const b of ["dark", "light"] as const)
    it(`N62 ${b}: the plain block carries the table's bg, key-num, key-fn, key-enter, text, shift and alpha (the generator's moves named)`, () => {
      const { t } = theme({ family: "n62", brightness: b, high: false, plain: false });
      const want = { ...TABLE[b], ...MOVED[b] };
      expect(Object.fromEntries(Object.keys(want).map((r) => [r, t[r]]))).toEqual(want);
      const fam = FAMILIES.find((f) => f.id === "n62")?.[b] ?? {};
      expect(Object.fromEntries(Object.keys(TABLE[b]).map((r) => [r, fam[r]]))).toEqual(TABLE[b]); // the source holds the table
    });
  it("Enter is the logo teal #529997 in Dark and the owner's orange #c26a00 in Light (R843), each with a black label", () => {
    for (const [b, fill] of [["dark", "#529997"], ["light", "#c26a00"]] as const) {
      const { t } = theme({ family: "n62", brightness: b, high: false, plain: false });
      expect([t["key-enter"], t["on-enter"]], b).toEqual([fill, "#000000"]);
    }
  });
  const [, HUE] = oklch("#529997");
  const OUTSIDE = /^(shift|key-shift|warn|error)$|^on-/;
  for (const c of combos().filter((x) => x.family === "n62"))
    it(`${selector(c)}: every coloured role but Shift, ⚠, the error${c.brightness === "light" && !c.plain ? " and Enter (R843)" : ""} has the logo's hue (within 8°)`, () => {
      const { t } = theme(c);
      const enterOut = c.brightness === "light" && !c.plain; // R843: Light's Enter is orange; Plain keys draws Enter in the text colour
      const off = Object.entries(t)
        .filter(([r, v]) => !OUTSIDE.test(r) && !(enterOut && r === "key-enter") && v !== "#000000" && v !== "#ffffff" && oklch(v)[0] >= 0.02)
        .map(([r, v]) => [r, v, Math.abs(((oklch(v)[1] - HUE + 540) % 360) - 180)] as const)
        .filter(([, , d]) => d > 8);
      expect(off).toEqual([]);
      // the screen, the keys and the lines are teal, not grey (High contrast nears black or white)
      if (!c.high) for (const r of ["bg", "line", "key-fn"]) expect(oklch(t[r] as string)[0], r).toBeGreaterThanOrEqual(0.02);
    });
  for (const b of ["dark", "light"] as const)
    it(`Black & White ${b} is phase-1's N62 ${b}, role for role (but R933's moves, named)`, () => {
      const { t } = theme({ family: "bw", brightness: b, high: false, plain: false });
      const { ring: _ring, "key-edge": _edge, "key-disc": _pad, "mark-faint": _mark, sel: _sel, "on-sel": _onSel, edge: _accent, "row-alt": _alt, ...old } = t; // R872's --edge (the teal the prefix cells keep beside a white or black Enter), R154's --ring, R156's --key-edge, R873's --key-disc, R157's --mark-faint, R274's --sel and --on-sel and R742's --row-alt are new; every other role is phase-1's
      expect(old).toEqual({ ...OLD_N62[b], ...R933_MOVED[b] });
    });
});

// R795 (owner, 2026-11-20, K3): Plain keys drops only the colour coding of the legends; every key keeps its family's fill,
// in N62 and Solarized, Dark and Light, normal and High contrast. The dark families' fills keep their colour (OKLCH chroma 0.03 at least).
describe("R795: Plain keys keeps each family's key colours", () => {
  for (const c of combos().filter((x) => x.plain && x.family !== "bw"))
    it(`${selector(c)}: every key fill is the one without Plain keys`, () => {
      const { t } = theme(c);
      const { t: own } = theme({ ...c, plain: false });
      expect(Object.fromEntries(KEYS.map((k) => [k, t[k]]))).toEqual(Object.fromEntries(KEYS.map((k) => [k, own[k]])));
      if (c.brightness === "dark" && !c.high) for (const k of ["key-num", "key-op"]) expect(oklch(t[k] as string)[0], k).toBeGreaterThanOrEqual(0.03);
    });
});

// R795 for Black & White: the criteria say "Black & White is unchanged", so its Plain keys keeps phase-1's two neutral
// tones (theme-gen.ts PLAIN_TWO_TONE). The values are phase-1's, from `git show phase-1:app/src/theme/bw.css` (the four
// [data-keys="plain"] blocks, before R795); a change here is the owner's call (decisions.md "Needs the user").
const BW_PLAIN: Record<string, Record<string, string>> = {
  "dark normal": { "key-num": "#1d1f20", "key-op": "#0f1010", "key-fn": "#0f1010", "key-ctl": "#0f1010", "key-nav": "#0f1010", "chip-bg": "#0f1010", line: "#2a3536" },
  "dark high": { "key-num": "#101112", "key-op": "#080909", "key-fn": "#080909", "key-ctl": "#080909", "key-nav": "#080909", "chip-bg": "#0a0a0a", line: "#5f6868" },
  "light normal": { "key-num": "#ffffff", "key-op": "#fafbfb", "key-fn": "#fafbfb", "key-ctl": "#fafbfb", "key-nav": "#fafbfb", "chip-bg": "#fafbfb", line: "#b9c6c6" },
  "light high": { "key-num": "#ffffff", "key-op": "#fdfdfd", "key-fn": "#fdfdfd", "key-ctl": "#fdfdfd", "key-nav": "#fdfdfd", "chip-bg": "#fcfcfc", line: "#8a9494" },
};
describe("R795: Black & White's Plain keys is phase-1's, pinned", () => {
  const bw = combos().filter((x) => x.plain && x.family === "bw");
  it("covers the four combinations", () => expect(bw).toHaveLength(4));
  for (const c of bw)
    it(`${selector(c)}: key fills, --chip-bg and --line`, () => {
      const { t } = theme(c);
      const want = BW_PLAIN[`${c.brightness} ${c.high ? "high" : "normal"}`] ?? {};
      expect(Object.fromEntries(Object.keys(want).map((k) => [k, t[k]]))).toEqual(want);
    });
});
