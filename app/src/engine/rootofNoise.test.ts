// SPDX-License-Identifier: GPL-3.0-or-later
// G324 (F220): on the unaudited check (a double against P), a part that is 0 as a double and not at P is noise only
// when the read at P + 20 fell by NOISE_DROP decades or more (G60's rule); a true small part is kept. Real Giac.
import { beforeAll, describe, expect, it } from "vitest";
import { engineGiac, giacAvailable, loadNodeGiac, nodeHost, type EngineGiac } from "./nodeGiac.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { confirmedComplex, DOUBLE_DIGITS, valueAt, withDigits } from "./numeric.ts";
import { isZero, type ComplexValue } from "./format.ts";
import { NOISE_DROP, withoutDoubleNoise, zeroInDouble } from "./rootofNoise.ts";

const P = 40;
/** The real root of x^3-x-1 as Giac's solve gives it (1.32471795724, mpmath polyroots: one real root). */
const ROOTOF = "-1/54*rootof([[3,0,-15,-27,12],[1,0,-6,0,9,0,23]])";
/** 1 + (exp(10^-38)-1)*i: the imaginary part is 10^-38 + 10^-76/2 + … (derived, the series of exp), a true small part
 *  that a double rounds to 0. */
const TRUE_SMALL = "1+i*(exp(10^-38)-1)";

describe.skipIf(!giacAvailable())("G324: a part 0 as a double is G60's noise only when it falls at P + 20", () => {
  let giac: EngineGiac;
  beforeAll(async () => {
    giac = engineGiac(await loadNodeGiac());
  });
  const read = (text: string, d: number): ComplexValue => {
    const parts = withDigits(giac, d, 12, () => valueAt(giac, text, { kind: "scalar" }, d, P).parts);
    expect(parts).not.toBeNull();
    return parts![0]!;
  };
  const three = (text: string): [ComplexValue, ComplexValue, ComplexValue] => [read(text, DOUBLE_DIGITS), read(text, P), read(text, P + 20)];

  it("the rootof: 0 as a double, about 1E-40 at P, NOISE_DROP decades less at P + 20: shown as 0, the real part counts", () => {
    const [d, m, b] = three(ROOTOF);
    expect(zeroInDouble(d, m)).toBe(true);
    expect(m.im.exp - (isZero(b.im) ? -Infinity : b.im.exp)).toBeGreaterThanOrEqual(NOISE_DROP);
    expect(confirmedComplex(d, m, DOUBLE_DIGITS, P)).toBe(0); // today's count: 0 against 1E-40
    const v = withoutDoubleNoise(d, m, b, P);
    expect(isZero(v.im)).toBe(true);
    expect(v.re).toEqual(m.re);
    expect(confirmedComplex(d, v, DOUBLE_DIGITS, P)).toBeGreaterThanOrEqual(12);
  });

  it("a true small part: 0 as a double, about 1E-38 at P and at P + 20: kept (a stub that zeroes it fails here)", () => {
    const [d, m, b] = three(TRUE_SMALL);
    expect(zeroInDouble(d, m)).toBe(true);
    expect(isZero(b.im)).toBe(false);
    expect(b.im.exp).toBe(-38);
    const v = withoutDoubleNoise(d, m, b, P);
    expect(v).toBe(m);
    expect(isZero(v.im)).toBe(false);
  });

  it("without the read at P + 20 the part is compared as before", () => {
    const [d, m] = three(ROOTOF);
    expect(withoutDoubleNoise(d, m, null, P)).toBe(m);
  });

  it("a part the double has (1 + 1E-20*i, a true small part) asks for no third read", () => {
    const [d, m] = three("1+i*10^-20");
    expect(zeroInDouble(d, m)).toBe(false);
  });

  it("in Home: the rootof's ≈ shows the real root, a true small part keeps its imaginary part", async () => {
    const host = await nodeHost();
    const home = (input: string) => host.home(input, defaultHomeSettings).result;
    expect(home("approx(solve(x^3-x-1=0,x))").display).toBe("{1.32471795724}"); // mpmath polyroots: one real root
    const kept = home(`approx(simplify(${TRUE_SMALL}))`); // simplify: unaudited, so the double against P
    expect(kept.facts.warn).toBe("unaudited");
    expect(kept.display).toMatch(/^1\+1E-38\*i$/);
  });
});
