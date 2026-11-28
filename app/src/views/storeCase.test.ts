// SPDX-License-Identifier: GPL-3.0-or-later
// R822: in the Store sheet a plain tap types the letter in the case Alpha types in the view (Home A, CAS a), so the name stored is the name
// the same key types on the line. Home is unchanged; Alpha and Shift + Alpha are unchanged.
import { describe, expect, it } from "vitest";
import { keyboard, type Key } from "../keyboard/keyboard.ts";
import { storeKey } from "./sheetKeys.ts";

const key = (id: string): Key => {
  const k = keyboard.byId.get(id);
  if (!k) throw new Error(`no key ${id}`);
  return k;
};
const letter = (id: string, shift: boolean, alpha: boolean, cas: boolean): string | undefined => {
  const j = storeKey(key(id), shift, alpha, cas, true);
  return j.kind === "letter" ? j.ch : undefined;
};

describe("R822: storeKey's plain tap follows the case Alpha types in the view", () => {
  it("CAS: a tap on Vars is a, on sin g; Alpha and Shift + Alpha unchanged", () => {
    expect(letter("vars", false, false, true)).toBe("a");
    expect(letter("sin", false, false, true)).toBe("g");
    expect(letter("vars", false, true, true)).toBe("a");
    expect(letter("vars", true, true, true)).toBe("A");
    expect(letter("sin", false, true, true)).toBe("g");
    expect(letter("sin", true, true, true)).toBe("G");
  });
  it("Home: every case of the table is as before", () => {
    expect(letter("vars", false, false, false)).toBe("A");
    expect(letter("sin", false, false, false)).toBe("G");
    expect(letter("x", false, false, false)).toBe("x");
    expect(letter("vars", false, true, false)).toBe("A");
    expect(letter("vars", true, true, false)).toBe("a");
    expect(letter("x", false, true, false)).toBe("D");
    expect(letter("x", true, true, false)).toBe("d");
    expect(letter("x", false, false, true)).toBe("x");
    expect(letter("x", false, true, true)).toBe("d");
    expect(letter("x", true, true, true)).toBe("D");
  });
  it("the control: every key with an Alpha letter taps what Alpha taps, in both views (x types its own x; Tmpl keeps its sheet job)", () => {
    let n = 0;
    for (const cas of [false, true]) {
      for (const k of keyboard.keys) {
        const p = k.actions.primary;
        if (k.user || k.id === "tmpl" || /^d\d$/.test(k.id) || (p?.kind === "type" && /^\p{L}$/u.test(p.text))) continue;
        const alpha = letter(k.id, false, true, cas);
        if (alpha === undefined) continue;
        n++;
        expect(letter(k.id, false, false, cas), `${k.id} cas=${cas}`).toBe(alpha);
      }
    }
    expect(n).toBeGreaterThan(30);
  });
});
