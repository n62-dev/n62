// SPDX-License-Identifier: GPL-3.0-or-later
// G785: the Format key skips a step that would draw what the row already shows, and a press that changes nothing (Fmt or
// a b/c) is a dead press. Expected texts are `derived`: 5 = 5×10^0 and 1234 = 1.234×10^3 have an exponent that is a
// multiple of 3, so Engineering draws them as Scientific does; 1/3 = 3.33…×10^-1 does not (ENG 333.33…×10^-3).
import { beforeAll, describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { NumberFormat } from "../calc/port.ts";
import { decimalFromRational } from "../engine/rational.ts";
import { cycleForm, cycleFormat, fmtStep, formDead } from "./cycleForms.ts";
import { NOTATION_MODES, type FmtMode } from "./displayMode.ts";
import { fakeKv } from "./fakeKv.ts";
import { loadForms, Session, type HistoryItem, type View } from "./session.svelte.ts";

const q = (p: bigint, d = 1n) => decimalFromRational(p, d);
let id = 1;
/** A finished row as Home (value, exact rational, facts) or CAS (an exact result: the engine's text, value and rational,
 *  no facts; resultItem.ts casItem) keeps it. */
function row(view: View, n: bigint, d = 1n, im = 0n): HistoryItem {
  const text = im !== 0n ? `${n}+${im}*i` : d === 1n ? `${n}` : `${n}/${d}`;
  return {
    id: id++,
    view,
    latex: text,
    status: "done",
    resultLatex: text,
    text,
    approximate: false,
    ...(view === "home" || im === 0n ? { value: { re: q(n, d), im: q(im) } } : {}), // (CAS reads no value from 1+i's text)
    ...(im === 0n ? { rational: { n: String(n), d: String(d) } } : {}),
    ...(view === "home" ? { facts: { exact: true, reliableDigits: null } } : {}),
    startedAt: 0,
  };
}
function session(view: View, cycle: FmtMode[], format: NumberFormat = "std", digits = 12): Session {
  const s = new Session(new FakeCalc(), fakeKv());
  s.view = view;
  s.settings.fmtCycle = cycle;
  s.settings.format = format;
  s.settings.digits = digits;
  return s;
}
/** What the row shows: its text and its mark. */
const look = (s: Session, item: HistoryItem): string => `${s.display(item).text} ${JSON.stringify(s.mark(item))}`;
/** The texts after each of `n` Format presses. */
async function presses(s: Session, item: HistoryItem, n: number): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < n; i++) {
    await cycleFormat(s, s.calc, item);
    seen.push(s.display(item).text);
  }
  return seen;
}

beforeAll(async () => {
  await loadForms(); // the forms code in, as after main.ts's idle load: the session draws a base form with it
});

describe("G785: the Format key skips a step that draws the same", () => {
  it("Home, the default cycle at 12 digits: 5 goes to SCI, then back to 5 (ENG draws 5 as SCI does)", async () => {
    const s = session("home", ["std", "sci", "eng"]);
    const five = row("home", 5n);
    s.home.push(five);
    expect(s.display(five).text).toBe("5");
    expect(await presses(s, five, 3)).toEqual(["5.00000000000E0", "5", "5.00000000000E0"]);
  });
  it("Home, the default cycle: 1234 skips ENG the same way; 1/3 skips nothing", async () => {
    const s = session("home", ["std", "sci", "eng"]);
    const big = row("home", 1234n);
    const third = row("home", 1n, 3n);
    s.home.push(big, third);
    expect(await presses(s, big, 2)).toEqual(["1.23400000000E3", "1234"]);
    expect(await presses(s, third, 3)).toEqual(["3.33333333333E-1", "333.333333333E-3", "0.333333333333"]);
  });
  it("CAS, cycle STD SCI, digits 6: 5 goes to SCI at once (STD draws the exact 5), then back to the exact form", async () => {
    const s = session("cas", ["std", "sci"], "std", 6);
    const five = row("cas", 5n);
    s.cas.push(five);
    expect(s.display(five).text).toBe("5");
    expect(fmtStep(s, five)).toEqual({ mode: "sci" });
    expect(await presses(s, five, 2)).toEqual(["5.00000E0", "5"]);
    expect(five.fmt).toBeUndefined(); // the exact form again
  });
  it("Home, Format PFX (not ticked), cycle STD SCI, digits 6: 5 goes to SCI at once (STD draws 5 as PFX does)", async () => {
    const s = session("home", ["std", "sci"], "pfx", 6);
    const five = row("home", 5n);
    s.home.push(five);
    expect(s.display(five).text).toBe("5");
    expect(await presses(s, five, 2)).toEqual(["5.00000E0", "5"]);
  });
  it("Home, cycle STD only: 5 has no step that changes it, a dead press; 1/3 in SCI goes back to STD", async () => {
    const s = session("home", ["std"]);
    const five = row("home", 5n);
    s.home.push(five);
    expect(fmtStep(s, five)).toBeNull();
    expect(formDead(s, five, "cycleFormat")).toBe(true);
    expect(await cycleFormat(s, s.calc, five)).toBe(false);
    expect(five.fmt).toBeUndefined();
    const third = { ...row("home", 1n, 3n), fmt: "sci" as const };
    expect(formDead(s, third, "cycleFormat")).toBe(false);
  });
  it("a form chosen with a b/c: Fmt goes back to the number in its notation", async () => {
    const s = session("home", ["std", "sci", "eng"]);
    const half = row("home", 1n, 2n);
    s.home.push(half);
    expect(await cycleForm(s, s.calc, half)).toBe(true);
    expect(s.display(half).text).toBe("1/2");
    expect(await presses(s, half, 2)).toEqual(["0.5", "5.00000000000E-1"]);
  });
});

