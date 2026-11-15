// SPDX-License-Identifier: GPL-3.0-or-later
// R222: the published ten tasks (tests/tasks/benchmark.yaml; the protocol is docs/research/benchmark-protocol.md) replay
// from their own file on the real engine. Each task starts from the start state (the angle set through the session, not
// counted), presses its `keys` and reads what the protocol expects. One table is printed: task, presses, angle.
// `seconds` stay null here: a replay at machine speed says nothing about a hand.
import { expect, test, type Page } from "@playwright/test";
import { start, replayTask } from "./tasks-play.ts";
import { benchmarkPresses, loadBenchmark, validateBenchmark, type BenchTask, type Cell } from "./benchmark-lib.ts";
import { keyIds } from "./tasks-lib.ts";

const tasks = loadBenchmark();
const rows: string[] = [];
const keys = keyIds();
const task = (id: string): BenchTask => tasks.find((t) => t.id === id) as BenchTask;
/** The app's own counter of every press (R70): what docs/04 5.2 counts, as in tasks.spec.ts. */
const pressed = (page: Page): Promise<number> => page.evaluate(() => window.n62.session.taps.counts.presses);
const blank = (): Cell => ({ presses: null, seconds: null, source: null, date: null });
/** A copy of t01 with `change` applied, for the rejection tests. */
const variant = (change: (t: BenchTask) => void): BenchTask => {
  const t = structuredClone(task("t01"));
  change(t);
  return t;
};
const rejects = (t: BenchTask, text: string): boolean => validateBenchmark([t], keys, false).some((m) => m.includes(text));

test.describe("benchmark.yaml", () => {
  test("is well formed: ten tasks, real key ids, golden sources, an angle, three empty compare cells", () => {
    expect(tasks.map((t) => t.id)).toEqual(["t01", "t02", "t04", "t07", "t08", "t09", "t10", "t11", "t12", "t13"]);
    expect(validateBenchmark(tasks, keys)).toEqual([]);
    for (const t of tasks) expect(Object.keys(t.compare).sort(), t.id).toEqual(["g2", "phone_calculator", "qalculate"]);
  });

  test("the ten compare blocks are ten objects: a measurement under one task shows under no other", () => {
    const fresh = loadBenchmark();
    expect(new Set(fresh.map((t) => t.compare)).size).toBe(10);
    (fresh[0] as BenchTask).compare.g2.presses = 9;
    expect(fresh.slice(1).every((t) => t.compare.g2.presses === null)).toBe(true);
    expect(validateBenchmark(fresh.map((t, i) => (i === 1 ? { ...t, compare: (fresh[0] as BenchTask).compare } : t)), keys).some((m) => m.includes("share one compare"))).toBe(true);
  });

  test("expect.text is tied to expect.value to 12 digits; a non-number text is skipped", () => {
    expect(rejects(variant((t) => (t.expect.value = "3197.2789")), "expect.text[0]")).toBe(true);
    expect(rejects(variant((t) => (t.expect.value = ["3197.27891156"])), "to 12 digits")).toBe(false);
    expect(rejects(variant((t) => (t.expect.text = ["3197.27891156", "1"])), "elements")).toBe(true);
    expect(rejects(variant((t) => (t.expect.text = "1/2*pi")), "expect.text")).toBe(false);
    expect(rejects({ ...task("t13"), expect: { ...task("t13").expect, value: ["0.287740093100050679957091737632", "0.3091"] } }, "expect.text[1]")).toBe(true);
    expect(rejects({ ...task("t07"), expect: { ...task("t07").expect, value: "61" } }, "expect.text")).toBe(false); // 0b111100 is not read as a number
  });

  test("the angle per task: t13 in deg, t11 and t12 in rad, the others none", () => {
    expect(Object.fromEntries(tasks.map((t) => [t.id, t.angle]))).toEqual({
      t01: "none", t02: "none", t04: "none", t07: "none", t08: "none", t09: "none", t10: "none", t11: "rad", t12: "rad", t13: "deg",
    });
  });

  test("a G2 cell whose source is not device, virtual-calc or null is rejected; those three pass", () => {
    const g2 = (source: string | null, seconds: number | null = null): BenchTask =>
      variant((t) => (t.compare.g2 = { presses: 9, seconds, source, date: "2026-11-20" }));
    expect(rejects(g2("manual"), "g2 source")).toBe(true);
    expect(rejects(g2("assumed"), "g2 source")).toBe(true);
    expect(validateBenchmark([g2("device", 3.2)], keys, false)).toEqual([]);
    expect(validateBenchmark([g2("virtual-calc")], keys, false)).toEqual([]);
    expect(rejects(g2("virtual-calc", 3.2), "seconds")).toBe(true); // the Virtual Calculator's seconds are not comparable (protocol 4)
    expect(rejects(g2(null), "source")).toBe(true); // presses without a source is a guess
  });

  test("a missing or extra tool, a cell without its four fields, a bad angle, a bad source and a short list are rejected", () => {
    expect(rejects(variant((t) => delete (t.compare as Partial<BenchTask["compare"]>).qalculate), "qalculate")).toBe(true);
    expect(rejects(variant((t) => ((t.compare as unknown as Record<string, Cell>)["other"] = blank())), "compare")).toBe(true);
    expect(rejects(variant((t) => delete (t.compare.qalculate as Partial<Cell>).date), "date")).toBe(true);
    expect(rejects(variant((t) => ((t as { angle: string }).angle = "grad")), "angle")).toBe(true);
    expect(rejects(variant((t) => ((t as { source: string }).source = "memory")), "source")).toBe(true);
    expect(rejects(variant((t) => (t.keys = ["d1", "zz"])), 'no key "zz"')).toBe(true);
    expect(validateBenchmark(tasks.slice(1), keys).some((m) => m.includes("ten tasks"))).toBe(true);
  });
});

test.describe("replay", () => {
  test.beforeEach(async ({ page }) => start(page));

  // A failure names its task: the wrong text stands in for a wrong result.
  test("a failing task reports its id", async ({ page }) => {
    const bad = variant((t) => {
      t.id = "t98";
      t.expect.text = "3197.27891157";
    });
    await expect(replayTask(page, bad)).rejects.toThrow(/^t98: /);
  });

  for (const id of ["t01", "t02", "t04", "t07", "t08", "t09", "t10", "t11", "t12", "t13"]) {
    test(`${id} ${task(id)?.title ?? ""}`, async ({ page }) => {
      const t = task(id);
      await replayTask(page, t);
      const n = benchmarkPresses(t);
      expect(await pressed(page), `${t.id}: the app counted ${n} presses by docs/04 5.2`).toBe(n); // setAngle is not a press
      rows.push(`${t.id} | ${String(benchmarkPresses(t)).padStart(8)} | ${t.angle}`);
    });
  }
});

test.afterAll(() => {
  console.log(`\nPUBLISHED BENCHMARK (presses, docs/04 5.2)\ntask | presses | angle\n${[...rows].sort().join("\n")}`);
});
