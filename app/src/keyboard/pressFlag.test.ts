// SPDX-License-Identifier: GPL-3.0-or-later
// R161 (F191): the keypad's press look is the app's own `data-down` flag (test/pressflag.spec.ts); Chrome's touch
// `:active` follows Android's tap detector, late and sticky, so no rule of the pad may use it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./Keypad.svelte", import.meta.url), "utf8");
const css = src.slice(src.indexOf("<style>"));

describe("Keypad.svelte's press look", () => {
  it("has no :active rule", () => {
    expect(src.includes("<style>")).toBe(true);
    expect(css.match(/[^\n]*:active[^\n]*/g) ?? []).toEqual([]);
  });
  it("draws the press from [data-down]", () => {
    expect(css).toContain("[data-down]");
  });
});
