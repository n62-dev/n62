// SPDX-License-Identifier: GPL-3.0-or-later
// R155f2: the history item's chunk (state/resultItem.ts) that will not load (a tab open across a redeploy: its old hashed
// file is gone) stops the job before the engine is sent anything, so a definition is never made that the session does not
// know (R91's rule for the tidy chunk, the other way round: here nothing has been computed yet).
import { describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { CasOutcome, HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
import { t } from "../i18n/index.ts";
import { Session } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

vi.mock("./resultItem.ts", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

const kv: Kv = { get: () => Promise.resolve(undefined), set: () => Promise.resolve() };

class Calc extends FakeCalc {
  override ready = (): Promise<void> => Promise.resolve();
  /** What the engine was sent. */
  sent: string[] = [];
  override names(): Promise<never[]> {
    return Promise.resolve([]);
  }
  override home(giac: string): Promise<HomeOutcome> {
    this.sent.push(giac);
    return Promise.resolve({ ok: true, display: "x/2", latex: "\\frac{1}{2}", approximate: false, ...safePrecision("x/2") });
  }
  override cas(giac: string): Promise<CasOutcome> {
    this.sent.push(giac);
    return Promise.resolve({ ok: true, text: giac, latex: "\\frac{1}{2}", facts: { exact: false, reliableDigits: null } });
  }
}

describe("an item chunk that fails to load", () => {
  it("Home: the engine is never sent the definition, the row says why, no name is noted", async () => {
    const calc = new Calc();
    const s = new Session(calc, kv);
    await new Promise((r) => setTimeout(r, 0));
    await s.submit("f(x):=x^2");
    const item = s.home[s.home.length - 1];
    expect(calc.sent).toEqual([]);
    expect(item?.status).toBe("error");
    expect(item?.text).toBe(t("error.engine"));
    expect(s.userNames.map((u) => u.name)).not.toContain("f");
  });
  it("CAS: the same", async () => {
    const calc = new Calc();
    const s = new Session(calc, kv);
    await new Promise((r) => setTimeout(r, 0));
    s.setView("cas");
    await s.submit("f(x):=x^2");
    const item = s.cas[s.cas.length - 1];
    expect(calc.sent).toEqual([]);
    expect(item?.status).toBe("error");
    expect(item?.text).toBe(t("error.engine"));
    expect(s.userNames.map((u) => u.name)).not.toContain("f");
  });
});
