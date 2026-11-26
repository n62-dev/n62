// SPDX-License-Identifier: GPL-3.0-or-later
// R871 (audit, fix round 1): a Fmt press that loads the forms code itself (right after a reload, before main.ts's idle load)
// waits for the stored switch's read, so with Say the format on that very press says its notation. The store here answers
// its read only when the test lets it, as IndexedDB may answer after the module's code is in.
import { describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import { decimalFromRational } from "../engine/rational.ts";
import type { Kv } from "./storage.ts";

const slow = vi.hoisted(() => {
  let answer: (v: unknown) => void = () => {};
  const read = new Promise<unknown>((done) => (answer = done));
  const kv: Kv = { get: <T>() => read as Promise<T | undefined>, set: () => Promise.resolve() };
  return { kv, answer: (v: unknown) => answer(v) };
});
vi.mock("./fmtSay.svelte.ts", async (orig) => {
  const m = await orig<typeof import("./fmtSay.svelte.ts")>();
  return { ...m, fmtSay: new m.FmtSayStore(slow.kv) };
});

const { cycleFormat } = await import("./cycleForms.ts");
const { Session } = await import("./session.svelte.ts");
const { fakeKv } = await import("./fakeKv.ts");

describe("R871: the first Fmt press reads the stored switch", () => {
  it("the switch stored on, its read late: the press waits for it and says Sci", async () => {
    const s = new Session(new FakeCalc(), fakeKv());
    s.settings.fmtCycle = ["std", "sci", "eng"];
    const third = decimalFromRational(1n, 3n);
    const item = {
      id: 1,
      view: "home",
      latex: "1/3",
      status: "done",
      resultLatex: "1/3",
      text: "1/3",
      approximate: true,
      value: { re: third, im: decimalFromRational(0n, 1n) },
      rational: { n: "1", d: "3" },
      facts: { exact: true, reliableDigits: null },
      startedAt: 0,
    } as Parameters<typeof cycleFormat>[2];
    const press = cycleFormat(s, s.calc, item);
    await Promise.resolve();
    slow.answer(true);
    expect(await press).toBe("Sci · this result");
  });
});
