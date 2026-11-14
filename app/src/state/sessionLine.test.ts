// SPDX-License-Identifier: GPL-3.0-or-later
// G210: one result as one JSON line (session format v0). Fixed rows, no engine: each row's line is written out here,
// key order included; the values are the rows' own (copyFull and copyMark read them as Copy does).
import { describe, expect, it } from "vitest";
import { decimalFromString, ZERO_VALUE, type ComplexValue } from "../engine/format.ts";
import type { HistoryItem } from "./session.svelte.ts";
import { sessionLine } from "./sessionLine.ts";

const re = (s: string): ComplexValue => ({ re: decimalFromString(s) ?? ZERO_VALUE, im: ZERO_VALUE });
const T = new Date(Date.UTC(2026, 10, 14, 3, 0, 0));
const O = { t: T, app: "0.1.0" };
const row = (o: Partial<HistoryItem>): HistoryItem => ({
  id: 1,
  view: "home",
  latex: "",
  status: "done",
  resultLatex: "",
  text: "",
  approximate: false,
  startedAt: 0,
  ...o,
});
const HEAD = String.raw`{"v":0,"app":"0.1.0",`;
const TS = String.raw`"t":"2026-11-14T03:00:00.000Z"`;

const exact = row({ uid: "r-1", latex: String.raw`\frac{3}{4}`, giac: "3/4", text: "0.75", value: re("0.75"), rational: { n: "3", d: "4" },
  facts: { exact: true, reliableDigits: null, digits: 12 }, full: "3/4", fullExact: true, angle: "rad", digits: 12 });

