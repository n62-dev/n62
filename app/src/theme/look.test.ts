// SPDX-License-Identifier: GPL-3.0-or-later
// R50e: the look's values, and the inline script of index.html that shows them before the first paint.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { themeCssMap } from "../../vite-plugin-theme-css.ts";
import { renamedLook } from "../state/presetRecord.ts";
import { defaultLook, FAMILY_IDS, validLook } from "./look.ts";
import { themeOf } from "./lookApply.ts";
import { FAMILIES, stepped } from "./lookView.ts";

describe("look", () => {
  it("R153: the families are N62, Black & White and Solarized, in this order in Appearance", () => {
    expect(FAMILY_IDS).toEqual(["n62", "bw", "solarized"]);
    expect(FAMILIES.map((f) => f.id)).toEqual(["n62", "bw", "solarized"]);
    expect(FAMILIES.map((f) => f.name)).toEqual(["N62", "Black & White", "Solarized"]);
  });
  it("R153: a stored look naming Teal reads as N62 and keeps its other three values; a stored bw stays bw", () => {
    expect(validLook({ family: "teal", brightness: "light", contrast: true, plain: true }, { ...defaultLook(), family: "solarized" })).toEqual({ family: "n62", brightness: "light", contrast: true, plain: true, shadow: true });
    expect(renamedLook({ family: "teal", brightness: "dark", plain: true })).toEqual({ family: "n62", brightness: "dark", plain: true });
    expect(validLook({ family: "bw" }, defaultLook()).family).toBe("bw");
    expect(renamedLook({ family: "bw" })).toEqual({ family: "bw" });
  });
  it("R150: a stored look naming Graphite, Gruvbox or Nord reads as N62 and keeps its brightness, High contrast and Plain keys", () => {
    for (const family of ["graphite", "gruvbox", "nord"])
      expect(validLook({ family, brightness: "light", contrast: true, plain: true }, { ...defaultLook(), family: "bw" })).toEqual({ family: "n62", brightness: "light", contrast: true, plain: true, shadow: true });
    expect(validLook({ family: "x", brightness: "light" }, { ...defaultLook(), family: "bw" }).family).toBe("bw"); // an unknown name still falls back
  });
  it("R150: a backup's or a preset's look naming a retired family is renamed to n62 with the rest kept; the other families stay", () => {
    for (const family of ["pascaline", "graphite", "gruvbox", "nord", "teal"]) expect(renamedLook({ family, brightness: "dark", plain: true })).toEqual({ family: "n62", brightness: "dark", plain: true });
    for (const family of ["n62", "bw", "solarized"]) expect(renamedLook({ family, plain: true })).toEqual({ family, plain: true });
  });
  it("the dots are the dark block's screen, number key, Enter and the keys' Shift and Alpha of the generated CSS", () => {
    const roles = ["bg", "key-num", "key-enter", "key-shift", "key-alpha"];
    for (const f of FAMILIES) {
      const file = f.id === "n62" ? "../style.css" : `./${f.id}.css`;
      const css = readFileSync(new URL(file, import.meta.url), "utf8");
      const block = css.match(new RegExp(`:root\\[data-family="${f.id}"\\]\\[data-brightness="dark"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      expect(f.dots, f.id).toEqual(roles.map((r) => block.match(new RegExp(`--${r}:\\s*(#[0-9a-f]+)`))?.[1]));
    }
  });
  it("first-start defaults: Dark in the Android app, System in the browser, High contrast when asked, key shadows on", () => {
    expect(defaultLook()).toEqual({ family: "n62", brightness: "system", contrast: false, plain: false, shadow: true });
    expect(defaultLook(true, true)).toEqual({ family: "n62", brightness: "dark", contrast: true, plain: false, shadow: true });
  });
  it("R156: validLook gives shadow true when the field is missing, keeps a stored boolean, and the fallback's for a wrong type", () => {
    const off = { ...defaultLook(), shadow: false };
    expect(validLook({ family: "bw", brightness: "dark", contrast: false, plain: false }, off).shadow).toBe(true);
    expect(validLook({}, off).shadow).toBe(true);
    expect(validLook({ shadow: false }, defaultLook()).shadow).toBe(false);
    expect(validLook({ shadow: true }, off).shadow).toBe(true);
    expect(validLook({ shadow: "no" }, off).shadow).toBe(false);
    expect(validLook({ shadow: 0 }, defaultLook()).shadow).toBe(true);
  });
  it("System follows the phone; the other two do not", () => {
    const l = { ...defaultLook(), family: "solarized" as const, plain: true };
    expect(themeOf(l, true)).toEqual({ family: "solarized", brightness: "light", contrast: "normal", keys: "plain" });
    expect(themeOf({ ...l, brightness: "dark" }, true).brightness).toBe("dark");
    expect(themeOf({ ...l, brightness: "light", contrast: true }, false)).toMatchObject({ brightness: "light", contrast: "high" });
  });
  it("validLook keeps the fallback for a wrong field; stepped goes round", () => {
    expect(validLook({ family: "x", brightness: "light", contrast: 1, plain: true }, defaultLook())).toEqual({ family: "n62", brightness: "light", contrast: false, plain: true, shadow: true });
    expect(stepped(["a", "b", "c"], "c", 1)).toBe("a");
    expect(stepped(["a", "b", "c"], "a", -1)).toBe("c");
  });
});

/** Runs the first inline script of index.html on a fake page. */
function runInline(opts: { stored?: unknown; light?: boolean; more?: boolean; native?: boolean; throws?: boolean; files?: Record<string, string> }) {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  let script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
  script = script.replace("/*theme-css*/{}", JSON.stringify(opts.files ?? { n62: "a/p.css", bw: "a/n.css", solarized: "a/s.css", modes: "a/m.css" }));
  const attrs: Record<string, string> = {};
  const meta: Record<string, string> = {};
  const written: string[] = [];
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => void (attrs[k] = v) },
    querySelector: () => ({ setAttribute: (k: string, v: string) => void (meta[k] = v) }),
    write: (h: string) => void written.push(h),
    baseURI: "http://x/",
  };
  const window = { matchMedia: (q: string) => ({ matches: q.includes("light") ? opts.light === true : opts.more === true }), Capacitor: opts.native ? { isNativePlatform: () => true } : undefined };
  const localStorage = { getItem: () => { if (opts.throws) throw new Error("blocked"); return opts.stored === undefined ? null : JSON.stringify(opts.stored); } };
  runInNewContext(script, { document, window, localStorage, matchMedia: window.matchMedia, URL });
  return { attrs, meta, written };
}

describe("the inline script of index.html", () => {
  it("shows the stored look and links its CSS", () => {
    const r = runInline({ stored: { family: "bw", brightness: "light", contrast: true, plain: true, bg: "#57a3a1" } });
    expect(r.attrs).toEqual({ "data-family": "bw", "data-brightness": "light", "data-contrast": "high", "data-keys": "plain", "data-shadow": "on" });
    expect(r.meta["content"]).toBe("#57a3a1");
    expect(r.written.map((w) => w.match(/href="([^"]+)"/)?.[1])).toEqual(["http://x/a/n.css", "http://x/a/m.css"]);
  });
  it("R150: a stored family graphite, gruvbox or nord shows as n62 with the other three values, and links n62's file", () => {
    for (const family of ["graphite", "gruvbox", "nord"]) {
      const r = runInline({ stored: { family, brightness: "light", contrast: true, plain: true } });
      expect(r.attrs, family).toEqual({ "data-family": "n62", "data-brightness": "light", "data-contrast": "high", "data-keys": "plain", "data-shadow": "on" });
      expect(r.written.map((w) => w.match(/href="([^"]+)"/)?.[1]), family).toEqual(["http://x/a/p.css", "http://x/a/m.css"]);
    }
  });
  it("R153: a stored family teal shows as n62 with the other three values, links n62's file and keeps the old screen colour out of theme-color", () => {
    const r = runInline({ stored: { family: "teal", brightness: "dark", contrast: false, plain: true, bg: "#529997" } });
    expect(r.attrs).toEqual({ "data-family": "n62", "data-brightness": "dark", "data-keys": "plain", "data-shadow": "on" });
    expect(r.written.map((w) => w.match(/href="([^"]+)"/)?.[1])).toEqual(["http://x/a/p.css", "http://x/a/m.css"]);
    expect(r.meta["content"]).toBeUndefined();
    const plainTeal = runInline({ stored: { family: "teal", brightness: "light", contrast: false, plain: false } });
    expect(plainTeal.attrs).toEqual({ "data-family": "n62", "data-brightness": "light", "data-shadow": "on" });
    expect(plainTeal.written).toEqual([]); // N62's own look is in style.css
  });
  it("N62 with no switch links nothing; a stored System follows the phone", () => {
    const r = runInline({ stored: { family: "n62", brightness: "system", contrast: false, plain: false }, light: true });
    expect(r.attrs).toEqual({ "data-family": "n62", "data-brightness": "light", "data-shadow": "on" });
    expect(r.written).toEqual([]);
  });
  it("R138: a stored family pascaline (the name before N62) shows as n62 and links n62's file", () => {
    const r = runInline({ stored: { family: "pascaline", brightness: "dark", contrast: false, plain: true } });
    expect(r.attrs).toEqual({ "data-family": "n62", "data-brightness": "dark", "data-keys": "plain", "data-shadow": "on" });
    expect(r.written.map((w) => w.match(/href="([^"]+)"/)?.[1])).toEqual(["http://x/a/p.css", "http://x/a/m.css"]);
  });
  it("prefers-contrast: more counts only when nothing is stored", () => {
    expect(runInline({ more: true }).attrs["data-contrast"]).toBe("high");
    expect(runInline({ more: true, stored: { family: "n62", brightness: "dark", contrast: false, plain: false } }).attrs["data-contrast"]).toBeUndefined();
  });
  it("nothing stored: Dark in the Android app, System in the browser; a blocked store gives the same", () => {
    expect(runInline({ native: true, light: true }).attrs["data-brightness"]).toBe("dark");
    expect(runInline({ light: true }).attrs["data-brightness"]).toBe("light");
    expect(runInline({ throws: true, native: true }).attrs["data-brightness"]).toBe("dark");
  });
  it("a wrong stored value is ignored, field by field", () => {
    const r = runInline({ stored: { family: "x", brightness: "light", contrast: "yes", shadow: "no", bg: "red; x" } });
    expect(r.attrs).toEqual({ "data-family": "n62", "data-brightness": "light", "data-shadow": "on" });
    expect(r.meta["content"]).toBeUndefined();
  });
  it("R156: key shadows: on when nothing is stored or the field is missing, off only for a stored false; no file for it", () => {
    expect(runInline({}).attrs["data-shadow"]).toBe("on");
    expect(runInline({ throws: true }).attrs["data-shadow"]).toBe("on");
    const off = runInline({ stored: { family: "n62", brightness: "dark", contrast: false, plain: false, shadow: false } });
    expect(off.attrs).toEqual({ "data-family": "n62", "data-brightness": "dark" });
    expect(off.written).toEqual([]);
    expect(runInline({ stored: { family: "n62", brightness: "dark", shadow: true } }).attrs["data-shadow"]).toBe("on");
  });
});

describe("themeCssMap", () => {
  it("finds the four files by source name or by hashed name", () => {
    const m = themeCssMap([
      { fileName: "assets/x-1.css", originalFileNames: ["src/theme/bw.css"] },
      { fileName: "assets/solarized-AbC_1.css" },
      { fileName: "assets/nord-AbC_1.css" },
      { fileName: "assets/index-1.css" },
    ]);
    expect(m).toEqual({ bw: "assets/x-1.css", solarized: "assets/solarized-AbC_1.css" });
  });
});
