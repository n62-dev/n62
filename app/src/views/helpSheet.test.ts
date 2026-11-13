// SPDX-License-Identifier: GPL-3.0-or-later
// R197: the help sheet's rows from a Find item (G231's example fields): the syntax with the description, the example
// drawn as LaTeX with its mark and result (and the angle unit of an inverse function's result), the Insert row. An item
// without an example (tier 1) has only its syntax. Pure: no sheet, no field.
import { describe, expect, it } from "vitest";
import type { FindItem } from "../find/types.ts";
import { helpRows, helpTitle } from "./helpSheet.ts";

const fn = (extra: Partial<FindItem>): FindItem => ({ id: "fn:sin", kind: "fn", names: ["sin"], title: "Sine", tier: 0, insert: "\\sin\\left(#0\\right)", ...extra });

describe("helpRows (R197)", () => {
  it("syntax, example with mark and result, Insert", () => {
    const put: string[] = [];
    const rows = helpRows(fn({ syntax: "sin(x)", desc: "Sine.", example: "\\sin\\left(30\\degree\\right)", exampleResult: "0.5", exampleMark: "=" }), (l) => put.push(l));
    expect(rows.map((r) => r.id)).toEqual(["syntax", "example", "insert"]);
    expect(rows[0]).toMatchObject({ label: "sin(x)", hint: "Sine.", keep: true });
    expect(rows[1]).toMatchObject({ latex: "\\sin\\left(30\\degree\\right)", value: "= 0.5", keep: true });
    rows[2]?.run?.();
    expect(put).toEqual(["\\sin\\left(30\\degree\\right)"]);
    expect(helpTitle(fn({}))).toBe("Help: Sine");
  });

  it("an angle-mode result says its unit; a symbolic result has no mark", () => {
    const asin = helpRows(fn({ syntax: "asin(x)", example: "\\arcsin\\left(0.5\\right)", exampleResult: "0.523598775598", exampleMark: "≈", exampleAngle: "rad" }), () => {});
    expect(asin[1]?.value).toBe("≈ 0.523598775598 (radians)");
    const deg = helpRows(fn({ syntax: "asin(x)", example: "x", exampleResult: "30", exampleMark: "=", exampleAngle: "deg" }), () => {});
    expect(deg[1]?.value).toBe("= 30 (degrees)");
    const sym = helpRows(fn({ syntax: "diff(f,x)", example: "x", exampleResult: "2*x", exampleMark: "" }), () => {});
    expect(sym[1]?.value).toBe("2*x");
  });

  it("no example (tier 1): the syntax alone; no syntax: the name with (…)", () => {
    expect(helpRows(fn({ tier: 1, syntax: "foo(x)", desc: "Giac's line." }), () => {}).map((r) => r.id)).toEqual(["syntax"]);
    expect(helpRows(fn({ names: ["cbrt"], kind: "tmpl" }), () => {})[0]?.label).toBe("cbrt(…)");
  });
});
