// SPDX-License-Identifier: GPL-3.0-or-later
// R710 (F385): no var(...) reaches JSXGraph's canvas (it cannot resolve one; the strokes came out black). The colours
// are the root's tokens as literal values (plotInk.svelte.ts); the pixels are checked in test/plotcolors.spec.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../theme.svelte.ts", () => ({ brightness: () => "dark", family: () => "n62", highContrast: () => false }));
const { plotInk, token } = await import("./plotInk.svelte.ts");

describe("Plot's canvas colours (R710)", () => {
  it("a token is read as its literal value, trimmed; a page without it gets the fallback", () => {
    const style = { getPropertyValue: (n: string): string => ({ "--muted": " #abccca" })[n] ?? "" };
    expect(token(style, "--muted", "gray")).toBe("#abccca");
    expect(token(style, "--line", "gray")).toBe("gray");
  });
  it("the axes and numbers take --muted, the ticks --line, the trace dot --text", () => {
    const values: Record<string, string> = { "--muted": "#abccca", "--line": "#335b59", "--text": "#ebf6f6" };
    vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: (n: string): string => values[n] ?? "" }));
    expect(plotInk({} as Element)).toEqual({ axis: "#abccca", tick: "#335b59", trace: "#ebf6f6" });
    vi.unstubAllGlobals();
  });
  it("FunctionPlot.svelte gives JSXGraph no var(...) colour", () => {
    const src = readFileSync(new URL("./FunctionPlot.svelte", import.meta.url), "utf8");
    const script = src.slice(0, src.indexOf("</script>"));
    expect(script.match(/["'`]var\(--/g) ?? []).toEqual([]);
  });
});
