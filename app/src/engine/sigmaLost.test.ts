// SPDX-License-Identifier: GPL-3.0-or-later
// G550 (F301): a Home row whose σ input cannot be carried says so (⚠, why.sigmaLost), never 12 bare digits; and σ through
// Gamma reaches the row (Giac leaves Psi of a multiprecision float unevaluated). Against the real Giac build (skipped
// when no build is found; see nodeGiac.ts). Expected σ values are oracle (mpmath diff at dps 30; W = G·5.972ᴇ24·70/6371000²
// with G = 6.67430ᴇ-11 ± 0.00015ᴇ-11, so W = 687.398139836, σ_W = 0.0154487693054): W! σ 3.80470318761ᴇ1652 (W! =
// 3.76939487348ᴇ1653), factorial(G·1ᴇ11) σ 0.778533528561 (value 2632.87776703), Gamma(W/100) σ 0.163003270489 (value
// 569.337085102), W·2 σ 0.0308975386109. uncDigits derived (constUnc.ts uncDigitsOf: the value's exponent minus σ's):
// 1653 − 1652 = 1, 3 − (−1) = 4, 2 − (−1) = 3.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts, type HomeResult } from "./homeEval.ts";
import { decimalFromString, markOf, roundSignificant } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { homeItem } from "../state/resultItem.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { whyLine } from "../clipboard/whyLine.ts";

describe.skipIf(!giacAvailable())("a σ that cannot be carried is ⚠, never dropped (G550)", () => {
  let host: EngineHost;
  const G = { value: "6.67430E-11", unc: "0.00015E-11" };
  const ROW = "pasc_G*5.972E24*70/6371000^2";
  beforeAll(async () => {
    const L = await loadNodeGiac();
    host = new EngineHost(L.giac, L.bridge);
    host.home(`W:=${ROW}`, defaultHomeSettings, { G });
  });
  const home = (i: string, consts?: Parameters<EngineHost["home"]>[2]): HomeResult => host.home(i, defaultHomeSettings, consts).result;
  /** σ rounded to `n` digits as `<digits>e<exponent of the first digit>` (a decimal, never a JS number: W!'s is past 1E308). */
  const sig = (r: HomeResult, n: number): string | undefined => {
    const d = r.facts.uncSigma === undefined ? null : decimalFromString(r.facts.uncSigma);
    const x = d && roundSignificant(d, n);
    return x ? `${x.digits}e${x.exp}` : undefined;
  };
  const markInfo = (r: HomeResult) => markOf(precisionFacts(r), { format: "STD", digits: 12 });
  const line = (input: string, r: HomeResult): string | null => {
    const item = { id: 1, latex: input, status: "done", resultLatex: "", text: r.display, startedAt: 0, ...homeItem(r, false) } as HistoryItem;
    return whyLine(item, markInfo(r), 12);
  };

  it("W! carries σ through Gamma's derivative (Psi): 3.80ᴇ1652, one digit before it", () => {
    const r = home("W!");
    expect(r.display).toBe("3.76939487348E1653");
    expect(sig(r, 3)).toBe("380e1652");
    expect(r.facts.uncDigits).toBe(1);
    expect(markInfo(r)?.mark).toBe("≈");
  });

  it("factorial(G·1ᴇ11) carries σ 0.7785; Gamma(W/100) σ 0.163", () => {
    const f = home("factorial(pasc_G*1E11)", { G });
    expect(f.display).toBe("2632.87776703");
    expect(sig(f, 4)).toBe("7785e-1");
    expect(f.facts.uncDigits).toBe(4);
    const g = home("Gamma(W/100)");
    expect(g.display).toBe("569.337085102");
    expect(sig(g, 3)).toBe("163e-1");
    expect(g.facts.uncDigits).toBe(3);
  });

  it("max(W,1), min(W,1000): no derivative, so ⚠ and the why line says σ of W was not carried", () => {
    for (const input of ["max(W,1)", "min(W,1000)"]) {
      const r = home(input);
      expect(r.facts.uncSigma).toBeUndefined();
      expect(r.facts.why?.sigmaLost).toEqual(["W"]);
      expect(markInfo(r)?.mark).toBe("⚠");
      expect(line(input, r)).toBe("⚠ σ of W not carried through this input");
    }
  });

  it("a constant's σ lost through max: ⚠, the constant named", () => {
    const r = home("max(pasc_G*1E11,1)", { G });
    expect(r.facts.why?.sigmaLost).toEqual(["pasc_G"]);
    expect(markInfo(r)?.mark).toBe("⚠");
  });

  it("f(2) after f(t):=W·t reads W only through the call: ⚠ sigmaLost", () => {
    home("f(t):=W*t");
    const r = home("f(2)");
    expect(r.display).toBe("1374.79627967");
    expect(r.facts.why?.sigmaLost).toEqual(["W"]);
    expect(markInfo(r)?.mark).toBe("⚠");
    expect(line("f(2)", r)).toBe("⚠ σ of W not carried through this input");
  });

  it("W·[1,2] and sqrt(W−700) are not one real number: ⚠ sigmaLost", () => {
    for (const input of ["W*[1,2]", "sqrt(W-700)"]) {
      const r = home(input);
      expect(r.ok).toBe(true);
      expect(r.facts.why?.sigmaLost).toEqual(["W"]);
      expect(markInfo(r)?.mark).toBe("⚠");
    }
  });

  it("a name stored from a row whose σ is lost is ⚠ when read (M:=max(W,1), then M·2 uses M)", () => {
    const m = home("M:=max(W,1)");
    expect(m.facts.why?.sigmaLost).toEqual(["W"]);
    const r = home("M*2");
    expect(markInfo(r)?.mark).toBe("⚠");
    expect(line("M*2", r)).toBe("⚠ uses M, itself uncertain");
  });

  it("controls: W·2 σ 0.0309 ≈; W−W, floor(W) no ⚠; A·2 from A:=5 nothing", () => {
    const r = home("W*2");
    expect(sig(r, 3)).toBe("309e-2");
    expect(markInfo(r)?.mark).toBe("≈");
    for (const input of ["W-W", "floor(W)"]) {
      const c = home(input);
      expect(c.facts.why?.sigmaLost).toBeUndefined();
      expect(markInfo(c)?.mark).not.toBe("⚠");
    }
    home("A:=5");
    const a = home("A*2");
    expect(a.facts.why).toBeUndefined();
    expect(markInfo(a)?.mark).toBe("=");
  });
});