describe("G785: a b/c that changes nothing is a dead press", () => {
  it("a whole number and a complex number in CAS (no value) have no other form; a third and 1+i in Home do", () => {
    const s = session("home", ["std", "sci", "eng"]);
    expect(formDead(s, row("home", 5n), "cycleForm")).toBe(true);
    expect(formDead(s, row("home", 1234n), "cycleForm")).toBe(true);
    expect(formDead(s, row("home", 1n, 3n), "cycleForm")).toBe(false);
    expect(formDead(s, row("home", 1n, 1n, 1n), "cycleForm")).toBe(false);
    expect(formDead(s, row("cas", 5n, 2n), "cycleForm")).toBe(false);
    expect(formDead(s, row("cas", 5n), "cycleForm")).toBe(true);
  });
  it("Session.formRow: no row, or the forms code says dead, is undefined; else the row the key takes", () => {
    const s = session("home", ["std"]);
    expect(s.formRow("cycleFormat", null)).toBeUndefined();
    const five = row("home", 5n);
    s.home.push(five);
    expect(s.formRow("cycleFormat", null)).toBeUndefined();
    expect(s.formRow("cycleForm", null)).toBeUndefined();
    s.settings.fmtCycle = ["std", "sci"];
    expect(s.formRow("cycleFormat", null)?.id).toBe(five.id);
  });
});

// The sweep: results × cycles × global formats, Home and CAS. Each press either changes what the row shows (its text or
// its mark) or is dead and changes nothing; it is dead only when no ticked step draws otherwise; and the presses reach every
// drawing a ticked step makes (nothing is skipped that differs).
describe("G785: the sweep", () => {
  const results: [string, bigint, bigint, bigint][] = [
    ["5", 5n, 1n, 0n],
    ["1/3", 1n, 3n, 0n],
    ["2.5", 5n, 2n, 0n],
    ["1234", 1234n, 1n, 0n],
    ["1E-5", 1n, 100000n, 0n],
    ["-7/3", -7n, 3n, 0n],
    ["1+i", 1n, 1n, 1n],
  ];
  const cycles: FmtMode[][] = [["std"], ["sci"], ["std", "sci"], ["std", "sci", "eng"], ["sci", "eng"], ["std", "pfx"], ["eng", "fix"], [...NOTATION_MODES]];
  const formats: NumberFormat[] = ["std", "sci", "eng", "pfx"];
  for (const view of ["home", "cas"] as const) {
    it(`${view}: every press changes the row or is dead, and reaches every other drawing`, async () => {
      let checked = 0;
      for (const [name, n, d, im] of results) {
        for (const cycle of cycles) {
          for (const format of formats) {
            for (const digits of [6, 12]) {
              const s = session(view, cycle, format, digits);
              const item = row(view, n, d, im);
              (view === "home" ? s.home : s.cas).push(item);
              const where = `${view} ${name} [${cycle.join(" ")}] ${format} ${digits}`;
              // every drawing a ticked step makes (CAS: the exact form too), as the row would show it
              const steps: (FmtMode | undefined)[] = [...(view === "cas" ? [undefined] : []), ...cycle];
              const drawings = new Set(steps.map((m) => look(s, { ...item, fmt: m })));
              const start = look(s, item);
              const others = new Set([...drawings].filter((x) => x !== start));
              const reached = new Set<string>();
              for (let i = 0; i < steps.length + 1; i++) {
                const before = look(s, item);
                const dead = formDead(s, item, "cycleFormat");
                const changed = await cycleFormat(s, s.calc, item);
                const after = look(s, item);
                expect(changed, where).toBe(!dead);
                expect(after !== before, where).toBe(changed);
                if (after !== start) reached.add(after);
              }
              // a factsless CAS row that is not a number (1+i: no value there) has no step at all
              const numeric = view === "home" || im === 0n;
              expect(reached, where).toEqual(numeric ? others : new Set());
              checked++;
            }
          }
        }
      }
      expect(checked).toBe(results.length * cycles.length * formats.length * 2);
    });
  }
});
