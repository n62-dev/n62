// SPDX-License-Identifier: GPL-3.0-or-later
// R278f1: ☰ → Paste in Solve and Function wherever the shell shows the entry line, and in no view without it.
import { describe, expect, it, vi } from "vitest";
vi.mock("../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./function/app.svelte.ts";
import { SolveApp } from "./solve/app.svelte.ts";
import type { AppHost, ViewId } from "./types.ts";

const host = (paste: () => void = () => undefined): AppHost =>
  ({
    settings: { digits: 12, angle: "rad", format: "std", decimalMark: "point" },
    calc: { ready: async () => undefined },
    kv: { get: async () => undefined, set: async () => undefined },
    userNames: [],
    setEntry: () => undefined,
    copy: () => undefined,
    notice: () => undefined,
    paste,
  }) as unknown as AppHost;

const ids = (app: FunctionApp | SolveApp, view: ViewId): string[] => app.menu(view).map((m) => m.id);

describe("☰ → Paste in the apps (R278f1)", () => {
  it("Function: Symb and Num have it, as the last row; Plot (no entry line) has none", () => {
    const app = new FunctionApp(host());
    expect(ids(app, "symb")).toEqual(["clear", "paste"]);
    expect(ids(app, "num").at(-1)).toBe("paste");
    expect(ids(app, "plot")).not.toContain("paste");
    expect(app.entryLabel("plot")).toBeUndefined();
  });
  it("Solve: Symb has it; Num has it once an unknown is selected, and not while the view has no line", () => {
    const app = new SolveApp(host());
    expect(ids(app, "symb")).toEqual(["clear", "paste"]);
    expect(app.entryLabel("num")).toBeUndefined(); // no unknown: no line
    expect(ids(app, "num")).not.toContain("paste");
    app.selected = "x";
    expect(ids(app, "num").at(-1)).toBe("paste");
  });
  it("the item takes the host's paste path", () => {
    let n = 0;
    const app = new FunctionApp(host(() => n++));
    app.menu("num").find((m) => m.id === "paste")?.run?.();
    expect(n).toBe(1);
  });
});
