// SPDX-License-Identifier: GPL-3.0-or-later
// G405: size, dim or nops of a list Giac computed with floats takes the list's mark. Expected marks are derived from the
// rule (docs/04 2.1, a non-number's row); the engine rows are golden g405-* (precision.yaml).
import { describe, expect, it } from "vitest";
import { countedArgument, countFacts } from "./counts.ts";
import type { ElementFacts, Giac } from "./numeric.ts";
import { decimalFromString } from "./format.ts";

const three: ElementFacts = { value: { re: decimalFromString("3", 40)!, im: decimalFromString("0", 40)! }, exact: true, reliableDigits: null, big: false };

/** A Giac that answers each text from a table (Digits sets answer themselves). */
function fake(answers: Record<string, string>): Giac & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    eval: (t: string) => (asked.push(t), answers[t] ?? (t.startsWith("Digits:=") ? t.slice(8) : "GIAC_ERROR: unknown")),
    value: () => ({ kind: "error", text: "GIAC_ERROR: not used" }),
  };
}

describe("countedArgument", () => {
  it("takes the argument of a whole size, dim or nops call that computes something", () => {
    expect(countedArgument("size(solve(x^3-3*x+2=0,x))")).toBe("solve(x^3-3*x+2=0,x)");
    expect(countedArgument("dim(evalf([1,2]))")).toBe("evalf([1,2])");
    expect(countedArgument("nops(proot([1,0,-1]))")).toBe("proot([1,0,-1])");
  });
  it("leaves a literal list, a name, a call inside a sum and two arguments", () => {
    expect(countedArgument("size([1,2,3])")).toBeNull();
    expect(countedArgument("size(L)")).toBeNull();
    expect(countedArgument("size(solve(x^2=2,x))+1")).toBeNull();
    expect(countedArgument("dim(solve(x^2=2,x),1)")).toBeNull();
  });
});

describe("countFacts", () => {
  it("gives ⚠ (unaudited) to the count of a list an unaudited function computed with floats", () => {
    const g = fake({ "solve(x^3-3*x+2-10^-30=0,x)": "list[-2.0,0.999999999999999422649730810374,1.00000000000000057735026918963]" });
    const [f] = countFacts(g, "size(solve(x^3-3*x+2-10^-30=0,x))", 40, 12, [three]);
    expect(f).toMatchObject({ exact: true, warn: "unaudited" });
  });
  it("gives ≈ to the count of a list of floats from audited functions", () => {
    const g = fake({ "evalf([1,2,3])": "[1.0,2.0,3.0]" });
    const [f] = countFacts(g, "size(evalf([1,2,3]))", 40, 12, [three]);
    expect(f).toMatchObject({ exact: false });
    expect(f!.warn).toBeUndefined();
  });
  it("keeps = for a count of an exact list, and asks Giac nothing for a literal list", () => {
    const g = fake({ "solve(x^3-3*x+2=0,x)": "list[-2,1]" });
    expect(countFacts(g, "size(solve(x^3-3*x+2=0,x))", 40, 12, [three])).toEqual([three]);
    const h = fake({});
    expect(countFacts(h, "size([1,2,3])", 40, 12, [three])).toEqual([three]);
    expect(h.asked).toEqual([]);
  });
});