describe("sessionLine (G210)", () => {
  it("an exact row", () => {
    expect(sessionLine(exact, O)).toBe(
      HEAD + String.raw`"id":"r-1",${TS},"view":"home","input":"\\frac{3}{4}","giac":"3/4","ok":true,"exact":"3/4","value":"0.75","mark":"=","reliableDigits":null,"angle":"rad","digits":12}`,
    );
  });

  it("a ≈ row: the value with every digit kept, the exact text beside it", () => {
    const r = row({ uid: "r-2", latex: String.raw`\sqrt{2}`, giac: "sqrt(2)", text: "1.41421356237", value: re("1.414213562373095048801688724209698078570"),
      facts: { exact: false, reliableDigits: null, digits: 12 }, full: "sqrt(2)", fullExact: true, angle: "rad", digits: 12 });
    expect(sessionLine(r, O)).toBe(
      HEAD + String.raw`"id":"r-2",${TS},"view":"home","input":"\\sqrt{2}","giac":"sqrt(2)","ok":true,"exact":"sqrt(2)","value":"1.41421356237309504880168872420969807857","mark":"≈","reliableDigits":null,"angle":"rad","digits":12}`,
    );
  });

  it("a ⚠ row with its reason, and a ⚠ row with fewer confirmed digits than shown", () => {
    const w = row({ uid: "r-3", latex: String.raw`\operatorname{Ei}(1)`, giac: "Ei(1)", text: "1.89511781636", value: re("1.89511781635594"),
      facts: { exact: false, reliableDigits: 15, warn: "unaudited", digits: 12 }, full: "1.89511781635594", fullExact: false, angle: "rad", digits: 12 });
    expect(sessionLine(w, O)).toBe(
      HEAD + String.raw`"id":"r-3",${TS},"view":"home","input":"\\operatorname{Ei}(1)","giac":"Ei(1)","ok":true,"value":"1.89511781635594","mark":"⚠","warn":"unaudited","reliableDigits":15,"angle":"rad","digits":12}`,
    );
    const n = row({ uid: "r-4", latex: "x", giac: "x", text: "1.4142", value: re("1.4142135623730950488"), facts: { exact: false, reliableDigits: 5, digits: 12 }, angle: "rad", digits: 12 });
    expect(sessionLine(n, O)).toBe(HEAD + String.raw`"id":"r-4",${TS},"view":"home","input":"x","giac":"x","ok":true,"value":"1.4142","mark":"⚠","reliableDigits":5,"angle":"rad","digits":12}`);
  });

  it("a unit row: unit, dimension, σ and its why in their own fields, the value a number alone", () => {
    const r = row({ uid: "r-5", latex: String.raw`2\pi\cdot 25`, giac: "2*pi*25*pasu1", text: "39.488", value: re("39.488"), full: "39.488", fullExact: false,
      facts: { exact: false, reliableDigits: null, digits: 5 }, inexactInput: true, angle: "rad", digits: 12,
      units: { slots: {}, unit: "m²", dim: "m2", dimText: "L²", unc: { text: "1.2", shown: "39.5 ± 1.2", why: "order2" }, latex: "", text: " ± 1.2 m²", input: "" } });
    expect(sessionLine(r, O)).toBe(
      HEAD + String.raw`"id":"r-5",${TS},"view":"home","input":"2\\pi\\cdot 25","giac":"2*pi*25*pasu1","ok":true,"value":"39.488","mark":"≈","reliableDigits":null,"unit":"m²","dim":"m2","sigma":"1.2","sigmaWhy":"order2","angle":"rad","digits":12}`,
    );
  });

  it("an error row", () => {
    const r = row({ uid: "r-6", latex: String.raw`\frac{1}{0}`, giac: "1/0", status: "error", text: "Division by 0", angle: "rad", digits: 12 });
    expect(sessionLine(r, O)).toBe(HEAD + String.raw`"id":"r-6",${TS},"view":"home","input":"\\frac{1}{0}","giac":"1/0","ok":false,"error":"Division by 0","angle":"rad","digits":12}`);
  });

  it("a chip input: \\res{7} in input and pasr_7 in giac name the res:7 entry of the same line", () => {
    const third = "0.3333333333333333333333333333333333333333";
    const r = row({ uid: "r-7", latex: String.raw`\res{7}{0.333333333333}\cdot3`, giac: "pasr_7*3", text: "1", value: re("0.9999999999999999999999999999999999999999"),
      full: "0.9999999999999999999999999999999999999999", fullExact: false, facts: { exact: false, reliableDigits: null, digits: 12 }, inexactInput: true,
      chips: { "res:7": { value: third, exact: false, reliableDigits: 40 } }, angle: "rad", digits: 12 });
    expect(sessionLine(r, O)).toBe(
      HEAD +
        String.raw`"id":"r-7",${TS},"view":"home","input":"\\res{7}{0.333333333333}\\cdot3","giac":"pasr_7*3","chips":{"res:7":{"value":"${third}","exact":false}},"ok":true,"value":"0.9999999999999999999999999999999999999999","mark":"≈","reliableDigits":null,"angle":"rad","digits":12}`,
    );
  });

  it("a DEG row", () => {
    const r = row({ uid: "r-8", latex: String.raw`\sin(30)`, giac: "sin(pasdeg*30)", text: "0.5", value: re("0.5"), rational: { n: "1", d: "2" },
      facts: { exact: true, reliableDigits: null, digits: 12 }, full: "1/2", fullExact: true, angle: "deg", digits: 12 });
    expect(sessionLine(r, O)).toBe(
      HEAD + String.raw`"id":"r-8",${TS},"view":"home","input":"\\sin(30)","giac":"sin(pasdeg*30)","ok":true,"exact":"1/2","value":"0.5","mark":"=","reliableDigits":null,"angle":"deg","digits":12}`,
    );
  });

  it("a DEG row whose exact text differs from the drawn one: exact is Giac's radian text, value the degree text", () => {
    // G46f1 (resultItem.ts homeItem): `full` is the radian text the chips carry, `drawn` the text the screen draws in DEG
    const r = row({ uid: "r-10", latex: String.raw`\sin(x)`, giac: "sin(pasdeg*x)", text: "sin(x)", full: "sin(pi*x/180)", fullExact: true, drawn: "sin(x)",
      angle: "deg", digits: 12 });
    expect(sessionLine(r, O)).toBe(
      HEAD + String.raw`"id":"r-10",${TS},"view":"home","input":"\\sin(x)","giac":"sin(pasdeg*x)","ok":true,"exact":"sin(pi*x/180)","value":"sin(x)","mark":"=","angle":"deg","digits":12}`,
    );
  });

  it("a CAS row that read a definition: defs; an exact row without facts is =", () => {
    const r = row({ uid: "r-9", view: "cas", latex: "f(2)", giac: "f(2)", text: "4", value: re("4"), rational: { n: "4", d: "1" }, full: "4", fullExact: true,
      uses: [{ name: "f", preview: "x^2", view: "cas" }], angle: "rad", digits: 12 });
    expect(sessionLine(r, O)).toBe(
      HEAD + String.raw`"id":"r-9",${TS},"view":"cas","input":"f(2)","giac":"f(2)","ok":true,"exact":"4","value":"4","mark":"=","angle":"rad","digits":12,"defs":[{"name":"f","preview":"x^2","view":"cas"}]}`,
    );
  });

  it("what a row does not hold is null (id, giac, angle, digits), never a guess", () => {
    const r = row({ id: 4, latex: "2+2", text: "4", value: re("4"), full: "4", fullExact: true, facts: { exact: true, reliableDigits: null } });
    expect(sessionLine(r, O)).toBe(HEAD + String.raw`"id":null,${TS},"view":"home","input":"2+2","giac":null,"ok":true,"exact":"4","value":"4","mark":"=","reliableDigits":null,"angle":null,"digits":null}`);
  });

  it("a row that is no result (pending, a note) gives no line", () => {
    expect(sessionLine(row({ status: "pending" }), O)).toBeUndefined();
    expect(sessionLine(row({ status: "note", text: "Safe start" }), O)).toBeUndefined();
  });

  it("the value is written with the point whatever the decimal mark; t is UTC", () => {
    const line = JSON.parse(sessionLine(exact, { t: new Date("2026-11-14T04:00:00+01:00"), app: "0.1.0" }) ?? "{}") as Record<string, unknown>;
    expect(line["value"]).toBe("0.75");
    expect(line["t"]).toBe("2026-11-14T03:00:00.000Z");
  });

  describe("identity: the row's uid, never HistoryItem.id", () => {
    const idOf = (i: HistoryItem): unknown => (JSON.parse(sessionLine(i, O) ?? "{}") as Record<string, unknown>)["id"];
    it("a store round trip gives the row a new HistoryItem.id, the line keeps its id", () => {
      const before = { ...exact, id: 3 };
      const after = { ...exact, id: 17 }; // read back at the next start: a new number
      expect(idOf(before)).toBe("r-1");
      expect(idOf(after)).toBe(idOf(before));
    });
    it("three rows, the second deleted, a restart and a fourth row: four different ids", () => {
      // before the restart: ids 1, 2, 3 with their uids; row 2 deleted; after it the rows are read back as 1, 2 and the
      // new row takes 3, the number row 3 had before
      const a = row({ id: 1, uid: "u-a", latex: "1" });
      const b = row({ id: 2, uid: "u-b", latex: "2" });
      const c = row({ id: 3, uid: "u-c", latex: "3" });
      const d = row({ id: 3, uid: "u-d", latex: "4" });
      const ids = [idOf(a), idOf(b), idOf(c), idOf(d)];
      expect(new Set(ids).size).toBe(4);
      expect(ids).not.toContain(null);
    });
    it("a row without a uid: id null", () => {
      expect(idOf(row({ id: 9, latex: "1" }))).toBeNull();
    });
  });
});
