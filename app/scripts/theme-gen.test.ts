// SPDX-License-Identifier: GPL-3.0-or-later
// The generated theme files are current, and all 24 combinations meet the contrast rules (report section 2).
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILIES } from "./theme-families.ts";
import { apart, CVD, type Mat } from "./cvd.ts";
import { LAYER_APART, WARN_APART, block, checks, combos, cr, dimmedOk, expected, familyPath, outOfDate, selector, styleFile, theme } from "./theme-gen.ts";

describe("generated theme files", () => {
  it("are up to date (run npm run themes)", () => {
    expect(outOfDate()).toEqual([]);
  });
  it("a hand edit of a generated file is detected", () => {
    const p = familyPath("solarized");
    const before = readFileSync(p, "utf8");
    try {
      writeFileSync(p, before.replace("--bg: #2d4056", "--bg: #2d4057"));
      expect(outOfDate()).toEqual([p]);
    } finally {
      writeFileSync(p, before);
    }
    expect(outOfDate()).toEqual([]);
  });
  it("style.css keeps everything but N62's two start blocks", () => {
    const src = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    expect(styleFile(src)).toBe(src);
    expect(expected().size).toBe(4); // style.css and the three families
  });
});

const CURVES = readFileSync(new URL("../src/apps/function/app.svelte.ts", import.meta.url), "utf8");
const curves = (b: "dark" | "light" | "n62_light"): string[] => [...(new RegExp(`CURVE_COLORS_${b.toUpperCase()}\\s*=\\s*\\[([^\\]]*)\\]`).exec(CURVES)?.[1] ?? "").matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);

describe("all 24 combinations", () => {
  it("are 24: n62, bw, solarized in this order", () => {
    expect(combos()).toHaveLength(24);
    expect(FAMILIES.map((f) => f.id)).toEqual(["n62", "bw", "solarized"]);
  });
  for (const c of combos())
    describe(selector(c), () => {
      const { t } = theme(c);
      it("meets every pair of the contrast rules and keeps a dead face dimmer", () => {
        const bad = checks(t, c.high).filter((x) => x.v < x.min);
        expect(bad.map((x) => `${x.l} ${x.v.toFixed(2)} < ${x.min}`)).toEqual([]);
        expect(dimmedOk(t)).toBe(true);
      });
      it("--on-error on --error is at least 4.5:1", () => {
        expect(cr(t["on-error"] as string, t["error"] as string)).toBeGreaterThanOrEqual(4.5);
      });
      it("each curve colour is at least 3:1 on --bg", () => {
        for (const col of curves(c.family === "n62" && c.brightness === "light" ? "n62_light" : c.brightness)) expect(cr(col, t["bg"] as string), `${col} on --bg`).toBeGreaterThanOrEqual(3);
      });
    });
});

// R140: colour-vision checks (scripts/cvd.ts) and the key colours.
describe("R140: Shift, Alpha and ⚠ stay apart", () => {
  it("the formula reproduces the measured pair (N62 Dark, #ff9a33 / #529997, protanopia 0.156)", () => {
    expect(apart("#ff9a33", "#529997", CVD["protanopia"] as Mat)).toBeCloseTo(0.156, 2);
  });
  // Plain keys draws Shift and Alpha in the text colour on purpose (no colour coding), so it has no colour to tell apart.
  // High contrast has lower floors (theme-gen.ts LAYER_APART): 7:1 for all of them leaves little room.
  for (const c of combos().filter((x) => !x.plain))
    it(`${selector(c)}: Shift and Alpha at least ${LAYER_APART[c.high ? "high" : "normal"]} apart for protanopia, deuteranopia and tritanopia`, () => {
      const { t } = theme(c);
      for (const [name, m] of Object.entries(CVD)) expect(apart(t["shift"] as string, t["alpha"] as string, m), name).toBeGreaterThanOrEqual(LAYER_APART[c.high ? "high" : "normal"]);
    });
  // The legends on the keys (key-shift, key-alpha) are moved by their own branch of withLayersApart (a family with key twins splits them from the screen's).
  for (const c of combos().filter((x) => !x.plain))
    it(`${selector(c)}: the key legends key-shift and key-alpha at least ${LAYER_APART[c.high ? "high" : "normal"]} apart for protanopia, deuteranopia and tritanopia`, () => {
      const { t } = theme(c);
      for (const [name, m] of Object.entries(CVD)) expect(apart(t["key-shift"] as string, t["key-alpha"] as string, m), name).toBeGreaterThanOrEqual(LAYER_APART[c.high ? "high" : "normal"]);
    });
  // moveUntil (theme-gen.ts) returns the colour unchanged when no step meets the floor; this test is what catches that.
  for (const c of combos().filter((x) => !x.plain))
    it(`${selector(c)}: ⚠ and Shift at least ${WARN_APART[c.high ? "high" : "normal"]} apart (normal vision)`, () => {
      const { t } = theme(c);
      expect(apart(t["warn"] as string, t["shift"] as string)).toBeGreaterThanOrEqual(WARN_APART[c.high ? "high" : "normal"]);
    });
});

