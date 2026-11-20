// SPDX-License-Identifier: GPL-3.0-or-later
// R785: Mode is the next free row of every app view's ☰ and opens the host's Mode sheet.
import { describe, expect, it, vi } from "vitest";
vi.mock("../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./function/app.svelte.ts";
import { SolveApp } from "./solve/app.svelte.ts";
import type { AppHost, ViewId } from "./types.ts";

const host = (mode: () => void): AppHost =>
  ({
    settings: { digits: 12, angle: "rad", format: "std", decimalMark: "point" },
    calc: { ready: async () => undefined },
    kv: { get: async () => undefined, set: async () => undefined },
    userNames: [],
    setEntry: () => undefined,
    copy: () => undefined,
    notice: () => undefined,
    paste: () => undefined,
    mode,
  }) as unknown as AppHost;

describe("☰ › Mode in the apps (R785)", () => {
  it("every view of Function and Solve ends its own rows with Mode, and the row runs the host's Mode", () => {
    let n = 0;
    const apps: [FunctionApp | SolveApp, ViewId[]][] = [
      [new FunctionApp(host(() => n++)), ["symb", "plot", "num"]],
      [new SolveApp(host(() => n++)), ["symb", "num"]],
    ];
    for (const [app, views] of apps)
      for (const v of views) {
        const row = app.menu(v).at(-1);
        expect(row?.id).toBe("mode");
        row?.run?.();
      }
    expect(n).toBe(5);
  });
});
