// SPDX-License-Identifier: GPL-3.0-or-later
// G182 (F178): a value whose literal is past MAX_EVAL_DIGITS was compared at P and P + 20 and cannot be raised further
// (G141): its why says so (`pastCap`), never "evaluated once, nothing to compare" (`once`). Real Giac; skipped without a build.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { whyLine } from "../clipboard/whyLine.ts";
import type { HistoryItem } from "../state/session.svelte.ts";

describe.skipIf(!giacAvailable())("G182: the why of a value past the cap (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = await nodeHost();
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const line = (input: string): string | null => {
    const r = home(input);
    return whyLine({ id: 1, latex: input, status: "done", resultLatex: "", text: r.display, approximate: true, startedAt: 0, facts: r.facts } as HistoryItem, { mark: "⚠", warn: r.facts.warn }, 12);
  };

  // the cases: a 10^-1000 term and G141f1's 10^-600 (derived: 10^1200 is a 1201-digit literal, past the cap of 1000)
  for (const input of ["atanh(10^-1000)", "(1-cos(10^-600))*10^1200+1"]) {
    it(`${input}: ⚠ unchecked, why pastCap and not once, the line names the cap`, () => {
      const r = home(input);
      expect(r.facts.warn).toBe("unchecked");
      expect(r.facts.why).toEqual({ pastCap: true });
      expect(line(input)).toBe("⚠ more than 1000 digits: compared at two precisions only, not raised further");
    });
  }

  it("a value evaluated once still says so (a float in a symbolic result, Home and CAS)", () => {
    expect(home("evalf(x-0.54764225985)").facts.why).toEqual({ once: true });
    expect(host.cas("evalf(x-0.54764225985)", defaultCasSettings).result.facts.why).toEqual({ once: true });
    expect(line("evalf(x-0.54764225985)")).toBe("⚠ evaluated once, nothing to compare");
  });

  // homeEval.ts:480: an input that stores runs once (whyOf(…, null)); the stored c is an unchecked float
  it("an input that runs once says so", () => {
    home("c:=evalf(1/3)");
    home("inc(x):={c:=c+1;c}");
    expect(home("inc(1)").facts.why?.once).toBe(true);
    expect(line("inc(1)")).toContain("⚠ evaluated once, nothing to compare");
  });

  it("an input that runs once keeps once beside a past-the-cap term", () => {
    // exact d: the term past the cap is the only warn, and the input still ran once
    home("d:=0");
    home("bump(x):={d:=d+1;d}");
    expect(home("bump(1)+atanh(10^-1000)").facts.why).toEqual({ once: true, pastCap: true });
  });
});
