// SPDX-License-Identifier: GPL-3.0-or-later
// G382 (F206): a decimal inside a string is text, never rounded to the display digits. floatsAtDigits rounded every
// float literal of Giac's print, the digits inside a string too (`"0.1234567890123456789"` showed as
// `"0.123456789012"`). Expected values (source: derived): a string comes back as Giac printed it (a typed `\"` prints
// as a doubled quote); 1/3 at 12 digits is 0.333333333333; the controls are the texts as they were before G382.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { engineGiac, giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { floatsAtDigits, type Giac } from "./numeric.ts";

const LONG = "0.1234567890123456789";
const THIRD = "0.3333333333333333333333333333333333333333";

describe.skipIf(!giacAvailable())("G382: a decimal inside a string is never rounded (real Giac)", () => {
  let host: EngineHost;
  let giac: Giac;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    const g = engineGiac(L);
    giac = g;
    host = new EngineHost(g, L.bridge);
  });
  const home = (input: string): string | undefined => host.home(input, defaultHomeSettings).result.display;
  const cas = (input: string): string | undefined => host.cas(input, defaultCasSettings).result.text;

  // each string as typed, as Giac prints it: a plain decimal, one with an exponent, one after an escaped quote
  const STRINGS: readonly [string, string][] = [
    [`"${LONG}"`, `"${LONG}"`],
    ['"1.2345678901234567e300"', '"1.2345678901234567e300"'],
    [`"a\\"${LONG}"`, `"a""${LONG}"`],
  ];
  it.each(STRINGS)("floatsAtDigits leaves the string %s and rounds the float beside it", (_typed, printed) => {
    expect(floatsAtDigits(giac, `list[x,${printed},${THIRD}]`, 12)).toBe(`list[x,${printed},0.333333333333]`);
  });
  it.each(STRINGS)("Home keeps the string %s", (typed, printed) => {
    expect(home(`list[x,${typed},evalf(1/3)]`)).toBe(`{x,${printed},0.333333333333}`);
  });
  it.each(STRINGS)("CAS keeps the string %s", (typed, printed) => {
    expect(cas(`list[x,${typed},evalf(1/3)]`)).toBe(`{x,${printed},0.333333333333}`);
  });

  it("control (passes before G382): a float outside any string rounds as before, G38's decision stays", () => {
    expect(floatsAtDigits(giac, `${THIRD}*x+${THIRD}e20*y-0.9999999999999999999999999999999999999999*z+2`, 12)).toBe(
      "0.333333333333*x+3.33333333333e+19*y-1.0*z+2",
    );
    expect(home("piecewise(sin(10^50)>0,x,evalf(1/2)*x)")).toBe("0.5*x");
    expect(cas("piecewise(sin(10^50)>0,x,evalf(1/2)*x)")).toBe("0.5*x");
  });

  it("control (passes before G382): a name with digits, a hex literal and a long integer are untouched", () => {
    expect(floatsAtDigits(giac, `x1*${THIRD}+0x1F+12345678901234567890`, 12)).toBe("x1*0.333333333333+0x1F+12345678901234567890");
  });

  it("control (passes before G382): a string alone comes back as typed", () => {
    expect(home(`"${LONG}"`)).toBe(`"${LONG}"`);
    expect(cas(`"${LONG}"`)).toBe(`"${LONG}"`);
  });
});
