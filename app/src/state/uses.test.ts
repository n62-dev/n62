// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { fakeKv } from "./fakeKv.ts";
import { USES_KEY, UseCounter } from "./uses.svelte.ts";

const day = (iso: string) => () => new Date(`${iso}T12:00:00Z`);

describe("the results mode's counter (R53, P16's removal test)", () => {
  it("counts names from the day of the first count, sums folds and folded actions, and stores them under `uses`", async () => {
    const kv = fakeKv();
    const c = new UseCounter(kv, day("2026-11-08"));
    await c.ready;
    for (const n of ["fold.handle", "fold.handle", "fold.swipe", "pick", "insert", "copy", "delete"]) c.count(n);
    expect([c.folds, c.actions, c.get("pick"), c.get("store")]).toEqual([3, 3, 1, 0]);
    await c.flush();
    expect(kv.data.get(USES_KEY)).toEqual({ counts: { "fold.handle": 2, "fold.swipe": 1, pick: 1, insert: 1, copy: 1, delete: 1 }, since: "2026-11-08" });
  });
  it("adds counts made before the stored ones arrived, and ignores what is not a count", async () => {
    const kv = fakeKv([[USES_KEY, { counts: { "fold.swipe": 4, pick: -1, copy: "x" }, since: "2026-11-01" }]]);
    const c = new UseCounter(kv, day("2026-11-08"));
    c.count("fold.swipe");
    await c.ready;
    expect(c.state).toEqual({ counts: { "fold.swipe": 5 }, since: "2026-11-01" });
  });
  it("reset starts again from zero today, also before the stored counts arrived", async () => {
    const kv = fakeKv([[USES_KEY, { counts: { pick: 3 }, since: "2026-11-01" }]]);
    const c = new UseCounter(kv, day("2026-11-09"));
    c.reset();
    await c.ready;
    await c.flush();
    expect(kv.data.get(USES_KEY)).toEqual({ counts: {}, since: "2026-11-09" });
  });
});
