// SPDX-License-Identifier: GPL-3.0-or-later
// The generated theme files are current, and all 24 combinations meet the contrast rules (report section 2).
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILIES } from "./theme-families.ts";
import { apart, CVD, oklabOf, type Mat } from "./cvd.ts";
import { LAYER_APART, WARN_APART, block, checks, combos, cr, dimmedOk, expected, familyPath, lum, outOfDate, selector, styleFile, theme } from "./theme-gen.ts";

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
        const bad = checks(t, c).filter((x) => x.v < x.min);
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
    const n62Dark = { family: "n62", brightness: "dark", high: false, plain: false } as const;
    const cs = checks(theme(n62Dark).t, n62Dark);
    expect(cs.some((x) => x.f === "key-text" && x.b === "key-num")).toBe(true);
  });
});

describe("R156: --key-edge, the line under each key (Key shadows)", () => {
  const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mixed = (a: string, b: string, k: number): number[] => rgb(a).map((v, i) => v + ((rgb(b)[i] as number) - v) * k);
  it("is black in a dark combination where black stands 1.45:1 from --panel, else --panel mixed toward --text (R873); black at 30 % over the final --bg in every light one, as an opaque colour", () => {
    for (const c of combos()) {
      const { t } = theme(c);
      const edge = t["key-edge"] ?? "";
      const panel = t["panel"] ?? "";
      expect(edge, selector(c)).toMatch(/^#[0-9a-f]{6}$/);
      if (c.brightness === "light") rgb(edge).forEach((v, i) => expect(Math.abs(v - (rgb(t["bg"] ?? "")[i] as number) * 0.7), selector(c)).toBeLessThanOrEqual(0.5));
      else if (cr("#000000", panel) >= 1.45) expect(edge, selector(c)).toBe("#000000");
      else {
        expect(lum(edge), `${selector(c)}: lighter than the keypad`).toBeGreaterThan(lum(panel));
        const on = Array.from({ length: 101 }, (_, i) => i / 100).some((k) => rgb(edge).every((v, i) => Math.abs(v - (mixed(panel, t["text"] ?? "", k)[i] as number)) <= 0.5));
        expect(on, `${selector(c)}: ${edge} is --panel mixed toward --text`).toBe(true);
      }
    }
  });
  // R873 (owner, 2026-11-22, point 8: "key shadows on black theme are not visible"): B&W Dark's black line stood 1.10:1
  for (const c of combos())
    it(`${selector(c)}: the line stands at least 1.45:1 from the keypad's --panel (R873)`, () => {
      const { t } = theme(c);
      expect(cr(t["key-edge"] ?? "", t["panel"] ?? "")).toBeGreaterThanOrEqual(1.45);
    });
  it("B&W Dark's is a grey lighter than its keypad, near sandra's #2e3233 (R873)", () => {
    const { t } = theme({ family: "bw", brightness: "dark", high: false, plain: false });
    expect(t["key-edge"]).not.toBe("#000000");
    expect(apart(t["key-edge"] ?? "", "#2e3233")).toBeLessThan(0.02);
  });
  it("N62 Light's is #8da1a0, and both start blocks carry it", () => {
    expect(theme({ family: "n62", brightness: "light", high: false, plain: false }).t["key-edge"]).toBe("#8da1a0");
    const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    expect(css).toContain("--key-edge: #000000;");
    expect(css).toContain("--key-edge: #8da1a0;");
    expect(css).toMatch(/--key-shadow: 2px;/);
  });
});

// R873 (owner, 2026-11-22, point 4: "solarized and black&white: the arrow pad is not different enough to the background"):
// --key-pad, the round pad's fill, is --key-ctl with its OKLCH lightness moved away from the keypad's --panel (hue and chroma
// kept) until it stands 1.25:1 from it, lighter in a dark look and darker in a light one; the arrows (--key-text at 70 %) read on it.
describe("R873: --key-pad, the round pad's fill", () => {
  const rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  // Solarized's normal looks cannot keep 4.5:1 on a pad 1.25:1 from their keypad: held to their measured values (decisions.md, "Needs the user")
  const HELD: Record<string, number> = { "solarized dark": 4.03, "solarized light": 4.28 };
  const over = (bg: string, fg: string, k: number): string => "#" + rgb(bg).map((v, i) => Math.round(v + ((rgb(fg)[i] as number) - v) * k).toString(16).padStart(2, "0")).join("");
  for (const c of combos())
    it(`${selector(c)}: 1.25:1 from --panel on the far side of it, the arrows at least 4.5:1 on it`, () => {
      const { t } = theme(c);
      const pad = t["key-pad"] ?? "";
      const panel = t["panel"] ?? "";
      expect(pad, "--key-pad").toMatch(/^#[0-9a-f]{6}$/);
      expect(cr(pad, panel), "pad : keypad").toBeGreaterThanOrEqual(1.25);
      expect(lum(pad) > lum(panel), c.brightness === "dark" ? "lighter than --panel" : "darker than --panel").toBe(c.brightness === "dark");
      expect(cr(over(pad, t["key-text"] ?? "", 0.7), pad), "arrows (--key-text at 0.7)").toBeGreaterThanOrEqual(c.high ? 4.5 : (HELD[`${c.family} ${c.brightness}`] ?? 4.5));
    });
  it("keeps --key-ctl's hue and chroma (OKLab a and b within rounding) where the move stays in gamut", () => {
    for (const c of combos().filter((x) => !x.plain && !x.high)) {
      const { t } = theme(c);
      const [p, k] = [oklabOf(t["key-pad"] ?? ""), oklabOf(t["key-ctl"] ?? "")];
      expect(Math.hypot((p[1] as number) - (k[1] as number), (p[2] as number) - (k[2] as number)), selector(c)).toBeLessThan(0.006);
    }
  });
  it("the normal looks land near sandra's candidates (s1-cands.mjs)", () => {
    const CANDS = { "n62 dark": "#1d4140", "n62 light": "#c2dbda", "bw dark": "#242929", "bw light": "#ced4d4", "solarized dark": "#475a6d", "solarized light": "#d6d8b4" } as const;
    for (const [id, want] of Object.entries(CANDS)) {
      const [family, brightness] = id.split(" ") as [string, "dark" | "light"];
      expect(apart(theme({ family, brightness, high: false, plain: false }).t["key-pad"] ?? "", want), id).toBeLessThan(0.02);
    }
  });
  it("N62's two start blocks in style.css carry it", () => {
    const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    for (const b of ["dark", "light"] as const) expect(css).toContain(`--key-pad: ${theme({ family: "n62", brightness: b, high: false, plain: false }).t["key-pad"]};`);
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
  it("style.css holds the mark's height as a token, and no logo colours (R745: Home's tile is the app icon's own file)", () => {
    const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/--logo-ground|--logo-ink/);
    expect(css).toMatch(/--mark-h: 128px;/);
    for (const c of combos()) expect(Object.keys(theme(c).t)).not.toContain("logo-ground");
  });
});

// R843 (owner, 2026-11-20; his pick from R842's page, 2026-11-22: A): N62 Light's Enter is orange #c26a00 with a black label;
// N62 Dark keeps the logo's teal. R842 measured A at 0.269 from Shift's drawn #5b2400 (protanopia) and, in High contrast, its
// #e17b00 at 0.225 from #913900 (tritanopia): the smallest of normal vision and the three deficiencies
// (docs/mockups/enter-orange-light.html). Enter may not come closer than those values, rounded to three places, allow.
describe("R843: N62 Light's Enter is the owner's orange", () => {
  const R842_APART = { normal: 0.2685, high: 0.2245 } as const;
  const hue = (h: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    return 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4);
  };
  const n62 = (brightness: "dark" | "light", high: boolean) => theme({ family: "n62", brightness, high, plain: false }).t;
  it("N62 Light's --key-enter is #c26a00 with a black label at least 4.5:1, and both start blocks carry the pair", () => {
    const t = n62("light", false);
    expect(t["key-enter"]).toBe("#c26a00");
    expect(t["on-enter"]).toBe("#000000");
    expect(cr(t["on-enter"] as string, t["key-enter"] as string)).toBeGreaterThanOrEqual(4.5);
    expect(readFileSync(new URL("../src/style.css", import.meta.url), "utf8")).toContain("--key-enter: #c26a00;");
  });
  it("High contrast: the label at least 7:1, the fill keeps its orange hue (the generator moves lightness only)", () => {
    const t = n62("light", true);
    expect(cr(t["on-enter"] as string, t["key-enter"] as string)).toBeGreaterThanOrEqual(7);
    expect(Math.abs(hue(t["key-enter"] as string) - hue("#c26a00"))).toBeLessThanOrEqual(2);
  });
  it(`N62 Light's orange Enter stands at least ${R842_APART.normal} (High contrast ${R842_APART.high}) from --key-shift for normal vision and the three deficiencies`, () => {
    for (const high of [false, true]) {
      const t = n62("light", high);
      const h = hue(t["key-enter"] as string);
      expect(h >= 30 && h <= 70, `high ${high}: Enter hue ${h.toFixed(0)}° is an orange`).toBe(true);
      for (const m of [null, ...Object.values(CVD)]) expect(apart(t["key-enter"] as string, t["key-shift"] as string, m), `high ${high}`).toBeGreaterThanOrEqual(R842_APART[high ? "high" : "normal"]);
    }
  });
  it("the unit pad's prefix cells stay teal: they take N62 Light's `edge`, not its orange Enter (Plain keys: the inverted Enter, as before)", () => {
    expect(n62("light", false)["key-pfx"]).toBe("#b9d9d8");
    expect(theme({ family: "n62", brightness: "light", high: false, plain: true }).t["key-pfx"]).toBe("#bbcbca");
    expect(Math.abs(hue(n62("light", false)["key-pfx"] as string) - hue("#529997"))).toBeLessThanOrEqual(10);
  });
  it("N62 Dark's Enter is still the logo's teal #529997", () => {
    expect(n62("dark", false)["key-enter"]).toBe("#529997");
    expect(FAMILIES.find((f) => f.id === "n62")?.dark["key-enter"]).toBe("#529997");
  });
});

// R872 (owner, 2026-11-22; sandra's S1, numbers confirmed by sofia): Enter stands out in every look. Its fill at least 3:1 from
// the keypad's --panel; its label at least 4.5:1 (7:1 in High contrast); and, where the layers have colours (not Plain keys,
// which draws Shift, Alpha and Enter in the text colour on purpose), at least LAYER_APART from --key-shift and --key-alpha in the
// worst of normal vision and the three deficiencies (cvd.ts). The owner's two orange Enters sit nearer their Shift: each is held
// to its measured value, rounded down (N62 Light: R842's, as R843; Solarized Light: 0.0386, High contrast 0.0263). N62 Light in
// High contrast cannot meet 3:1 from its --panel at all with a 7:1 black label (the fill would need a luminance of at least 0.30
// and at most 0.277): it is held to its measured 2.789 (decisions.md, "Needs the user").
describe("R872: Enter stands out", () => {
  const SEEN = [null, ...Object.values(CVD)];
  const worst = (a: string, b: string): number => Math.min(...SEEN.map((m) => apart(a, b, m)));
  const SHIFT_FLOOR: Record<string, { normal: number; high: number }> = { "n62 light": { normal: 0.2685, high: 0.2245 }, "solarized light": { normal: 0.0385, high: 0.026 } };
  const PANEL_FLOOR: Record<string, number> = { "n62 light high": 2.785 };
  for (const c of combos())
    it(`${selector(c)}: Enter 3:1 from --panel, its label ${c.high ? 7 : 4.5}:1${c.plain ? "" : ", apart from Shift and Alpha"}`, () => {
      const { t } = theme(c);
      const e = t["key-enter"] as string;
      const k = c.high ? "high" : "normal";
      expect(cr(e, t["panel"] as string), "Enter on --panel").toBeGreaterThanOrEqual(PANEL_FLOOR[`${c.family} ${c.brightness}${c.high ? " high" : ""}`] ?? 3);
      expect(cr(t["on-enter"] as string, e), "Enter's label").toBeGreaterThanOrEqual(c.high ? 7 : 4.5);
      if (c.plain) return;
      expect(worst(e, t["key-shift"] as string), "from --key-shift").toBeGreaterThanOrEqual(SHIFT_FLOOR[`${c.family} ${c.brightness}`]?.[k] ?? LAYER_APART[k]);
      expect(worst(e, t["key-alpha"] as string), "from --key-alpha").toBeGreaterThanOrEqual(LAYER_APART[k]);
    });
  const VALUES = { "bw dark": ["#e6ebeb", "#000000"], "bw light": ["#1b2122", "#ffffff"], "solarized dark": ["#4aa3e6", "#002b36"], "solarized light": ["#cb4b16", "#fffff4"] } as const;
  for (const [id, pair] of Object.entries(VALUES))
    it(`${id}: Enter is ${pair[0]} with a ${pair[1]} label, in the family data and drawn`, () => {
      const [family, brightness] = id.split(" ") as [string, "dark" | "light"];
      const { t } = theme({ family, brightness, high: false, plain: false });
      expect([t["key-enter"], t["on-enter"]]).toEqual(pair);
      const fam = FAMILIES.find((f) => f.id === family)?.[brightness] ?? {};
      expect([fam["key-enter"], fam["on-enter"]]).toEqual(pair);
    });
  it("the generator's audit names the Enter floors (npm run themes refuses a family that breaks them)", () => {
    const c = { family: "bw", brightness: "dark", high: false, plain: false } as const;
    const ls = checks(theme(c).t, c).map((x) => x.l);
    for (const l of ["Enter on the keypad (non-text)", "Enter apart from Shift", "Enter apart from Alpha"]) expect(ls, l).toContain(l);
  });
});
