// SPDX-License-Identifier: GPL-3.0-or-later
// R601 (F414): a Num cell and the trace y read the names they use as they were when asked. Home storing a new value
// (a new `time` in the host's userNames) asks them again; nothing stored asks nothing. The fake engine answers a·x for
// the current a (the traceStale.test.ts harness).
import { describe, expect, it, vi } from "vitest";
import type { UserName } from "../../engine/defs.ts";
import type { AppHost } from "../types.ts";
// the app imports the page brightness, which reads the document
vi.mock("../../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./app.svelte.ts";

const make = (): { app: FunctionApp; store: (v: number, time: number) => void; asked: string[] } => {
  const settings = { digits: 12, angle: "rad", format: "std", decimalMark: "point", groupSep: "thin" };
  const asked: string[] = [];
  let a = 3;
  const host = { userNames: [] as UserName[] };
  const store = (v: number, time: number): void => {
    a = v;
    host.userNames = [{ name: "a", kind: "var", preview: String(v), view: "home", time }];
  };
  store(3, 1000);
  const calc = {
    ready: async () => undefined,
    table: async (r: { fns: string[]; xs: string[] }) => {
      asked.push(r.xs.join(","));
      return r.xs.map((x) => r.fns.map(() => ({ ok: true, display: String(a * Number(x)), facts: { exact: true } })));
    },
  };
  const h = {
    calc,
    kv: { get: async () => undefined, set: async () => undefined },
    get settings() {
      return settings;
    },
    get userNames() {
      return host.userNames;
    },
    setEntry: () => undefined,
    copy: () => undefined,
    notice: () => undefined,
  };
  const app = new FunctionApp(h as unknown as AppHost);
  app.num.step = "1";
  return { app, store, asked };
};
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 20));
const row1 = (app: FunctionApp): string | undefined => app.numCell(app.numXs.indexOf("1"), 0)?.display;

describe("R601: Num cells and the trace y follow a name stored in Home", () => {
  it("Num: a·x at x = 1 is 3, Home stores a = 5, back to Num: the cell is 5, asked again", async () => {
    const { app, store, asked } = make();
    app.define(0, "ax");
    app.show("num");
    await tick();
    expect(row1(app)).toBe("3");
    const n = asked.length;
    store(5, 2000);
    app.show("symb");
    app.show("num");
    await tick();
    expect(asked.length).toBe(n + 1);
    expect(row1(app)).toBe("5");
  });

  it("Plot: the trace y at x = 1 is 3, Home stores a = 5, back to Plot: the y is 5", async () => {
    const { app, store, asked } = make();
    app.define(0, "ax");
    app.trace.x = "1";
    app.show("plot");
    await tick();
    expect(app.traceY?.display).toBe("3");
    store(5, 2000);
    expect(app.traceY).toBeUndefined(); // the old y is not shown meanwhile
    app.show("symb");
    app.show("plot");
    await tick();
    expect(asked).toHaveLength(2);
    expect(app.traceY?.display).toBe("5");
  });

  it("control: nothing stored, Num and Plot again ask nothing new", async () => {
    const { app, asked } = make();
    app.define(0, "ax");
    app.trace.x = "1";
    app.show("num");
    await tick();
    app.show("symb");
    app.show("num");
    await tick();
    expect(asked).toHaveLength(1);
    app.show("plot");
    await tick();
    app.show("symb");
    app.show("plot");
    await tick();
    expect(asked).toHaveLength(2);
  });
});
