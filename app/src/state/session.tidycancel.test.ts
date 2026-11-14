// SPDX-License-Identifier: GPL-3.0-or-later
// G211 fix 3: a Cancel pressed while the tidy chunk loads (after the engine answered) stands: the row stays cancelled,
// and a definition in the input is not noted for an engine that was restarted underneath.
import { describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { CasOutcome, HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
import { Session } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

/** The tidy load is held open until the test lets it go. */
const gate = vi.hoisted(() => {
  let open: () => void = () => {};
  let wait = Promise.resolve();
  return {
    hold: (): void => void (wait = new Promise<void>((r) => (open = r))),
    open: (): void => open(),
    wait: (): Promise<void> => wait,
  };
});
vi.mock("./tidyLoad.ts", () => {
  const m = { tidyGiacLatex: (s: string): string => s };
  return {
    onTidy: (): void => {},
    loadTidy: () => gate.wait().then(() => m),
    prefetchTidy: () => gate.wait().then(() => m),
    tidyOr: async (load: Promise<typeof m>, raw: string): Promise<string> => (await load).tidyGiacLatex(raw),
  };
});

const kv: Kv = { get: () => Promise.resolve(undefined), set: () => Promise.resolve() };

class Calc extends FakeCalc {
  override ready = (): Promise<void> => Promise.resolve();
  hang = false;
  /** Jobs the engine answered. */
  answered = 0;
  /** Once `hang` is set the names read back never answers, so a noteFunction would stay visible. */
  override names(): Promise<never[]> {
    return this.hang ? new Promise(() => {}) : Promise.resolve([]);
  }
  override home(): Promise<HomeOutcome> {
    this.answered++;
    return Promise.resolve({ ok: true, display: "x/2", latex: "\\frac{x}{2}", approximate: false, ...safePrecision("x/2") });
  }
  override cas(giac: string): Promise<CasOutcome> {
    this.answered++;
    return Promise.resolve({ ok: true, text: giac, latex: "\\frac{x}{2}", facts: { exact: false, reliableDigits: null } });
  }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("a Cancel while the tidy chunk loads", () => {
  for (const view of ["home", "cas"] as const) {
    it(`${view}: the row stays cancelled and the definition is not noted`, async () => {
      const calc = new Calc();
      const s = new Session(calc, kv);
      await tick();
      calc.hang = true;
      s.setView(view);
      gate.hold();
      const job = s.submit("f(x):=x^2");
      await vi.waitFor(() => expect(calc.answered).toBe(1)); // the item chunk is in and the engine answered
      for (let i = 0; i < 5; i++) await tick(); // the job now waits on the tidy load
      const item = (view === "home" ? s.home : s.cas).at(-1);
      expect(item?.status).toBe("pending");
      expect(await s.cancel()).toBe(true);
      gate.open();
      await job;
      expect(item?.status).toBe("cancelled");
      expect(item?.resultLatex).toBe("");
      expect(s.userNames.map((u) => u.name)).not.toContain("f");
    });
  }
});
