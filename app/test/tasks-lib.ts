// SPDX-License-Identifier: GPL-3.0-or-later
// EN0 task benchmark: loading tests/tasks/tasks.yaml, the press-counting rule of docs/04 section 5.2, the checks.
import { readFileSync } from "node:fs";
import { parse } from "yaml";

/** One step of a sequence: a key id, or a screen tap, a held key, a drag gesture, or a flick up or down on a key
 *  (R9: `{up: dot}` is `=`, `{down: vars}` is A). Each counts 1. */
export type Step = string | { tap: string } | { hold: string } | { drag: string } | { up: string } | { down: string };

export interface Baseline {
  note?: string;
  keys: Step[];
  /** What it reads: a string, or a list when expect.value is one (element for element, last Home rows or Solve's table). */
  text: string | string[];
  /** Where a list is read: Home's last rows (default) or Solve's Num table (R221). */
  read?: "solve";
  /** read: solve, the unknowns whose values make `text`, in this order. */
  names?: string[];
}

export interface Task {
  id: string;
  title: string;
  milestone: number;
  status: "active" | "pending";
  needs?: string;
  budget: number | null;
  keys: Step[] | null;
  expect: { value: string | string[]; text?: string; [other: string]: unknown };
  source: string;
  baseline: Baseline | null;
  compare: { g2_virtual_calc: number | null; phone_calculator: number | null };
}

const file = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8");

export function loadTasks(): Task[] {
  const doc = parse(file("../../tests/tasks/tasks.yaml")) as { schema: number; tasks: Task[] };
  return doc.tasks;
}

/** Every key id of spec/keyboard.yaml (the ids a `keys:` list may use). */
export function keyIds(): Set<string> {
  const doc = parse(file("../../spec/keyboard.yaml")) as { keys: { id: string }[] };
  return new Set(doc.keys.map((k) => k.id));
}

/**
 * Presses of a sequence by §5.2: every press counts 1, Shift and Alpha included, Enter included; a held key that
 * auto-repeats, a trackpad drag, a flick and a tap on the screen count 1 each. Nothing is free.
 */
export const countPresses = (steps: readonly Step[]): number => steps.length;

export const withinBudget = (steps: readonly Step[], budget: number): boolean => countPresses(steps) <= budget;

/** The status line's controls a step may name (helpers.ts `tap`); each is one tap on the screen. */
const CONTROLS = ["@place", "@symb", "@plot", "@num", "@menu", "@home", "@cas"];

/** The step's key id, or null when it is not a key press. */
export const keyOf = (s: Step): string | null =>
  typeof s === "string" ? (s.startsWith("@") ? null : s) : "hold" in s ? s.hold : "up" in s ? s.up : "down" in s ? s.down : null;

/** Problems with the task list itself (empty = fine). Needs no browser. */
export function validate(tasks: readonly Task[], keys: ReadonlySet<string>): string[] {
  const bad: string[] = [];
  const seen = new Set<string>();
  const sources = ["oracle", "derived", "device", "virtual-calc", "assumed"];
  for (const t of tasks) {
    const at = (m: string): number => bad.push(`${t.id}: ${m}`);
    if (!/^t\d\d$/.test(t.id) || seen.has(t.id)) at("id missing, malformed or repeated");
    seen.add(t.id);
    if (t.status !== "active" && t.status !== "pending") at(`status is ${String(t.status)}`);
    if (!sources.includes(t.source)) at(`source is ${String(t.source)}`);
    if (t.expect?.value === undefined) at("no expect.value");
    if (t.compare === undefined) at("no compare column");
    if (t.status === "pending" && !t.needs) at("pending without `needs`");
    if (t.status === "active" && (t.budget === null || t.keys === null)) at("active needs a budget and keys");
    if (t.status === "active" && t.expect?.text === undefined) at("active needs expect.text");
    if (t.keys !== null && t.budget === null) at("keys without a budget");
    if (t.keys !== null && t.budget !== null && countPresses(t.keys) > t.budget)
      at(`${countPresses(t.keys)} presses in keys, budget ${t.budget}`);
    for (const [what, steps] of [["keys", t.keys], ["baseline", t.baseline?.keys ?? null]] as const) {
      for (const s of steps ?? []) {
        if (typeof s === "string" && s.startsWith("@") && !CONTROLS.includes(s)) at(`${what}: no status-line control "${s}"`);
        const id = keyOf(s);
        if (id !== null && !keys.has(id)) at(`${what}: no key "${id}" in spec/keyboard.yaml`);
        if (typeof s === "object" && ("tap" in s ? s.tap : "drag" in s ? s.drag : "x") === "") at(`${what}: empty target`);
      }
    }
    const b = t.baseline;
    if (b) {
      const want = t.expect.value;
      const near = (got: string, exp: string): boolean => Math.abs((Number(got) - Number(exp)) / Number(exp)) < 1e-11;
      if (Array.isArray(b.text) !== Array.isArray(want)) at(`baseline text is ${Array.isArray(b.text) ? "a list" : "not a list"}, expect.value is ${Array.isArray(want) ? "a list" : "not a list"}`);
      else if (Array.isArray(b.text) && Array.isArray(want)) {
        if (b.text.length !== want.length) at(`baseline text has ${b.text.length} elements, expect.value ${want.length}`);
        else b.text.forEach((x, i) => near(x, want[i] as string) || at(`baseline text[${i}] ${x} is not expect.value[${i}] ${want[i]} to 12 digits`));
      } else if (!near(b.text as string, want as string)) at(`baseline text ${String(b.text)} is not expect.value ${String(want)} to 12 digits`);
      if (b.read === "solve" && b.names?.length !== (Array.isArray(b.text) ? b.text.length : 1)) at("baseline read: solve needs one name per element of text");
    }
  }
  return bad;
}
