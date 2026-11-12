// SPDX-License-Identifier: GPL-3.0-or-later
// R263: Enter while the parser chunk will not load (a first visit on a bad network, the one reload of
// state/chunkReload.ts spent): the row says our own line, never the JS error's text (G183), and the same line sent again
// works once the chunk loads.
import { expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { HomeOutcome } from "../calc/port.ts";
import { safePrecision } from "../engine/homeEval.ts";
import { t } from "../i18n/index.ts";
import { Session } from "./session.svelte.ts";
import type { Kv } from "./storage.ts";

const runs = vi.hoisted(() => ({ n: 0 }));
vi.mock("../input/entry.ts", async (actual) => {
  if (runs.n++ === 0) throw new TypeError("Failed to fetch dynamically imported module: https://example/assets/entry-abc.js");
  return await actual();
});

const kv: Kv = { get: () => Promise.resolve(undefined), set: () => Promise.resolve() };

class Calc extends FakeCalc {
  override ready = (): Promise<void> => Promise.resolve();
  sent: string[] = [];
  override names(): Promise<never[]> {
    return Promise.resolve([]);
  }
  override home(giac: string): Promise<HomeOutcome> {
    this.sent.push(giac);
    return Promise.resolve({ ok: true, display: "2", approximate: false, ...safePrecision("2") });
  }
}

it("Enter with a parser chunk that fails: our own line; the same line again works once it loads", async () => {
  const calc = new Calc();
  const s = new Session(calc, kv);
  await new Promise((r) => setTimeout(r, 0));
  await s.submit("1+1");
  const first = s.home.at(-1);
  expect(first?.status).toBe("error");
  expect(first?.text).toBe(t("error.engine"));
  expect(first?.text).not.toMatch(/Error|Failed to fetch|vitest/);
  expect(calc.sent).toEqual([]);
  await s.submit("1+1");
  const second = s.home.at(-1);
  expect(second?.status).toBe("done");
  expect(second?.text).toBe("2");
  expect(calc.sent).toHaveLength(1);
  expect(runs.n).toBe(2);
});
