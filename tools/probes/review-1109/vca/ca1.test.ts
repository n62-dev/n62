// SPDX-License-Identifier: GPL-3.0-or-later
// vca, ca-1: the parser and palette doors keep a rejected import; Enter shows the error's own text.
/* eslint-disable */
import { Session } from "../../../../app/src/state/session.svelte.ts";
import { FakeCalc } from "../../../../app/src/calc/fake.ts";
import { loadParser } from "../../../../app/src/input/parser.ts";
import { loadShiftPalettes } from "../../../../app/src/keyboard/palettes.ts";
import { prefetchItems } from "../../../../app/src/state/itemLoad.ts";

declare const vi: any, it: any, expect: any;
const state = vi.hoisted(() => ({ parserFactory: 0 }));

vi.mock("../../../../app/src/input/latex-to-giac.ts", () => {
  state.parserFactory++;
  throw new TypeError("Failed to fetch dynamically imported module: https://example/assets/latex-to-giac-abc.js");
});
vi.mock("../../../../app/src/keyboard/shiftPalettes.ts", () => {
  throw new TypeError("Failed to fetch dynamically imported module: shiftPalettes");
});
vi.mock("../../../../app/src/state/resultItem.ts", () => {
  throw new TypeError("Failed to fetch dynamically imported module: resultItem");
});

const kv = { get: () => Promise.resolve(undefined), set: () => Promise.resolve() };
class Calc extends (FakeCalc as any) {
  ready = (): Promise<void> => Promise.resolve();
  names(): Promise<never[]> {
    return Promise.resolve([]);
  }
}

it("the doors", async () => {
  const a = loadParser();
  await a.catch(() => undefined);
  const b = loadParser();
  console.log("parser door: same rejected promise on the second call:", a === b);
  const p = loadShiftPalettes();
  await p.catch(() => undefined);
  console.log("palette door: same rejected promise on the second call:", p === loadShiftPalettes());
  const i = prefetchItems();
  await i.catch(() => undefined);
  console.log("item door (the retry form, control): same promise on the second call:", i === prefetchItems());
  expect(a).toBe(b);
});

it("Enter twice", async () => {
  const s: any = new (Session as any)(new (Calc as any)(), kv);
  await new Promise((r) => setTimeout(r, 0));
  await s.submit("1+1");
  const first = s.home[s.home.length - 1];
  console.log("first Enter:", first?.status, JSON.stringify(first?.text));
  await s.submit("2+2");
  const second = s.home[s.home.length - 1];
  console.log("second Enter:", second?.status, JSON.stringify(second?.text));
  console.log("factory runs:", state.parserFactory);
});
