// SPDX-License-Identifier: GPL-3.0-or-later
// G789 (patch 0060): the median and the quartiles of a list that is not fully numeric. Giac sorted such a list by form
// (misc.cc islesscomplexthanf_sort), so undef and a free name took a place in the order and -inf came last:
// quartile1([1,2,3,undef,5]) was 2, quartile1([5,-inf,3,1]) was 1. Now an element with no real value is refused with
// G786f1's text, and ±inf is sorted by value. The keys' median is ours (pasmedian, G42), so the user meets Giac's sort
// through quartile1, quartile3, quartiles and quantile. Home and CAS through the worker's request protocol, on the real
// engine in this thread, as libraryValues.engine.test.ts runs it. undef has no key (the parser refuses the word), so that
// input is Giac's text; the others are typed as the keys type them.
// Expected values: the refusal is derived (no order on a value that is not real; owner, 2026-11-23); -infinity is Giac's
// answer for the list with -10^9 for -inf (quartile1([5,-10^9,3,1]) = -1000000000.0 on phase-1), mapped back.
import { describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import { createRequestHandler } from "./host.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import type { Request, Response } from "./protocol.ts";
import { WorkerEngine, type WorkerLike } from "./workerEngine.ts";
import { giacOfEntry } from "../input/entry.ts";

class InProcessWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  terminated = false;
  private handle = createRequestHandler(
    () => loadNodeGiac(),
    (r) => setTimeout(() => !this.terminated && this.onmessage?.({ data: r }), 0),
  );
  postMessage(msg: Request): void {
    setTimeout(() => void this.handle(msg), 0);
  }
  terminate(): void {
    this.terminated = true;
  }
}

const settings = { digits: 12, angle: "rad", format: "std" } as const;
const REFUSED = "quartile1: the data must be real numbers";
const NEG_INF = "\\operatorname{quartile1}\\left(\\left\\{5,-\\infty,3,1\\right\\}\\right)";
const WITH_NAME = "\\operatorname{quartile1}\\left(\\left\\{3,x,1,2\\right\\}\\right)";

describe.skipIf(!giacAvailable())("G789: quartile1 of a list with undef, a name or -inf (real Giac, through the worker)", () => {
  const calc = new EngineCalc(new WorkerEngine({ createWorker: () => new InProcessWorker() }));

  it("Home refuses undef and a free name, and takes -inf as the least value", { timeout: 30_000 }, async () => {
    const undef = await calc.home("quartile1([1,2,3,undef,5])", settings);
    expect(undef.ok).toBe(false);
    expect(undef.display).toContain(REFUSED);
    const name = await calc.home(giacOfEntry(WITH_NAME, "home").giac, settings);
    expect(name.ok).toBe(false);
    expect(name.display).toContain(REFUSED);
    const inf = await calc.home(giacOfEntry(NEG_INF, "home").giac, settings);
    expect(inf.ok).toBe(true);
    expect(inf.display).toBe("-infinity");
  });

  it("CAS refuses undef and a free name, and takes -inf as the least value", { timeout: 30_000 }, async () => {
    const undef = await calc.cas("quartile1([1,2,3,undef,5])", settings);
    expect(undef.ok).toBe(false);
    expect(undef.text).toContain(REFUSED);
    const name = await calc.cas(giacOfEntry(WITH_NAME, "cas").giac, settings);
    expect(name.ok).toBe(false);
    expect(name.text).toContain(REFUSED);
    const inf = await calc.cas(giacOfEntry(NEG_INF, "cas").giac, settings);
    expect(inf.ok).toBe(true);
    expect(inf.text).toBe("-infinity");
  });
});
