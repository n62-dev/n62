// SPDX-License-Identifier: GPL-3.0-or-later
// R313: letters typed on a hardware keyboard into a unit slot read as a unit, the way Find reads an exact symbol
// (slot.ts readSymbol, SlotModel's letter run), and the view's typing keys (typed.ts HwTyping): `*`, `/`, `^` and the
// digit after `^` end the run, ⌫ takes its last letter, Esc drops it, a run that reads as no unit is refused.
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { unitText } from "../i18n/enUnits.ts";
import type { PadEmit } from "./pad.ts";
import { SlotModel, readSymbol, slotCatalogue } from "./slot.ts";
import { HwTyping, type TypedView } from "./typed.ts";

const unit = (id: string, names: string[], title: string, si: string, dim: string, tier = 0): IndexItem =>
  ({ id: `unit:${id}`, kind: "unit", names, title, tier, insert: `\\unit{${id}}{\\mathrm{${id}}}`, si, dim });
const pfx = (id: string, names: string[], title: string, si: string): IndexItem =>
  ({ id: `pfx:${id}`, kind: "pfx", names, title, tier: 0, insert: `\\pfx{${id}}{\\mathrm{${id}}}`, si });

// Names as the Find index has them (km is an item of its own, kWh one of units.yaml, psi qalc's).
const CAT = slotCatalogue([
  pfx("k", ["kilo", "k"], "Kilo (10^3)", "1000"), pfx("m", ["milli", "m"], "Milli (10^-3)", "1/1000"),
  pfx("M", ["mega", "M"], "Mega (10^6)", "1000000"), pfx("u", ["micro", "u", "µ"], "Micro (10^-6)", "1/1000000"),
  unit("m", ["m", "meter", "metre"], "Meter", "1", "m1"), unit("km", ["km", "kilometre", "kilometer"], "Kilometer", "1000", "m1"),
  unit("s", ["s", "second"], "Second", "1", "s1"), unit("ms", ["ms"], "Millisecond", "1/1000", "s1"),
  unit("h", ["h", "hour", "hr"], "Hour", "3600", "s1"), unit("min", ["min", "minute"], "Minute", "60", "s1"),
  unit("N", ["N", "newton"], "Newton", "1", "kg1m1s-2"), unit("W", ["W", "watt"], "Watt", "1", "kg1m2s-3"),
  unit("Wh", ["Wh", "W·h", "watt hour"], "Watt hour", "3600", "kg1m2s-2"),
  unit("kWh", ["kWh", "kW·h", "kilowatt hour"], "Kilowatt hour", "3600000", "kg1m2s-2"),
  unit("psi", ["psi"], "Pound-force per Square Inch (psi)", "8896443230521/1290320000", "kg1m-1s-2"),
  unit("in", ["in", "inch"], "Inch", "127/5000", "m1"),
  // a name two units share: the one Find ranks first (tier 0) takes it
  unit("hr_old", ["hr"], "Old hour", "3600", "s1", 1),
]);

const slot = (s: SlotModel): string =>
  s.slot.tokens.map((t, i) => `${t.prefix ? `${t.prefix}:` : ""}${t.unit}${t.power ? `^${t.power}` : ""}${s.slot.per !== undefined && i >= s.slot.per ? "↓" : ""}`).join(" ");
const typedIn = (text: string): SlotModel => {
  const s = new SlotModel(CAT);
  for (const ch of text) s.type(ch);
  return s;
};

