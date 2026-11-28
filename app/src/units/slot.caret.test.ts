// SPDX-License-Identifier: GPL-3.0-or-later
// R806: a slot is two lists (numerator, denominator) and a caret. (1) With the caret at the end, the only place a key can
// put it, 20 000 random press sequences give the slot, LaTeX and reading of a reference model (the walk's probe, ../drafts/
// 2026-11-20-owner-bugs2/W/unit-caret.ts, with R808's ⌫ and powers and the LaTeX and reading added); the first 2 000 also equal a
// fixture of the model as R808 left it (slot.caret.fixture.txt: the results of the presses and a digest of what the
// model showed). (2) With the caret placed inside (a test-only setter) a unit goes in after the factor left of the caret,
// a power acts on that factor, ⌫ removes it, a letter run starts at the caret.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { unitText } from "../i18n/enUnits.ts";
import { SlotModel, isPair, slotCatalogue, type PadAction, type SlotCatalogue } from "./slot.ts";
import { CAT, digest, sequences } from "./slot.caret.gen.ts";
import type { UnitSlot } from "./types.ts";

// ---- the reference model: the probe's `Caret` (num: F[], den?: F[], caret {side, i}, the armed prefix and √)
type F = { prefix?: string; unit: string; exp: number; root: boolean; took: Armed[] };
type Armed = { k: "p"; id: string } | { k: "s" };
class Reference {
  num: F[] = [];
  den: F[] | undefined;
  side: "num" | "den" = "num";
  i = 0;
  armed: Armed[] = [];
  list(): F[] {
    return this.side === "num" ? this.num : (this.den as F[]);
  }
  get empty(): boolean {
    return !this.num.length && !this.den && !this.armed.length;
  }
  /** One press: true when it is taken (the probe's "ok"; R808: ⌫ removes the whole factor, a power key again takes the power off). */
  press(a: PadAction): boolean {
    switch (a.do) {
      case "prefix": {
        const at = this.armed.findIndex((x) => x.k === "p");
        const was = this.armed[at];
        if (was?.k === "p" && was.id === a.id) this.armed.splice(at, 1);
        else if (was) this.armed[at] = { k: "p", id: a.id };
        else this.armed.push({ k: "p", id: a.id });
        return true;
      }
      case "sqrt": {
        const at = this.armed.findIndex((x) => x.k === "s");
        if (at >= 0) this.armed.splice(at, 1);
        else this.armed.push({ k: "s" });
        return true;
      }
      case "unit": {
        const p = this.armed.find((x) => x.k === "p");
        this.list().splice(this.i++, 0, { ...(p?.k === "p" ? { prefix: p.id } : {}), unit: a.id, exp: 1, root: this.armed.some((x) => x.k === "s"), took: this.armed });
        this.armed = [];
        return true;
      }
      case "per":
        if (this.armed.length || this.den) return false;
        this.den = [];
        this.side = "den";
        this.i = 0;
        return true;
      case "power": {
        if (this.armed.length) return false;
        const f = this.list()[this.i - 1];
        if (!f) return false;
        f.exp = a.n === -1 ? -f.exp : Math.abs(f.exp) === a.n ? Math.sign(f.exp) : Math.sign(f.exp) * a.n; // (the same power again takes it off)
        return true;
      }
      case "delete": {
        if (this.empty) return true;
        if (this.armed.length) this.armed.pop();
        else if (this.i > 0) this.list().splice(--this.i, 1); // (the whole factor: its prefix and power go with it, nothing is armed again)
        else if (this.side === "den") {
          if (this.den?.length) return false; // (J/(kg·K) never becomes J·kg·K)
          this.den = undefined;
          this.side = "num";
          this.i = this.num.length;
        } else if (this.num.length || this.den?.length) return false; // (the numerator's start, with factors after the caret)
        else {
          this.den = undefined; // (a bare ÷ with the caret before it)
          this.i = 0;
        }
        return true;
      }
      default:
        return true;
    }
  }
  get slot(): UnitSlot {
    const tok = (f: F, neg: boolean): UnitSlot["tokens"][number] => {
      const n = neg ? -f.exp : f.exp;
      const p = f.root ? (n % 2 === 0 ? String(n / 2) : `${n}/2`) : String(n);
      return { ...(f.prefix ? { prefix: f.prefix } : {}), unit: f.unit, ...(p !== "1" ? { power: p } : {}) };
    };
    const den = this.den ?? [];
    if (!den.length) return { tokens: this.num.map((f) => tok(f, false)) };
    if (!this.num.length) return { tokens: den.map((f) => tok(f, true)) };
    return { tokens: [...this.num, ...den].map((f) => tok(f, false)), per: this.num.length };
  }
  /** Whether a prefixed factor is a pair of the catalogue (km, ms); a bare unit never is marked. */
  #marked(f: F): boolean {
    if (f.prefix === undefined) return false;
    const pair = CAT.units.get(f.prefix + f.unit);
    return !(pair && isPair(pair, CAT.prefixes.get(f.prefix), CAT.units.get(f.unit)));
  }
  #words(f: F): string {
    if (f.prefix === undefined) return CAT.units.get(f.unit)?.words ?? f.unit;
    return this.#marked(f) ? (CAT.prefixes.get(f.prefix)?.words ?? "") + (CAT.units.get(f.unit)?.words ?? f.unit) : (CAT.units.get(f.prefix + f.unit)?.words ?? "");
  }
  get latex(): string {
    const one = (f: F): string => {
      const u = `\\mathrm{${CAT.units.get(f.unit)?.latex}}`;
      let b = f.prefix === undefined ? u : `\\mathrm{${CAT.prefixes.get(f.prefix)?.latex}}${u}`;
      if (f.root) b = `\\sqrt{${b}}`;
      if (f.exp !== 1) b += `^{${f.exp}}`;
      return this.#marked(f) ? `\\class{pas-rare}{${b}}` : b;
    };
    const armed = this.armed.map((x) => (x.k === "p" ? `\\class{pas-armed}{\\mathrm{${CAT.prefixes.get(x.id)?.latex}}}` : "\\class{pas-armed}{\\sqrt{\\square}}"));
    const side = (l: F[], at: number | undefined): string[] => {
      const parts = l.map(one);
      if (at !== undefined) parts.splice(at, 0, ...armed);
      return parts;
    };
    const num = side(this.num, this.side === "num" ? this.i : undefined);
    if (!this.den) return num.join("\\cdot");
    return `\\frac{${num.join("\\cdot") || "1"}}{${side(this.den, this.side === "den" ? this.i : undefined).join("\\cdot") || "\\class{pas-empty}{\\square}"}}`;
  }
  get reading(): { text: string; marked: boolean; parts: { text: string; marked: boolean }[] } {
    const above: { text: string; marked: boolean }[] = [], below: { text: string; marked: boolean }[] = [];
    for (const [f, down] of [...this.num.map((f) => [f, false] as const), ...(this.den ?? []).map((f) => [f, true] as const)]) {
      const exp = down ? -f.exp : f.exp, w = this.#words(f), n = Math.abs(exp);
      let text = n === 1 ? w : n === 2 ? unitText("units.read.square", { u: w }) : n === 3 ? unitText("units.read.cube", { u: w })
        : n === 4 ? unitText("units.read.fourth", { u: w }) : unitText("units.read.power", { u: w, p: String(n) });
      if (f.root) text = unitText("units.read.root", { u: text });
      (exp > 0 ? above : below).push({ text, marked: this.#marked(f) });
    }
    const parts = below.length ? [...above, { text: unitText("units.read.per"), marked: false }, ...below] : above;
    return { text: parts.map((p) => p.text).join(" "), parts, marked: parts.some((p) => p.marked) };
  }
  get armedView(): { prefix?: string; sqrt: boolean } {
    const p = this.armed.find((x) => x.k === "p");
    return { ...(p?.k === "p" ? { prefix: p.id } : {}), sqrt: this.armed.some((x) => x.k === "s") };
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, "slot.caret.fixture.txt"), "utf8").trimEnd().split("\n");

describe("R806: the caret at the end", () => {
  it("20 000 random press sequences: the slot, LaTeX, reading, armed state and the refusals equal the reference; the caret is at the end (R808: ⌫ whole, powers toggle)", () => {
    const seqs = sequences(20000);
    const kinds = new Set<string>(), powers = new Set<number>();
    let refused = 0;
    for (const [t, seq] of seqs.entries()) {
      const m = new SlotModel(CAT), r = new Reference();
      const oks: boolean[] = [];
      for (const a of seq) {
        const ok = m.apply(a).ok;
        expect(ok, `${JSON.stringify(seq)} at ${JSON.stringify(a)}`).toBe(r.press(a));
        oks.push(ok);
        kinds.add(a.do);
        if (a.do === "power") powers.add(a.n);
        if (!ok) refused++;
        expect(m.caret, JSON.stringify(seq)).toEqual({ side: r.side, i: r.i });
      }
      const shown = { slot: m.slot, latex: m.latex, reading: m.reading, armed: m.armed, empty: m.empty };
      const ref = { slot: r.slot, latex: r.latex, reading: r.reading, armed: r.armedView, empty: r.empty };
      expect(shown, JSON.stringify(seq)).toEqual(ref);
      if (t < 2000) expect(digest(oks, shown), `fixture ${t}: ${JSON.stringify(seq)}`).toBe(fixture[t]);
    }
    // the generator must reach every key (an inexact generator once made nothing but unit presses)
    expect([...kinds].sort()).toEqual(["delete", "per", "power", "prefix", "sqrt", "unit"]);
    expect([...powers].sort()).toEqual([-1, 2, 3, 4]);
    expect(refused).toBeGreaterThan(1000);
  });
  it("the fixture is the R808 model's: 2 000 lines, some presses refused", () => {
    expect(fixture).toHaveLength(2000);
    expect(fixture.some((l) => (l.split(" ")[0] as string).includes("0"))).toBe(true);
    expect(new Set(fixture.filter((l) => l.startsWith("1 ")).map((l) => l.split(" ")[1])).size).toBeGreaterThan(1);
  });
  it("a fresh slot, one restored from a UnitSlot and one after ÷ have the caret at the end of the last list", () => {
    expect(new SlotModel(CAT).caret).toEqual({ side: "num", i: 0 });
    expect(new SlotModel(CAT, { tokens: [{ unit: "m" }, { unit: "s" }] }).caret).toEqual({ side: "num", i: 2 });
    expect(new SlotModel(CAT, { tokens: [{ unit: "m" }, { unit: "s" }, { unit: "K" }], per: 1 }).caret).toEqual({ side: "den", i: 2 });
    const s = new SlotModel(CAT);
    s.apply({ do: "unit", id: "m" });
    s.apply({ do: "per" });
    expect(s.caret).toEqual({ side: "den", i: 0 });
    s.apply({ do: "delete" });
    expect(s.caret).toEqual({ side: "num", i: 1 });
  });
});

describe("R806: the caret inside", () => {
  const U = (id: string): PadAction => ({ do: "unit", id });
  const at = (actions: readonly PadAction[], side: "num" | "den", i: number): SlotModel => {
    const s = new SlotModel(CAT);
    for (const a of actions) expect(s.apply(a).ok).toBe(true);
    s.caretAtForTest(side, i);
    return s;
  };
  const ms: PadAction[] = [U("J"), U("K"), { do: "per" }, U("m"), U("s")]; // J·K / (m·s)

  it("a unit goes in after the factor left of the caret, in that list: J/(kg·K) to J/(g·K) is a letter and an edit, not a retype", () => {
    const s = at(ms, "num", 1);
    s.apply(U("N"));
    expect(s.slot).toEqual({ tokens: [{ unit: "J" }, { unit: "N" }, { unit: "K" }, { unit: "m" }, { unit: "s" }], per: 3 });
    expect(s.caret).toEqual({ side: "num", i: 2 });
    const d = at(ms, "den", 1);
    d.apply({ do: "prefix", id: "k" });
    d.apply(U("g"));
    expect(d.slot).toEqual({ tokens: [{ unit: "J" }, { unit: "K" }, { unit: "m" }, { prefix: "k", unit: "g" }, { unit: "s" }], per: 2 });
    expect(d.caret).toEqual({ side: "den", i: 2 });
    expect(d.latex).toBe("\\frac{\\mathrm{J}\\cdot\\mathrm{K}}{\\mathrm{m}\\cdot\\class{pas-rare}{\\mathrm{k}\\mathrm{g}}\\cdot\\mathrm{s}}");
    expect(at(ms, "num", 0).apply(U("N"))).toEqual({ ok: true });
  });
  it("a unit at the start of an empty ÷ side and the ÷ pressed inside the numerator", () => {
    const s = at([U("J"), U("K")], "num", 1);
    s.apply({ do: "per" }); // the numerator keeps J and K; the denominator opens, the caret in it
    expect(s.caret).toEqual({ side: "den", i: 0 });
    s.apply(U("s"));
    expect(s.slot).toEqual({ tokens: [{ unit: "J" }, { unit: "K" }, { unit: "s" }], per: 2 });
    expect(s.apply({ do: "per" })).toMatchObject({ ok: false, key: "units.slot.secondPer" });
  });
  it("a power acts on the factor left of the caret; none there is refused", () => {
    const s = at(ms, "num", 1);
    s.apply({ do: "power", n: 2 });
    expect(s.slot).toEqual({ tokens: [{ unit: "J", power: "2" }, { unit: "K" }, { unit: "m" }, { unit: "s" }], per: 2 });
    const d = at(ms, "den", 1);
    d.apply({ do: "power", n: 3 });
    expect(d.slot).toEqual({ tokens: [{ unit: "J" }, { unit: "K" }, { unit: "m", power: "3" }, { unit: "s" }], per: 2 });
    expect(at(ms, "num", 0).apply({ do: "power", n: 2 })).toMatchObject({ ok: false, key: "units.slot.powerAlone" });
    expect(at(ms, "den", 0).apply({ do: "power", n: 2 })).toMatchObject({ ok: false, key: "units.slot.powerAlone" });
  });
  it("⌫ removes the factor left of the caret (whole, R808), and crosses no ÷", () => {
    const s = at(ms, "num", 1);
    s.apply({ do: "delete" });
    expect(s.slot).toEqual({ tokens: [{ unit: "K" }, { unit: "m" }, { unit: "s" }], per: 1 });
    expect(s.caret).toEqual({ side: "num", i: 0 });
    const p = at([U("m"), { do: "power", n: 2 }, U("s")], "num", 1);
    p.apply({ do: "delete" }); // m² goes whole
    expect(p.slot).toEqual({ tokens: [{ unit: "s" }] });
    const d = at(ms, "den", 0); // (the start of a denominator that has units: nothing left of the caret in it; R808 refuses it)
    expect(d.apply({ do: "delete" })).toMatchObject({ ok: false, key: "units.slot.denHasUnits" });
    expect(d.slot).toEqual({ tokens: [{ unit: "J" }, { unit: "K" }, { unit: "m" }, { unit: "s" }], per: 2 });
  });
  it("a prefix and a unit are one factor inserted at the caret; the armed prefix shows in the list the caret is in", () => {
    const s = at(ms, "num", 1);
    s.apply({ do: "prefix", id: "k" });
    expect(s.latex).toBe("\\frac{\\mathrm{J}\\cdot\\class{pas-armed}{\\mathrm{k}}\\cdot\\mathrm{K}}{\\mathrm{m}\\cdot\\mathrm{s}}");
    s.apply(U("g"));
    expect(s.slot.tokens[1]).toEqual({ prefix: "k", unit: "g" });
    expect(s.reading.text).toBe("joule kilogram kelvin per metre second");
  });
  it("a letter run starts at the caret, is read there and unread there", () => {
    const cat: SlotCatalogue = slotCatalogue([
      { id: "unit:m", kind: "unit", names: ["m"], title: "Meter", tier: 0, insert: "\\unit{m}{\\mathrm{m}}", si: "1", dim: "m1" },
      { id: "unit:s", kind: "unit", names: ["s"], title: "Second", tier: 0, insert: "\\unit{s}{\\mathrm{s}}", si: "1", dim: "s1" },
      { id: "unit:N", kind: "unit", names: ["N"], title: "Newton", tier: 0, insert: "\\unit{N}{\\mathrm{N}}", si: "1", dim: "kg1m1s-2" },
    ]);
    const s = new SlotModel(cat, { tokens: [{ unit: "m" }, { unit: "s" }, { unit: "m" }], per: 2 }); // m·s / m
    s.caretAtForTest("num", 1);
    s.type("N");
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "N" }, { unit: "s" }, { unit: "m" }], per: 3 });
    expect(s.caret).toEqual({ side: "num", i: 2 });
    expect(s.endRun()).toEqual({ ok: true });
    s.apply({ do: "delete" }); // ⌫ takes the N back, the caret where it began
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }, { unit: "m" }], per: 2 });
    s.type("N");
    s.untype();
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }, { unit: "m" }], per: 2 });
    expect(s.caret).toEqual({ side: "num", i: 1 });
    expect(s.typing).toBe(false);
    s.type("z"); // no unit: stays as typed, marked, at the caret
    expect(s.latex).toBe("\\frac{\\mathrm{m}\\cdot\\class{pas-rare}{\\mathrm{z}}\\cdot\\mathrm{s}}{\\mathrm{m}}");
    expect(() => s.caretAtForTest("num", 0)).toThrow();
  });
  it("the test setter refuses a place the slot does not have", () => {
    const s = new SlotModel(CAT, { tokens: [{ unit: "m" }] });
    expect(() => s.caretAtForTest("den", 0)).toThrow();
    expect(() => s.caretAtForTest("num", 2)).toThrow();
    expect(() => s.caretAtForTest("num", -1)).toThrow();
  });
});