describe("R150: color-scheme follows the screen's text", () => {
  const read = (p: string): string => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
  /** [brightness named in the selector, color-scheme] of each block. */
  const schemes = (src: string): [string, string][] =>
    [...src.matchAll(/:root\[[^{]*data-brightness="(dark|light)"[^{]*\{[^}]*?color-scheme: (light|dark);/g)].map((m) => [m[1] as string, m[2] as string]);
  it("every family keeps dark for Dark and light for Light", () => {
    for (const p of ["theme/n62.css", "theme/bw.css", "theme/solarized.css", "style.css"]) {
      const s = schemes(read(p));
      expect(s.length, p).toBeGreaterThan(0);
      for (const [b, scheme] of s) expect(scheme, p).toBe(b);
    }
  });
  it("block() writes the same for every combination", () => {
    for (const c of combos()) expect(block(c)).toContain(`color-scheme: ${c.brightness};\n`);
  });
});

describe("R140: Shift, Alpha, Fmt, ⌫ and the pad wear the other keys' colour", () => {
  for (const c of combos())
    it(`${selector(c)}: --key-ctl is --key-fn; --on-shift and --on-alpha read on the armed key`, () => {
      const { t } = theme(c);
      expect(t["key-ctl"]).toBe(t["key-fn"]);
      expect(cr(t["on-shift"] as string, t["shift"] as string), "on-shift").toBeGreaterThanOrEqual(4.5);
      expect(cr(t["on-alpha"] as string, t["alpha"] as string), "on-alpha").toBeGreaterThanOrEqual(4.5);
      expect(["#000000", "#ffffff"]).toContain(t["on-shift"]);
      expect(["#000000", "#ffffff"]).toContain(t["on-alpha"]);
    });
  it("the family data gives every family one colour for both", () => {
    for (const f of FAMILIES) for (const b of ["dark", "light"] as const) expect(f[b]["key-ctl"], `${f.id} ${b}`).toBe(f[b]["key-fn"]);
  });
});

describe("R140: the Dark background outside the generated CSS is N62 Dark's --bg", () => {
  const bg = theme({ family: "n62", brightness: "dark", high: false, plain: false }).t["bg"] as string;
  const repo = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  /** The colour a pattern's one group finds in a repo file, lower case. */
  const found = (p: string, re: RegExp): string | undefined => re.exec(repo(p))?.[1]?.toLowerCase();
  it("the first-paint block of style.css", () => {
    expect(found("app/src/style.css", /\[data-family="n62"\]\[data-brightness="dark"\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})/i)).toBe(bg);
  });
  it("the swatch dots start with it", () => {
    expect(found("app/src/theme/lookView.ts", /id: "n62", name: "N62", dots: \["(#[0-9a-f]{6})"/i)).toBe(bg);
  });
  it("Capacitor's window colour and Android's colour", () => {
    expect(found("app/capacitor.config.ts", /backgroundColor: '(#[0-9a-f]{6})'/i)).toBe(bg);
    expect(found("android/app/src/main/res/values/colors.xml", /name="n62_dark_bg">(#[0-9a-f]{6})</i)).toBe(bg);
  });
  it("the page's theme-color and the manifest's colours", () => {
    expect(found("app/index.html", /name="theme-color" content="(#[0-9a-f]{6})"/i)).toBe(bg);
    const m = JSON.parse(repo("app/public/manifest.webmanifest")) as Record<string, string>;
    expect([m["background_color"]?.toLowerCase(), m["theme_color"]?.toLowerCase()]).toEqual([bg, bg]);
  });
});

describe("R140: the tip bubble takes the Shift colours, not a literal amber", () => {
  it("tips.css has no #ffc233 and uses --shift / --on-shift", () => {
    const css = readFileSync(new URL("../src/views/tips.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/#ffc233|#0b1020/i);
    expect(css).toMatch(/var\(--shift\)/);
    expect(css).toMatch(/var\(--on-shift\)/);
  });
});

// R150: the key twins (theme-gen.ts TWINS). R150's Teal used them; since R153 no family does.
describe("R150: key-text and the other key twins", () => {
  const TWINNED = ["text", "muted", "text-dead", "shift", "alpha"] as const;
  it("no family gives a key twin of its own (R153: key and screen share the roles)", () => {
    for (const f of FAMILIES) for (const b of ["dark", "light"] as const) for (const r of TWINNED) expect(f[b][`key-${r}`], `${f.id} ${b} key-${r}`).toBeUndefined();
  });
  it("every family has every twin equal to its role, in every combination", () => {
    for (const c of combos()) {
      const { t } = theme(c);
      for (const r of TWINNED) expect(t[`key-${r}`], `${selector(c)} key-${r}`).toBe(t[r]);
    }
  });
  it("the key-text role checked against the keys is in the audit", () => {
    const cs = checks(theme({ family: "n62", brightness: "dark", high: false, plain: false }).t, false);
    expect(cs.some((x) => x.f === "key-text" && x.b === "key-num")).toBe(true);
  });
});

describe("R156: --key-edge, the line under each key (Key shadows)", () => {
  const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  it("is black in every dark combination and black at 30 % over the final --bg in every light one, as an opaque colour", () => {
    for (const c of combos()) {
      const { t } = theme(c);
      const edge = t["key-edge"] ?? "";
      expect(edge, selector(c)).toMatch(/^#[0-9a-f]{6}$/);
      if (c.brightness === "dark") expect(edge, selector(c)).toBe("#000000");
      else rgb(edge).forEach((v, i) => expect(Math.abs(v - (rgb(t["bg"] ?? "")[i] as number) * 0.7), selector(c)).toBeLessThanOrEqual(0.5));
    }
  });
  it("N62 Light's is #8da1a0, and both start blocks carry it", () => {
    expect(theme({ family: "n62", brightness: "light", high: false, plain: false }).t["key-edge"]).toBe("#8da1a0");
    const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    expect(css).toContain("--key-edge: #000000;");
    expect(css).toContain("--key-edge: #8da1a0;");
    expect(css).toMatch(/--key-shadow: 2px;/);
  });
});

describe("R157: --mark-faint, the faint mark on an empty history", () => {
  const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixed = (a: string, b: string, k: number): number[] => rgb(a).map((v, i) => v + ((rgb(b)[i] as number) - v) * k);
  it("is 30 % black over --bg in a dark combination and 7 % of --text over it in a light one, as an opaque colour, at most 1.3:1 on --bg and not lost", () => {
    for (const c of combos()) {
      const { t } = theme(c);
      const m = t["mark-faint"] ?? "";
      expect(m, selector(c)).toMatch(/^#[0-9a-f]{6}$/);
      const r = cr(m, t["bg"] ?? "");
      expect(r, selector(c)).toBeLessThanOrEqual(1.3);
      expect(r, selector(c)).toBeGreaterThanOrEqual(1.05);
      const near = (w: number[]): boolean => rgb(m).every((v, i) => Math.abs(v - (w[i] as number)) <= 0.5);
      const black = [0.3, 0.29, 0.28, 0.27, 0.26, 0.25, 0.24, 0.23, 0.22, 0.21, 0.2].some((k) => near(mixed(t["bg"] ?? "", "#000000", k)));
      expect(black || near(mixed(t["bg"] ?? "", t["text"] ?? "", 0.07)), selector(c)).toBe(true);
      if (c.brightness === "light") expect(black, selector(c)).toBe(false);
    }
  });
  it("N62 Dark's is #061b1b and N62 Light's #bcd8d7, in both start blocks", () => {
    expect(theme({ family: "n62", brightness: "dark", high: false, plain: false }).t["mark-faint"]).toBe("#061b1b");
    expect(theme({ family: "n62", brightness: "light", high: false, plain: false }).t["mark-faint"]).toBe("#bcd8d7");
    const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    expect(css).toContain("--mark-faint: #061b1b;");
    expect(css).toContain("--mark-faint: #bcd8d7;");
  });
  it("style.css holds the two tiles' colours and the mark's height as tokens, not theme roles", () => {
    const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    expect(css).toMatch(/--logo-ground: #529997;/);
    expect(css).toMatch(/--logo-ink: #000000;/);
    expect(css).toMatch(/--mark-h: 128px;/);
    for (const c of combos()) expect(Object.keys(theme(c).t)).not.toContain("logo-ground");
  });
});
