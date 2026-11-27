// SPDX-License-Identifier: GPL-3.0-or-later
// R781: under Hand = Left the keypad's grid runs right to left (Keypad.svelte), and the round pad's ◀ and ▶ zones trade columns so
// each keeps its side. The two columns are written in the CSS (no per-key style in the start chunk); this holds them to the spec:
// each zone takes the other's place, and the pad is centred (else trading would not mirror it back).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gridPlace, keyboard } from "./keyboard.ts";

const css = readFileSync(new URL("./Keypad.svelte", import.meta.url), "utf8");
const place = (id: string) => {
  const k = keyboard.byId.get(id);
  if (!k) throw new Error(`no key ${id}`);
  return gridPlace(keyboard, k);
};
const leftRule = (id: string) => css.match(new RegExp(`data-hand="left"\\]\\) \\.key\\[data-key="${id}"\\] \\{ grid-column: (\\d+) / span (\\d+) !important; \\}`));

describe("R781: the pad's zones under Hand = Left", () => {
  it("◀ takes ▶'s column and ▶ takes ◀'s, as the spec places them", () => {
    for (const [id, other] of [["left", "right"], ["right", "left"]] as const) {
      const m = leftRule(id);
      expect(m, id).not.toBeNull();
      expect({ start: Number(m?.[1]), span: Number(m?.[2]) }, id).toEqual(place(other));
    }
  });
  it("the pad is centred: ▲'s columns are their own mirror", () => {
    const up = place("up");
    expect(keyboard.units + 2 - up.start - up.span).toBe(up.start);
    expect(place("left").span).toBe(place("right").span);
  });
});
