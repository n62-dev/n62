// SPDX-License-Identifier: GPL-3.0-or-later
// R806: the press sequences of slot.caret.test.ts: the probe's seeded generator (../drafts/2026-11-20-owner-bugs2/W/
// unit-caret.ts), its catalogue, and the digest of what a model shows after a sequence (the fixture holds that digest).
import { createHash } from "node:crypto";
import type { PadAction, SlotCatalogue, SlotName } from "./slot.ts";

const name = (latex: string, words: string, si?: string, dim?: string): SlotName =>
  ({ latex, words, ...(si ? { si } : {}), ...(dim ? { dim } : {}) });
export const CAT: SlotCatalogue = {
  units: new Map([
    ["m", name("m", "metre", "1", "L")], ["s", name("s", "second", "1", "T")], ["N", name("N", "newton", "1", "MLT-2")],
    ["J", name("J", "joule", "1", "ML2T-2")], ["g", name("g", "gram", "1/1000", "M")], ["K", name("K", "kelvin", "1", "Θ")],
    ["Hz", name("Hz", "hertz", "1", "T-1")], ["km", name("km", "kilometre", "1000", "L")], ["ms", name("ms", "millisecond", "1/1000", "T")],
  ]),
  prefixes: new Map([["k", name("k", "kilo", "1000")], ["m", name("m", "milli", "1/1000")], ["M", name("M", "mega", "1000000")]]),
};

const UNITS = ["m", "s", "N", "J", "g", "K", "Hz", "km", "ms"], PFX = ["k", "m", "M"];

/** The sequences, in order: the same on every run (the probe's linear congruential generator, seed 7). */
export function sequences(count: number): PadAction[][] {
  let seed = 7;
  const rnd = (n: number): number => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n);
  const press = (): PadAction => {
    switch (rnd(8)) {
      case 0: case 1: case 2: return { do: "unit", id: UNITS[rnd(UNITS.length)] as string };
      case 3: return { do: "prefix", id: PFX[rnd(PFX.length)] as string };
      case 4: return { do: "power", n: ([2, 3, 4, -1] as const)[rnd(4)] as 2 | 3 | 4 | -1 };
      case 5: return { do: "sqrt" };
      case 6: return { do: "per" };
      default: return { do: "delete" };
    }
  };
  return Array.from({ length: count }, () => Array.from({ length: 1 + rnd(10) }, press));
}

/** What a model shows, as the fixture holds it. */
export interface Shown {
  slot: unknown; latex: string; reading: { text: string; marked: boolean; parts: { text: string; marked: boolean }[] };
  armed: { prefix?: string; sqrt: boolean }; empty: boolean;
}

/** One line of the fixture: the results of the presses as 1 (ok) and 0 (refused), and a digest of the final state. */
export function digest(oks: readonly boolean[], s: Shown): string {
  const h = createHash("sha1").update(JSON.stringify([s.slot, s.latex, s.reading, s.armed, s.empty])).digest("hex").slice(0, 12);
  return `${oks.map((o) => (o ? 1 : 0)).join("")} ${h}`;
}
