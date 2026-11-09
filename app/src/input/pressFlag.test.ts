// SPDX-License-Identifier: GPL-3.0-or-later
// R161, R164 (F191): the press look is the app's own `data-down` flag (test/pressflag.spec.ts, test/pressflag-views.spec.ts);
// Chrome's touch `:active` follows Android's tap detector, late and sticky, so no rule of the app may use it.
import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPressFlag, PRESS_MS } from "./pressFlag.ts";

const root = new URL("../", import.meta.url);

/** Every source file under app/src that can hold a style rule (not the tests, which name the rule they forbid). */
function sources(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const u = new URL(e.name + (e.isDirectory() ? "/" : ""), dir);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : sources(u);
    return /\.(svelte|css|html|ts)$/.test(e.name) && !/\.(test|spec)\.ts$/.test(e.name) ? [u] : [];
  });
}

describe("the app's press look", () => {
  it("has no :active rule anywhere in app/src", () => {
    const files = sources(root);
    expect(files.length).toBeGreaterThan(50);
    const found = files.flatMap((u) =>
      readFileSync(u, "utf8")
        .split("\n")
        .filter((l) => /[\w)\]"'*-]:active\b/.test(l))
        .map((l) => `${u.pathname}: ${l.trim()}`),
    );
    expect(found).toEqual([]);
  });
  it("draws the keypad's, the status line's, the sheets' and the update note's press from [data-down]", () => {
    for (const f of ["keyboard/Keypad.svelte", "views/StatusLine.svelte", "views/Sheet.svelte", "views/UpdateNote.svelte"]) {
      const src = readFileSync(new URL(f, root), "utf8");
      expect(src.slice(src.indexOf("<style>")), f).toContain("[data-down]");
    }
  });
});

describe("createPressFlag", () => {
  const el = (): HTMLElement => ({ dataset: {} }) as HTMLElement;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("lights at the down, goes out at the later of the lift and 80 ms", () => {
    const f = createPressFlag();
    const a = el();
    f.light(a);
    expect(a.dataset["down"]).toBe("");
    vi.advanceTimersByTime(20);
    f.unlight(a);
    vi.advanceTimersByTime(PRESS_MS - 21);
    expect(a.dataset["down"]).toBe("");
    vi.advanceTimersByTime(2);
    expect(a.dataset["down"]).toBeUndefined();
  });
  it("a hold past 80 ms goes out at the lift", () => {
    const f = createPressFlag();
    const a = el();
    f.light(a);
    vi.advanceTimersByTime(300);
    expect(a.dataset["down"]).toBe("");
    f.unlight(a);
    expect(a.dataset["down"]).toBeUndefined();
  });
  it("a new down on an element still lit counts its 80 ms anew; the callback hears the clock's off only", () => {
    const off = vi.fn();
    const f = createPressFlag(off);
    const a = el();
    f.light(a);
    vi.advanceTimersByTime(10);
    f.unlight(a);
    vi.advanceTimersByTime(30);
    f.light(a);
    f.unlight(a);
    vi.advanceTimersByTime(60);
    expect(a.dataset["down"]).toBe("");
    vi.advanceTimersByTime(30);
    expect(a.dataset["down"]).toBeUndefined();
    expect(off).toHaveBeenCalledTimes(1);
    f.light(a);
    f.clearAll();
    expect(a.dataset["down"]).toBeUndefined();
    expect(off).toHaveBeenCalledTimes(1);
  });
  it("clearAll puts every flag out at once and cancels the timers", () => {
    const f = createPressFlag();
    const [a, b] = [el(), el()];
    f.light(a);
    f.light(b);
    f.unlight(a);
    f.clearAll();
    expect(a.dataset["down"]).toBeUndefined();
    expect(b.dataset["down"]).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
