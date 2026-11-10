// SPDX-License-Identifier: GPL-3.0-or-later
// G186 (F145, patch 0040): Home never answered acos, asin, acosh and asinh of a huge or tiny real (the nightly sweep's hang
// rows). Giac's prog.cc `simplifier`, which `sign` calls through `sturmsign` for a value whose double is not finite, looks
// for an exact power of an integer base by N = log2 of the base's double, and a base past the double range (the
// (10^600-1)/9 under the root of acos(10^300)'s exact form) has an infinite double: N = int(inf) saturates and its loop
// never ends, deaf to the step budget and the clock. The engine runs in a worker thread here, so on an engine without the
// patch a case is a hang (killed at the deadline), not a stuck test run. Expected values: the oracle (mpmath, source
// noted per case) or derived.
import { afterAll, describe, expect, it } from "vitest";
import { giacAvailable } from "./nodeGiac.ts";
import { Runner } from "../../../tools/probes/sweep/run.ts";
import type { Shown } from "../../../tools/probes/sweep/judge.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";

// A hang is any answer later than this: Home's own deadline is 2 s (HOME_DEADLINE_MS), the golden rows check 3 s on the
// desktop; this one is generous so a loaded machine does not turn an answer into a hang.
const DEADLINE_MS = 30_000;

interface Case {
  /** Keyboard LaTeX, through our parser as the app sends it. */
  latex: string;
  angle: "rad" | "deg";
  digits: number;
  /** The display Home must show, or the error it must refuse with. */
  display?: string;
  error?: string;
  mark?: string;
}

// One input per cause (golden rows g186-* in tests/golden/precision.yaml hold these and more, with their notes).
const CASES: Case[] = [
  // causes 1 and 2: on an engine with patch 0040 alone the clock stopped both precisions and it showed ⚠ 1.25331413732
  // (sqrt(pi/2), the imaginary part lost); oracle: mpmath sqrt(atan(acos(10^300))) = 1.25331427011170614096+0.00057694951432669341i
  { latex: "\\sqrt{\\arctan\\left(\\arccos\\left(1ᴇ300\\right)\\right)}", angle: "rad", digits: 12, display: "1.25331427011+0.000576949514327*i", mark: "≈" },
  // cause 1 in the exact evaluation; derived: about e^(10^1000)/2, log10 = 4.34294481903E999, past MPFR's range
  { latex: "\\cos\\left(\\tanh\\left(\\operatorname{acosh}\\left(1ᴇ-1000\\right)\\right)\\right)", angle: "rad", digits: 12, error: "overflow" },
  // cause 1, DEG; oracle: mpmath sin(sin(asinh(10^300)°)°)
  { latex: "\\sin\\left(\\sin\\left(\\operatorname{asinh}\\left(1ᴇ300\\right)\\right)\\right)", angle: "deg", digits: 30, display: "-0.00833627939566488186278598286004", mark: "≈" },
];

describe.skipIf(!giacAvailable())("G186: Home answers or refuses a function of a huge or tiny real in time", () => {
  const runner = new Runner(DEADLINE_MS);
  afterAll(() => runner.close());
  for (const c of CASES) {
    it(`${c.angle} ${c.digits} ${c.latex}`, async () => {
      const shown: Shown = await runner.run(latexToGiac(c.latex), c.angle, c.digits);
      expect("hang" in shown && shown.hang, "a hang: no answer within the deadline").not.toBe(true);
      if (c.error) expect(shown.error).toBe(c.error);
      if (c.display) expect(shown.display).toBe(c.display);
      if (c.mark) expect(shown.mark).toBe(c.mark);
    }, DEADLINE_MS + 30_000);
  }
});
