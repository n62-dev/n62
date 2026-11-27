// SPDX-License-Identifier: GPL-3.0-or-later
// A266: each time a look is shown, Android's bars follow its screen colour (theme/bars.ts, a no-op outside the native shell).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Look } from "./look.ts";

const css = (f: string): string => readFileSync(new URL(f, import.meta.url), "utf8");
const BG: Record<string, string> = {
  "n62/dark": /\[data-family="n62"\]\[data-brightness="dark"\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})/i.exec(css("../style.css"))![1]!,
  "solarized/light": /\[data-family="solarized"\]\[data-brightness="light"\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})/i.exec(css("./solarized.css"))![1]!,
};

const calls: { color: string; light: boolean }[] = [];
vi.mock("./bars.ts", async (orig) => ({
  ...(await orig<typeof import("./bars.ts")>()),
  setBars: (o: { color: string; light: boolean }) => void calls.push(o),
}));
// the family's file is "in" at once, unless a test holds it
let hold: Promise<void> | null = null;
vi.mock("./apply.ts", () => ({
  applyTheme: async (t: { family: string; brightness: string }, root: HTMLElement): Promise<void> => {
    await hold;
    root.setAttribute("data-family", t.family);
    root.setAttribute("data-brightness", t.brightness);
  },
}));

const look = (family: Look["family"], brightness: Look["brightness"]): Look => ({ family, brightness, contrast: false, plain: false, shadow: true, pops: true, findFull: false, hand: "right" });

let attrs = new Map<string, string>();
beforeEach(() => {
  calls.length = 0;
  hold = null;
  attrs = new Map<string, string>();
  const root = { setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k) };
  vi.stubGlobal("document", { documentElement: root, querySelector: () => null });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => BG[`${attrs.get("data-family")}/${attrs.get("data-brightness")}`] ?? "" }));
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  vi.stubGlobal("matchMedia", undefined);
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe("applyLook and the system bars (A266)", () => {
  it("Solarized Light: one call with its --bg and dark icons", async () => {
    const { applyLook } = await import("./lookApply.ts");
    await applyLook(look("solarized", "light"));
    expect(calls).toEqual([{ color: BG["solarized/light"], light: true }]);
  });
  it("N62 Dark: #092726 with light icons", async () => {
    const { applyLook } = await import("./lookApply.ts");
    await applyLook(look("n62", "dark"));
    expect(calls).toEqual([{ color: "#092726", light: false }]);
  });
  it("a newer look that began meanwhile leaves only the newest call", async () => {
    const { applyLook } = await import("./lookApply.ts");
    let go: () => void = () => {};
    hold = new Promise((r) => (go = r));
    const first = applyLook(look("solarized", "light"));
    const second = applyLook(look("n62", "dark"));
    go();
    await Promise.all([first, second]);
    expect(calls).toEqual([{ color: "#092726", light: false }]);
  });
});

describe("Hand (R781)", () => {
  it("Left sets data-hand=left on the root at once; Right takes it away and sets nothing", async () => {
    const { applyLook } = await import("./lookApply.ts");
    const done = applyLook({ ...look("n62", "dark"), hand: "left" });
    expect(attrs.get("data-hand")).toBe("left"); // before the theme's file is in
    await done;
    await applyLook(look("n62", "dark"));
    expect(attrs.has("data-hand")).toBe(false);
  });
});
