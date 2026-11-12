// SPDX-License-Identifier: GPL-3.0-or-later
// G312 (be-10): the polar form through the real engine, on the path of cycleForms.computePolar (abs and arg of the
// point value as the engine kept it). Home at 30 digits gives Gamma(0.5+i) and erf(1+i) with 14 and 13 confirmed digits;
// the polar form drew 30 (0.520590963616751249785481260734∡-0.955007724342558318998097965064, wrong from the 15th digit
// of r and the 14th of θ). Each number drawn must be the oracle's, rounded to the digits it shows. Oracle: mpmath at 60
// and 90 digits, agreeing (abs and arg of gamma(mpc(1/2, 1)) and erf(mpc(1, 1))).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../engine/host.ts";
import { engineGiac, giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { decimalFromString, decimalToString, formatReal, POLAR_SIGN, toText, type DecimalValue } from "../engine/format.ts";
import { PASDEG } from "../engine/pasdeg.ts";
import { polarOf } from "./cycleForms.ts";
import { markFor, renderNumeric, type DisplayContext, type NumericResult } from "./displayMode.ts";

const ORACLE: Record<string, [string, string]> = {
  "Gamma(0.5+i)": ["0.52059096361675194552520293044566002", "-0.95500772434256910956322512873451954"],
  "erf(1+i)": ["1.329859661866573490514959266435617", "0.14370733395223187466986683846248009"],
};

/** The shown number equals the oracle rounded to the significant digits it shows (a trailing zero cut by STD is shown
 *  in the oracle's rounding too: rounding to fewer digits gives the same text). */
function agrees(shown: string, oracle: string): { digits: number; ok: boolean } {
  const s = decimalFromString(shown) as DecimalValue;
  const digits = s.digits.length;
  const o = decimalFromString(oracle) as DecimalValue;
  return { digits, ok: toText(formatReal(o, { format: "STD", digits })) === shown };
}

describe.skipIf(!giacAvailable())("G312: the polar form of a ⚠ complex result at 30 digits", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(engineGiac(L), L.bridge);
  });
  for (const [input, [r0, t0]] of Object.entries(ORACLE)) {
    it(`${input}: r and θ agree with the oracle to the digits they show`, () => {
      const s = { ...defaultHomeSettings, digits: 30, angle: "rad" as const };
      const res = host.home(input, s).result;
      expect(res.ok && res.value).toBeTruthy();
      if (!res.ok || !res.value) return;
      const z = `((${decimalToString(res.value.re)})+(${decimalToString(res.value.im)})*i)`;
      const a = host.home(`abs(${z})`, s).result;
      const th = host.home(`(arg(${z})/${PASDEG})`, s).result;
      if (!a.ok || !th.ok || !a.value || !th.value) throw new Error("no abs or arg");
      const point: NumericResult = { value: res.value, facts: res.facts };
      const item: NumericResult = { ...point, polar: polarOf(point, res.value, a.value.re, th.value.re, "rad") };
      const ctx: DisplayContext = { format: "std", digits: 30, fixDecimals: 4, angle: "rad" };
      const text = renderNumeric(item, "polar", ctx)?.text ?? "";
      const [r, t] = text.split(POLAR_SIGN);
      const [ar, at] = [agrees(r ?? "", r0), agrees(t ?? "", t0)];
      expect({ text, r: ar.ok, theta: at.ok }).toEqual({ text, r: true, theta: true });
      // the bound keeps most of the confirmed digits: at least 11 (12 for Gamma, 11 for erf)
      expect(Math.min(ar.digits, at.digits)).toBeGreaterThanOrEqual(11);
      expect(markFor(item, "polar", ctx)?.mark).toBe("⚠");
    });
  }
});
