// SPDX-License-Identifier: GPL-3.0-or-later
// R260 (night review 2026-11-09, vvr-1): a one-letter function named e or i is the letter's stand-in, e_ or i_, as the
// letter is everywhere else (R58b, R67): `e(x):=x+1` reached Giac as a store into exp(1), which it refuses. The call
// side reads the session's stored functions (userFunctionsOf), which hold the engine's name e_. The text here is exact
// (tests/golden/parser.yaml r260-* decides the same rows by Giac).
import { describe, expect, it } from "vitest";
import { latexToGiac, latexToGiacInfo, userFunctionsOf } from "./latex-to-giac.ts";

describe("R260: e and i as function names", () => {
  it("a definition of e or i defines e_ or i_ (derived: R58b, a typed letter is always a name)", () => {
    expect(latexToGiac("e\\left(x\\right):=x+1")).toBe("e_(x):=x+1");
    expect(latexToGiac("i\\left(x\\right):=x+1")).toBe("i_(x):=x+1");
    expect(latexToGiacInfo("e\\left(x\\right):=x+1").defines).toBe("e_");
  });

  it("the definition's own body may call it (the name counts at once)", () => {
    expect(latexToGiac("e\\left(x\\right):=x+e\\left(1\\right)")).toBe("e_(x):=x+e_(1)");
  });

  it("the session's stored e_ makes e(2) its call; the key's constant is untouched", () => {
    const user = userFunctionsOf([{ name: "e_", kind: "fn" }, { name: "i_", kind: "fn" }]);
    expect(user.has("e_")).toBe(true);
    expect(latexToGiac("e\\left(2\\right)", { userFunctions: user })).toBe("e_(2)");
    expect(latexToGiac("i\\left(2\\right)+\\imaginaryI", { userFunctions: user })).toBe("i_(2)+i");
    expect(latexToGiac("\\exponentialE+e\\left(2\\right)", { userFunctions: user })).toBe("exp(1)+e_(2)");
  });

  it("control: without a stored e, e(2) is the name e_ times 2, as before", () => {
    expect(latexToGiac("e\\left(2\\right)")).toBe("e_*(2)");
    expect(userFunctionsOf([{ name: "e_", kind: "var" }, { name: "beta_", kind: "fn" }]).has("e_")).toBe(false);
  });

  it("R260f1: Vars inserts a stored e_ as \\operatorname{e} with its bracket; the stored stand-in makes it the call of e_", () => {
    const user = userFunctionsOf([{ name: "e_", kind: "fn" }, { name: "i_", kind: "fn" }]);
    expect(latexToGiac("\\operatorname{e}\\left(2\\right)", { userFunctions: user })).toBe("e_(2)");
    expect(latexToGiac("\\operatorname{\\mathrm{e}}\\left(2\\right)", { userFunctions: user })).toBe("e_(2)");
    expect(latexToGiac("3\\operatorname{i}\\left(2\\right)+\\imaginaryI", { userFunctions: user })).toBe("3*i_(2)+i");
  });

  it("R260f1 control: without a stored function e_, \\operatorname{e}( is read as before", () => {
    const before = latexToGiac("\\operatorname{e}\\left(2\\right)");
    expect(before).not.toContain("e_");
    expect(latexToGiac("\\operatorname{e}\\left(2\\right)", { userFunctions: userFunctionsOf([{ name: "e_", kind: "var" }]) })).toBe(before);
  });
});