describe("readSymbol: a letter run as Find's exact symbols", () => {
  it("the whole run as a unit's name, a pair of Find's list as its prefix and unit", () => {
    expect(readSymbol(CAT, "km")).toEqual({ prefix: "k", unit: "m" });
    expect(readSymbol(CAT, "kWh")).toEqual({ prefix: "k", unit: "Wh" });
    expect(readSymbol(CAT, "psi")).toEqual({ unit: "psi" });
    expect(readSymbol(CAT, "min")).toEqual({ unit: "min" }); // a unit's name before a prefix and a unit (no milli-inch)
    expect(readSymbol(CAT, "hour")).toEqual({ unit: "h" });
    expect(readSymbol(CAT, "hr")).toEqual({ unit: "h" });
  });
  it("else the longest prefix name and a unit's name; exact as cased; anything else no unit", () => {
    expect(readSymbol(CAT, "mN")).toEqual({ prefix: "m", unit: "N" });
    expect(readSymbol(CAT, "Ms")).toEqual({ prefix: "M", unit: "s" });
    expect(readSymbol(CAT, "MS")).toBeUndefined();
    expect(readSymbol(CAT, "kmz")).toBeUndefined();
    expect(readSymbol(CAT, "k")).toBeUndefined();
    expect(readSymbol(CAT, "kkm")).toBeUndefined(); // (no prefix before a pair)
    expect(readSymbol({ units: CAT.units, prefixes: CAT.prefixes }, "km")).toBeUndefined(); // a catalogue without names reads none
  });
});

describe("SlotModel: the letter run", () => {
  it("is read at every letter: k (no unit, marked), km (kilometre)", () => {
    const s = typedIn("k");
    expect(slot(s)).toBe("");
    expect(s.reading).toEqual({ text: "k", parts: [{ text: "k", marked: true }], marked: true });
    expect(s.latex).toBe("\\class{pas-rare}{\\mathrm{k}}");
    expect(s.empty).toBe(false);
    s.type("m");
    expect(slot(s)).toBe("k:m");
    expect(s.reading.text).toBe("kilometer");
    expect(s.reading.marked).toBe(false);
  });
  it("kWh is the kilowatt hour, not k·W·h", () => {
    expect(slot(typedIn("kWh"))).toBe("k:Wh");
    expect(typedIn("kWh").reading.text).toBe("kilowatt hour");
  });
  it("a run that reads as no unit stays as typed, and cannot be left or ended: the message names its letters", () => {
    const s = typedIn("kmz");
    expect(slot(s)).toBe("");
    expect(s.latex).toBe("\\class{pas-rare}{\\mathrm{kmz}}");
    const msg = unitText("units.slot.notUnit", { letters: "kmz" });
    expect(msg).toBe("kmz is not a unit");
    expect(s.check()).toEqual({ ok: false, key: "units.slot.notUnit", message: msg });
    expect(s.endRun()).toMatchObject({ ok: false, message: msg });
    expect(s.apply({ do: "per" })).toMatchObject({ ok: false, message: msg });
    expect(s.typing).toBe(true);
  });
  it("⌫ takes the run's last letter, down to the slot before the run", () => {
    const s = typedIn("kmz");
    expect(s.untype()).toBe(true);
    expect(slot(s)).toBe("k:m");
    s.apply({ do: "delete" }); // a pad ⌫ in a run is the same
    expect(slot(s)).toBe("");
    expect(s.reading.text).toBe("k");
    s.untype();
    expect(s.empty).toBe(true);
    expect(s.typing).toBe(false);
    expect(s.untype()).toBe(false);
  });
  it("a pad press ends a run that reads as a unit: ÷ and the next run, then ² (m/s²)", () => {
    const s = typedIn("m");
    expect(s.apply({ do: "per" })).toEqual({ ok: true });
    expect(s.typing).toBe(false);
    s.type("s");
    expect(s.apply({ do: "power", n: 2 })).toEqual({ ok: true });
    expect(slot(s)).toBe("m s^2↓");
    expect(s.reading.text).toBe("meter per second squared");
  });
  it("an armed prefix and √ go to the run's unit as to a unit cell; ⌫ on the ended unit arms them again", () => {
    const s = new SlotModel(CAT);
    s.apply({ do: "prefix", id: "k" });
    s.type("m");
    expect(slot(s)).toBe("k:m");
    expect(s.endRun()).toEqual({ ok: true });
    s.apply({ do: "delete" });
    expect(s.armed).toEqual({ prefix: "k", sqrt: false });
    const r = new SlotModel(CAT);
    r.apply({ do: "sqrt" });
    for (const ch of "Hz") r.type(ch); // (no Hz in this catalogue: the armed √ stays armed under the letters)
    expect(r.armed.sqrt).toBe(true);
  });
  it("Esc drops the run: the slot as before it", () => {
    const s = new SlotModel(CAT, { tokens: [{ unit: "N" }] });
    for (const ch of "km") s.type(ch);
    s.dropRun();
    expect(slot(s)).toBe("N");
    expect(s.typing).toBe(false);
  });
});

