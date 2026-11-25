// SPDX-License-Identifier: GPL-3.0-or-later
// G799: the view sweep's marks and Copy checks (tools/probes/sweep/agree.ts) on hand-made rows. The red cases are the owner-style
// hunt's of 2026-11-23: CAS approx([1/3,2/3]) drawn with no mark where Home has ≈ (G794, as casItem kept it before that fix), and Copy
// of Home's fsolve(x^3-2=0,x) row writing 13 digits where 12 are shown and none is confirmed (G796; the copied text is phase-1's,
// seen in this package's probe: 1.259921049895).
import { describe, expect, it } from "vitest";
import { decimalFromString, type ComplexValue } from "../src/engine/format.ts";
import type { ValueFacts } from "../src/engine/types.ts";
import type { DisplayContext } from "../src/state/displayMode.ts";
import type { HomeIn } from "../src/state/results.ts";
import { casRow, compareMarks, homeRow, judgeCopy, markKind, significantDigits, type Row } from "../../tools/probes/sweep/agree.ts";

const ctx: DisplayContext = { format: "std", digits: 12, fixDecimals: 4, angle: "rad" };
const real = (s: string): ComplexValue => ({ re: decimalFromString(s, 1000)!, im: decimalFromString("0")! });
const third = "0.3333333333333333333333333333333333333333";
const twoThirds = "0.6666666666666666666666666666666666666667";
const floats: ValueFacts = { exact: false, reliableDigits: null };

/** Home (or CAS's numeric) of approx([1/3,2/3]): a list of two floats, every digit confirmed. */
const listIn: HomeIn = {
  ok: true,
  display: "[0.333333333333,0.666666666667]",
  approximate: true,
  full: `[${third},${twoThirds}]`,
  facts: floats,
  items: [
    { value: real(third), facts: floats },
    { value: real(twoThirds), facts: floats },
  ],
  shape: [1, 2],
};
const casList = casRow({ ok: true, text: listIn.display, facts: floats, approximate: true, numeric: listIn })!;

/** Home of fsolve(x^3-2=0,x): ⚠ "fsolve is not checked"; its `full` (the chip text Copy writes) has 13 digits. */
const fsolveRow = homeRow({ ok: true, display: "1.25992104989", approximate: true, value: real("1.259921049894873"), full: "1.259921049895", facts: { exact: false, reliableDigits: null, warn: "unaudited" } })!;

/** A Home row of `value` with these facts (exact: its rational `exact` too). */
const home = (display: string, value: string, facts: ValueFacts, exact?: string): Row => homeRow({ ok: true, display, approximate: !facts.exact, value: real(value), full: exact ?? value, facts, ...(exact ? { exact } : {}) })!;

