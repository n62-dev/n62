// SPDX-License-Identifier: GPL-3.0-or-later
// G331 (F214, patch 0047; docs/archive/r20-decompose.md): simplify of a power of an ln over nested roots met an ln argument
// that alg_lvar's variables cannot write (subst.cc tsimplify_common, e2r gives undef), and decompose recursed until the stack
// overflowed (F214's input) or expanded_ln looped until a clock stopped it (the other two; the CAS view waited up to 600 s).
// Each input runs on a fresh raw engine with Giac's clock at 10 s (ckevery, as host.ts sets it): it must answer well inside
// the clock, so a clock stop (which gives the input back, the same value) fails, and the answer's value must be the oracle's.
// Values: mpmath (r20; sqrt(log(1+sqrt(1+cbrt(2)))), power(asinh(cbrt(2)),pi)). F214's value, 2.506E-24702789107 (mpmath),
// is past MPFR's exponent range, so its case asks only for an answer.
import { describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { defaultCasSettings } from "./types.ts";

const F214 = "simplify((asinh(surd(1/2,3)))^((pi/2+1/1000)^(90001/1000/(pi/2+1/1000000))))";
const CASES: [string, string | null][] = [
  ["simplify(sqrt(ln(1+sqrt(1+2^(1/3)))))", "957920253118554998403493714904/10^30"],
  ["simplify(asinh(2^(1/3))^pi)", "117886883625147806170303369803/10^29"],
  [F214, null],
];

describe.skipIf(!giacAvailable())("G331: simplify of a power of an ln over nested roots answers (patch 0047)", () => {
  for (const [input, value] of CASES) {
    it(input, async () => {
      const { giac } = await loadNodeGiac(); // a fresh engine: a stack overflow leaves the module unusable
      giac.eval("timeout 10");
      giac.eval("ckevery 10");
      giac.eval("Digits:=40");
      const t0 = performance.now();
      let out = "";
      expect(() => (out = giac.eval(input)), input).not.toThrow();
      const ms = performance.now() - t0;
      expect(ms, `${input} took ${Math.round(ms)} ms: stopped by Giac's clock (10 s), not answered`).toBeLessThan(8000);
      expect(out.length).toBeGreaterThan(0);
      if (value !== null) expect(giac.eval(`when(abs(evalf((${out})-${value}))<10^-29,1,0)`), `${input} = ${out}`).toBe("1");
    }, 60_000);
  }
});

// The CAS view as typed at 30 digits, through the engine host; it shows the 12 digits its check confirms (simplify is
// not audited, docs/04 2.4 rule 3; evalf(…,30) the same), the oracle's rounded (the raw cases above check 29 digits).
// Its clock is 600 s in the app (defaultCasSettings), where a build without patch 0047 waited it out; here 20 s, so such
// a build fails in 20 s (G331 fix round 1: golden's CAS form took 600 s a case on phase-1, past red-first's 900 s, so
// these two live here and golden has their Home form).
const CAS: [string, string][] = [
  ["evalf(simplify(sqrt(ln(1+sqrt(1+2^(1/3))))))", "0.957920253119"],
  ["evalf(simplify(asinh(2^(1/3))^pi))", "1.17886883625"],
];

describe.skipIf(!giacAvailable())("G331: the CAS view answers simplify of a power of an ln over nested roots (patch 0047)", () => {
  for (const [input, value] of CAS) {
    it(input, async () => {
      const L = await loadNodeGiac();
      const host = new EngineHost(L.giac, L.bridge); // as the golden gate builds it (scripts/golden/lib.ts freshHost)
      const r = host.cas(input, { ...defaultCasSettings, digits: 30, hardTimeoutS: 20 }).result;
      expect(r.ok, `${input}: ${r.text} (${r.error ?? ""})`).toBe(true);
      expect(r.text).toBe(value);
    }, 60_000);
  }
});