describe("HwTyping: the unit view's typing keys", () => {
  /** A view over one slot model, recording the pad presses it was handed. */
  const view = (): { v: TypedView; s: SlotModel; got: PadEmit[] } => {
    const s = new SlotModel(CAT);
    const got: PadEmit[] = [];
    const v: TypedView = {
      get typing() {
        return s.typing;
      },
      letter: (ch) => s.type(ch),
      untype: () => s.untype(),
      endRun: () => s.endRun().ok,
      dropRun: () => s.dropRun(),
      apply: (e) => {
        got.push(e);
        if (e.do !== "find" && e.do !== "next" && e.do !== "evaluate" && e.do !== "times") s.apply(e);
      },
    };
    return { v, s, got };
  };
  const ev = (key: string, mods: { ctrlKey?: boolean; altKey?: boolean } = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...mods });
  const keys = (t: HwTyping, ks: string): boolean[] => [...ks].map((k) => t.key(ev(k)));

  it("letters go into the run; `/` ends it and goes the keypad's way; `^` then 2 is the power ²", () => {
    const { v, s, got } = view();
    const t = new HwTyping(v);
    expect(keys(t, "m")).toEqual([true]);
    expect(t.key(ev("/"))).toBe(false); // ended, then the pad's ÷ (here by hand)
    s.apply({ do: "per" });
    expect(keys(t, "s^2")).toEqual([true, true, true]);
    expect(got).toEqual([{ do: "power", n: 2 }]);
    expect(slot(s)).toBe("m s^2↓");
  });
  it("`^-1` is ⁻¹; ⌫ after `^` takes the `^` back; `^` then another key drops it", () => {
    const { v, got } = view();
    const t = new HwTyping(v);
    keys(t, "s^-1");
    expect(got).toEqual([{ do: "power", n: -1 }]);
    expect(keys(t, "^")).toEqual([true]);
    expect(t.key(ev("Backspace"))).toBe(true);
    expect(t.key(ev("3"))).toBe(false); // no `^` before it now: the digit's prefix cell
    keys(t, "^");
    expect(t.key(ev("Shift"))).toBe(false); // (a bare modifier keeps the `^`: Shift + 6 types it on many layouts)
    expect(t.key(ev("Enter"))).toBe(false);
    expect(got).toEqual([{ do: "power", n: -1 }]);
  });
  it("a run that reads as no unit refuses the next key (taken, not passed on); ⌫ takes its letters; Esc drops it and goes on", () => {
    const { v, s } = view();
    const t = new HwTyping(v);
    keys(t, "kmz");
    expect(t.key(ev("Enter"))).toBe(true);
    expect(t.key(ev("*"))).toBe(true);
    expect(s.typing).toBe(true);
    expect(t.key(ev("Backspace"))).toBe(true);
    expect(slot(s)).toBe("k:m");
    expect(t.key(ev("Enter"))).toBe(false); // ended (kilometre), then Enter as ever
    expect(s.typing).toBe(false);
    keys(t, "zz");
    expect(t.key(ev("Escape"))).toBe(false);
    expect(slot(s)).toBe("k:m");
  });
  it("with no run a digit, ⌫ and the arrows go the keypad's way; a chord is never taken", () => {
    const { v } = view();
    const t = new HwTyping(v);
    for (const k of ["4", "Backspace", "ArrowLeft", "Enter", "Escape", "*"]) expect(t.key(ev(k)), k).toBe(false);
    expect(t.key(ev("f", { altKey: true }))).toBe(false);
    expect(t.key(ev("c", { ctrlKey: true }))).toBe(false);
  });
});
