// SPDX-License-Identifier: GPL-3.0-or-later
// R222: loading tests/tasks/benchmark.yaml (the published ten; protocol: docs/research/benchmark-protocol.md) and its checks.
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { countPresses, validate, type Step, type Task } from "./tasks-lib.ts";

export type BenchAngle = "rad" | "deg" | "none";

/** One hand measurement of one tool: all four fields null until the owner has measured it. */
export interface Cell {
  presses: number | null;
  seconds: number | null;
  /** g2: `device` (the owner's G2) or `virtual-calc`; the other tools: the tool and its version. */
  source: string | null;
  date: string | null;
}

export interface BenchTask {
  id: string;
  title: string;
  angle: BenchAngle;
  /** The golden sources (`oracle`, `derived`, …) of the expected value. */
  source: string;
  /** N62's shortest sequence found (a short search, not a proof), replayed from the start state. */
  keys: Step[];
  /** Where the result is read: Home's last row (default), the last `n` Home rows, or Solve's Num table (`names`); a task in
   *  the unit view is read from the unit view. */
  read?: "rows" | "solve";
  names?: string[];
  expect: { value: string | string[]; text: string | string[]; unit?: string; shown?: string };
  compare: { g2: Cell; qalculate: Cell; phone_calculator: Cell };
}

export function loadBenchmark(): BenchTask[] {
  const text = readFileSync(new URL("../../tests/tasks/benchmark.yaml", import.meta.url), "utf8");
  return (parse(text) as { schema: number; tasks: BenchTask[] }).tasks;
}

export const benchmarkPresses = (t: BenchTask): number => countPresses(t.keys);

const TOOLS = ["g2", "qalculate", "phone_calculator"] as const;
const FIELDS = ["presses", "seconds", "source", "date"] as const;
const G2_SOURCES = ["device", "virtual-calc", null];

/** Problems with a compare cell (empty = fine). Null is "not measured"; a measured cell has its date and source. */
function cellProblems(tool: string, c: Cell | undefined): string[] {
  const bad: string[] = [];
  if (c === undefined || c === null || typeof c !== "object") return [`compare.${tool} is missing`];
  for (const f of FIELDS) if (!(f in c)) bad.push(`compare.${tool} has no ${f}`);
  for (const k of Object.keys(c)) if (!(FIELDS as readonly string[]).includes(k)) bad.push(`compare.${tool} has a stray field ${k}`);
  if (c.presses !== null && !(Number.isInteger(c.presses) && c.presses > 0)) bad.push(`compare.${tool} presses is not a whole number`);
  if (c.seconds !== null && !(typeof c.seconds === "number" && c.seconds > 0)) bad.push(`compare.${tool} seconds is not a positive number`);
  const measured = c.presses !== null || c.seconds !== null;
  if (measured && (c.date === null || !/^\d{4}-\d\d-\d\d$/.test(String(c.date)))) bad.push(`compare.${tool} is measured without a date (YYYY-MM-DD)`);
  if (measured && c.source === null) bad.push(`compare.${tool} is measured without a source`);
  if (tool === "g2") {
    if (!G2_SOURCES.includes(c.source)) bad.push(`compare.g2 source is ${String(c.source)}: only device, virtual-calc or null`);
    if (c.source === "virtual-calc" && c.seconds !== null) bad.push("compare.g2 seconds with virtual-calc: a mouse is not comparable (protocol 4)");
  }
  return bad;
}

/** Problems with the benchmark file (empty = fine). Needs no browser. `ten` false skips the count (a test of one task). */
export function validateBenchmark(tasks: readonly BenchTask[], keys: ReadonlySet<string>, ten = true): string[] {
  const bad: string[] = [];
  if (ten && tasks.length !== 10) bad.push(`the file has ${tasks.length} tasks, not ten tasks`);
  // the id, source, key-id and expect checks of tasks.yaml's validate(), through an active task of the same keys
  const asTask = (t: BenchTask): Task => ({
    id: t.id,
    title: t.title,
    milestone: 0,
    status: "active",
    budget: countPresses(t.keys ?? []),
    keys: t.keys ?? null,
    expect: { value: t.expect?.value, text: String(t.expect?.text) },
    source: t.source,
    baseline: null,
    compare: { g2_virtual_calc: null, phone_calculator: null },
  });
  bad.push(...validate(tasks.map(asTask), keys));
  for (const t of tasks) {
    const at = (m: string): number => bad.push(`${t.id}: ${m}`);
    if (!["rad", "deg", "none"].includes(t.angle)) at(`angle is ${String(t.angle)}`);
    if (!Array.isArray(t.keys) || t.keys.length === 0) at("no keys");
    if (!t.compare || typeof t.compare !== "object") {
      at("no compare column");
      continue;
    }
    for (const k of Object.keys(t.compare)) if (!(TOOLS as readonly string[]).includes(k)) at(`compare has the tool ${k}: only g2, qalculate, phone_calculator`);
    for (const tool of TOOLS) for (const m of cellProblems(tool, t.compare[tool])) at(m);
  }
  return bad;
}
