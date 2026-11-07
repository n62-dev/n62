// SPDX-License-Identifier: GPL-3.0-or-later
// G188 (G94, patch 0036): Giac's integrator read past an empty vector (intg.cc integrate_id_rem, the propfrac step:
// propf.back() of an empty lvarx(den,x)) and compared that garbage inside _quorem, which trapped the wasm engine
// ("memory access out of bounds") or went on, by the heap's layout: the view sweep's engine died on
// int((cosh(x))^tanh(x),x,-1,1/2) and G94's int(sqrt(tanh(x)*sin(x)),x,0,1) at Home's 40 working digits. Which input
// traps depends on what lies before the vector, so the test runs a family of them on one engine across several Digits:
// before the patch the engine trapped on the second of them (source: derived, observed on the phase-1 build). The
// claim is only that every call answers; the integrals' values are Home's and Area's business (golden, view sweep).
import { beforeAll, describe, expect, it } from "vitest";
import { giacAvailable, loadNodeGiac, type NodeLoadedGiac } from "./nodeGiac.ts";

const INTEGRANDS = ["(cosh(x))^tanh(x)", "2^tanh(x)", "sqrt(tanh(x)*sin(x))", "2^(sinh(x)/cosh(x))"];

describe.skipIf(!giacAvailable())("G188: a definite integral of a tanh power at MPFR digits answers, the engine lives", () => {
  let L: NodeLoadedGiac;
  beforeAll(async () => {
    L = await loadNodeGiac();
  });
  it("int(f,x,0,1) for four integrands at Digits 15 … 60 on one engine", () => {
    const done: string[] = [];
    for (const d of [15, 20, 25, 30, 40, 50, 60])
      for (const f of INTEGRANDS) {
        const call = `int(${f},x,0,1)`;
        L.giac.eval(`Digits:=${d}`);
        expect(() => L.giac.eval(call), `${call} at Digits ${d}, after ${done.length} calls`).not.toThrow();
        done.push(call);
      }
    expect(L.giac.eval("1+1")).toBe("2");
  }, 120_000);
});