describe("marks agree (G799)", () => {
  it("G794: CAS approx([1/3,2/3]) with no mark where Home has ≈ fails; with its elements' facts (G794's fix) it agrees", () => {
    const before: Row = { ...casList, facts: undefined }; // casItem before G794 kept no facts for a list
    expect(markKind(before, ctx)).toBe("unmarked");
    expect(compareMarks(homeRow(listIn)!, before, ctx)).toMatch(/^CAS draws a float with no mark: \[0\.333333333333,0\.666666666667\] \(Home ≈ /);
    expect(markKind(casList, ctx)).toBe("float");
    expect(compareMarks(homeRow(listIn)!, casList, ctx)).toBeNull();
  });
  it("a ⚠ on one side and ≈ on the other fails, and so does Home's = beside CAS's ≈", () => {
    const sure = home("1.25992104989", "1.259921049894873", floats);
    expect(compareMarks(sure, { ...fsolveRow, view: "cas" }, ctx)).toMatch(/^Home ≈ 1\.25992104989 against CAS ⚠ 1\.25992104989$/);
    expect(compareMarks(fsolveRow, { ...sure, view: "cas" }, ctx)).toMatch(/^Home ⚠ .* against CAS ≈ /);
    const exact = home("0.09", "0.09", { exact: true, reliableDigits: null }, "9/100");
    const asFloat: Row = { ...home("0.09", "0.09", floats), view: "cas" };
    expect(markKind(exact, ctx)).toBe("exact");
    expect(compareMarks(exact, asFloat, ctx)).toMatch(/^Home = 0\.09 against CAS ≈ 0\.09$/);
  });
  it("CAS keeping an exact value (a number or a symbolic result) agrees with Home's decimal", () => {
    const h = home("0.333333333333", third, floats);
    const q = casRow({ ok: true, text: "1/3", facts: { exact: true, reliableDigits: null } })!;
    expect(markKind(q, ctx)).toBe("exact");
    expect(compareMarks(h, q, ctx)).toBeNull();
    const sym = casRow({ ok: true, text: "sin(3/10)", facts: { exact: true, reliableDigits: null } })!;
    expect(markKind(sym, ctx)).toBe("other");
    expect(compareMarks(h, sym, ctx)).toBeNull();
  });
});

describe("Copy keeps its word (G799)", () => {
  it("G796: Copy of the fsolve row writes 13 digits where 12 are shown and none is confirmed", () => {
    expect(judgeCopy(fsolveRow, "1.259921049895", ctx)).toMatch(/^Copy writes 13 digits of 1\.259921049895 where 12 are shown and none is confirmed \(⚠ 1\.25992104989; /);
    expect(judgeCopy(fsolveRow, "1.25992104989", ctx)).toBeNull(); // what it shows: G796's fix
    // the engine's own row: its agreement count is 13, but fsolve is unaudited, so the mark is a bare ⚠ that claims no digit
    const live = homeRow({ ok: true, display: "1.25992104989", approximate: true, value: real("1.259921049894899169885320588946342468262"), full: "1.259921049895", facts: { exact: false, reliableDigits: 13, warn: "unaudited", why: { unaudited: ["fsolve"] } } })!;
    expect(judgeCopy(live, "1.259921049895", ctx)).toMatch(/^Copy writes 13 digits of 1\.259921049895 where 12 are shown and none is confirmed \(⚠ 1\.25992104989; /);
  });
  it("a counted row copies its confirmed digits and no more; a sure float every kept digit", () => {
    const counted = home("1.2599210499", "1.259921049894873", { exact: false, reliableDigits: 11 });
    expect(judgeCopy(counted, "1.2599210499", ctx)).toBeNull();
    expect(judgeCopy(counted, "1.25992104989", ctx)).toMatch(/12 digits .* where 11 are confirmed/);
    expect(judgeCopy(home("0.333333333333", third, floats), third, ctx)).toBeNull();
  });
  it("a list's elements each by their own count", () => {
    const counted: HomeIn = { ...listIn, items: [listIn.items![0]!, { value: real(twoThirds), facts: { exact: false, reliableDigits: 5 } }] };
    expect(judgeCopy(homeRow(counted)!, `[${third},0.66667]`, ctx)).toBeNull();
    expect(judgeCopy(homeRow(counted)!, `[${third},0.666667]`, ctx)).toMatch(/^Copy writes 6 digits of 0\.666667 where 5 are confirmed/);
  });
  it("an exact row's copy reads back through Paste to the same value, to its 40th digit", () => {
    const exact = home("0.09", "0.09", { exact: true, reliableDigits: null }, "9/100");
    expect(judgeCopy(exact, "0.09", ctx)).toBeNull();
    expect(judgeCopy(exact, "0.0900000001", ctx)).toMatch(/^Paste reads the copy 0\.0900000001 back as another value than the exact 9\/100/);
    expect(judgeCopy(exact, "9/100", ctx)).toMatch(/^Paste refuses the copy 9\/100/);
    const q = casRow({ ok: true, text: "1/3", facts: { exact: true, reliableDigits: null } })!;
    expect(judgeCopy(q, third, ctx)).toBeNull();
    expect(judgeCopy(q, "0.333333333333", ctx)).toMatch(/another value than the exact 1\/3/);
    const big = casRow({ ok: true, text: "-123456789012345678901234567890123456789012345", facts: { exact: true, reliableDigits: null } })!;
    expect(judgeCopy(big, "-123456789012345678901234567890123456789012345", ctx)).toBeNull();
    expect(judgeCopy(big, "-123456789012345678901234567890123456789012346", ctx)).not.toBeNull();
    expect(judgeCopy(home("1E-7", "0.0000001", { exact: true, reliableDigits: null }, "1/10000000"), "1E-7", ctx)).toBeNull();
  });
  it("counts the significant digits of a number as Copy writes it", () => {
    expect(significantDigits("-1.25E-7")).toBe(3);
    expect(significantDigits("1200")).toBe(2);
    expect(significantDigits("0.090")).toBe(2);
    expect(significantDigits("0.0000001")).toBe(1);
  });
});