describe("R808: the caret moves, ⌫ and the powers act at it", () => {
  const U = (id: string): PadAction => ({ do: "unit", id });
  const K = { do: "prefix", id: "k" } as const;
  const DEL = { do: "delete" } as const;
  /** J ÷ kg·K, the caret at the end of the denominator. */
  const jkgk = (): SlotModel => {
    const s = new SlotModel(CAT);
    for (const a of [U("J"), { do: "per" } as const, K, U("g"), U("K")]) expect(s.apply(a).ok).toBe(true);
    return s;
  };
  const JKG = [{ unit: "J" }, { prefix: "k", unit: "g" }, { unit: "K" }];

  it("◀ ▶ move one factor; at the numerator's end ▶ goes to the denominator's start and ◀ comes back; the ends are edges", () => {
    const s = jkgk();
    expect(s.move(-1)).toEqual({ ok: true, moved: true });
    expect(s.caret).toEqual({ side: "den", i: 1 });
    s.move(-1);
    expect(s.caret).toEqual({ side: "den", i: 0 });
    expect(s.move(-1)).toEqual({ ok: true, moved: true }); // (back to the numerator's end)
    expect(s.caret).toEqual({ side: "num", i: 1 });
    s.move(-1);
    expect(s.move(-1)).toEqual({ ok: true, moved: false }); // the slot's start: the view crosses
    expect(s.caret).toEqual({ side: "num", i: 0 });
    s.move(1);
    expect(s.caret).toEqual({ side: "num", i: 1 });
    s.move(1);
    expect(s.caret).toEqual({ side: "den", i: 0 });
    s.move(1); s.move(1);
    expect(s.caret).toEqual({ side: "den", i: 2 });
    expect(s.move(1)).toEqual({ ok: true, moved: false });
    const one = new SlotModel(CAT, { tokens: [{ unit: "m" }] }); // no ÷: the numerator's end is the slot's end
    expect(one.move(1)).toEqual({ ok: true, moved: false });
  });
  it("caretTo puts the caret at a slot's start (▶ crossing in) or end (◀ crossing in, a tap)", () => {
    const s = jkgk();
    s.caretTo("start");
    expect(s.caret).toEqual({ side: "num", i: 0 });
    s.caretTo("end");
    expect(s.caret).toEqual({ side: "den", i: 2 });
  });
  it("▲ in the denominator goes to the numerator's end, ▼ in the numerator to the denominator's end; elsewhere no move", () => {
    const s = jkgk();
    s.move(-1);
    expect(s.vertical("up")).toEqual({ ok: true, moved: true });
    expect(s.caret).toEqual({ side: "num", i: 1 });
    expect(s.vertical("up")).toEqual({ ok: true, moved: false });
    expect(s.vertical("down")).toEqual({ ok: true, moved: true });
    expect(s.caret).toEqual({ side: "den", i: 2 });
    expect(s.vertical("down")).toEqual({ ok: true, moved: false });
    const one = new SlotModel(CAT, { tokens: [{ unit: "m" }] });
    expect(one.vertical("down")).toEqual({ ok: true, moved: false }); // no ÷: the view takes ▼ into the chips
    expect(one.vertical("up")).toEqual({ ok: true, moved: false });
  });
  it("J ÷ kg K, ◀, ⌫ gives J/K: the whole factor goes, its prefix with it, and nothing is armed again", () => {
    const s = jkgk();
    s.move(-1);
    expect(s.apply(DEL)).toEqual({ ok: true });
    expect(s.slot).toEqual({ tokens: [{ unit: "J" }, { unit: "K" }], per: 1 });
    expect(s.armed).toEqual({ sqrt: false });
    expect(s.caret).toEqual({ side: "den", i: 0 });
    s.apply(U("g")); // J/(g·K)
    expect(s.reading.text).toBe("joule per gram kelvin");
  });
  it("⌫ takes the factor with its power and its √ (m² and √m go whole)", () => {
    const s = new SlotModel(CAT);
    for (const a of [U("m"), { do: "power", n: 2 } as const, { do: "sqrt" } as const, U("s")]) s.apply(a);
    s.apply(DEL);
    expect(s.slot).toEqual({ tokens: [{ unit: "m", power: "2" }] });
    s.apply(DEL);
    expect(s.slot).toEqual({ tokens: [] });
    expect(s.armed).toEqual({ sqrt: false });
  });
  it("m ² ²: m; ² ³: m³; the same power on m⁻² takes it off to m⁻¹; ⁻¹ still negates", () => {
    const s = new SlotModel(CAT);
    s.apply(U("m"));
    s.apply({ do: "power", n: 2 });
    expect(s.slot).toEqual({ tokens: [{ unit: "m", power: "2" }] });
    s.apply({ do: "power", n: 2 });
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }] });
    s.apply({ do: "power", n: 2 });
    s.apply({ do: "power", n: 3 });
    expect(s.slot).toEqual({ tokens: [{ unit: "m", power: "3" }] });
    s.apply({ do: "power", n: -1 });
    s.apply({ do: "power", n: 3 });
    expect(s.slot).toEqual({ tokens: [{ unit: "m", power: "-1" }] });
    s.apply({ do: "power", n: -1 });
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }] });
  });
  it("a power with nothing left of the caret in its part is refused with a message", () => {
    const s = jkgk();
    s.move(-1); s.move(-1);
    const r = s.apply({ do: "power", n: 2 });
    expect(r).toMatchObject({ ok: false, key: "units.slot.powerAlone" });
    expect(!r.ok && r.message).toBe("A power needs a unit before it");
    expect(s.slot.tokens).toEqual(JKG);
  });
  it("⌫ at an empty denominator's start: the ÷ goes and the caret is at the numerator's end", () => {
    const s = new SlotModel(CAT);
    for (const a of [U("m"), U("s"), { do: "per" } as const]) s.apply(a);
    s.move(-1); s.move(1); // out and back in: the denominator's start
    expect(s.caret).toEqual({ side: "den", i: 0 });
    expect(s.apply(DEL)).toEqual({ ok: true });
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }] });
    expect(s.caret).toEqual({ side: "num", i: 2 });
    expect(s.latex).not.toContain("frac");
  });
  it("⌫ at a denominator's start with units in it: refused with a message, the slot and the caret unchanged", () => {
    const s = jkgk();
    s.move(-1); s.move(-1);
    const r = s.apply(DEL);
    expect(r).toMatchObject({ ok: false, key: "units.slot.denHasUnits" });
    expect(!r.ok && r.message).toBe("The denominator still has units");
    expect(s.slot).toEqual({ tokens: JKG, per: 1 });
    expect(s.caret).toEqual({ side: "den", i: 0 });
  });
  it("⌫ at the numerator's start with factors after the caret is a dead key (R806 left it a silent no-op)", () => {
    const s = new SlotModel(CAT, { tokens: [{ unit: "m" }, { unit: "s" }] });
    s.caretAtForTest("num", 0);
    expect(s.apply(DEL)).toMatchObject({ ok: false, key: "units.slot.nothingBefore" });
    expect(s.slot.tokens).toHaveLength(2);
    const d = new SlotModel(CAT, { tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
    d.caretAtForTest("num", 0);
    expect(d.apply(DEL)).toMatchObject({ ok: false });
    expect(d.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
  });
  it("÷ with the caret inside the numerator keeps every factor in the numerator, the caret at the new denominator's start", () => {
    const s = new SlotModel(CAT, { tokens: [{ unit: "J" }, { unit: "K" }, { unit: "s" }] });
    s.caretAtForTest("num", 1);
    expect(s.apply({ do: "per" })).toEqual({ ok: true });
    expect(s.caret).toEqual({ side: "den", i: 0 });
    s.apply(U("m"));
    expect(s.slot).toEqual({ tokens: [{ unit: "J" }, { unit: "K" }, { unit: "s" }, { unit: "m" }], per: 3 });
  });
  it("a move while a prefix or √ is armed is refused, as leaving the slot is; the caret stays", () => {
    const s = new SlotModel(CAT, { tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
    s.caretAtForTest("num", 1);
    s.apply(K);
    expect(s.move(-1)).toMatchObject({ ok: false, key: "units.slot.prefixAlone" });
    expect(s.vertical("down")).toMatchObject({ ok: false, key: "units.slot.prefixAlone" });
    expect(s.caret).toEqual({ side: "num", i: 1 });
    s.apply(K);
    s.apply({ do: "sqrt" });
    expect(s.move(1)).toMatchObject({ ok: false, key: "units.slot.rootAlone" });
  });
  it("a move ends a letter run that reads as a unit, and is refused with one that does not", () => {
    const s = new SlotModel(slotCatalogue([
      { id: "unit:m", kind: "unit", names: ["m"], title: "Meter", tier: 0, insert: "\\unit{m}{\\mathrm{m}}", si: "1", dim: "m1" },
    ]), { tokens: [{ unit: "m" }] });
    s.type("m");
    expect(s.move(-1)).toEqual({ ok: true, moved: true });
    expect(s.typing).toBe(false);
    s.type("z");
    expect(s.move(1)).toMatchObject({ ok: false, key: "units.slot.notUnit" });
  });
});
