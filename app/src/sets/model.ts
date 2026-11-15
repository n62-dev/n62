// SPDX-License-Identifier: GPL-3.0-or-later
// G275: the formula set (mh-C3, decisions mh-C 6): named inputs with their numbers and named steps over them, re-run
// with new numbers. This file is its model and its text form, UI-free: no view, no storage, no evaluation (G276 on).
// A set's text comes from a file or from an AI's answer, so readSet checks every field as untrusted and refuses the
// first fault as data (a SetError), worded by the view. Only erasable TypeScript syntax.
import { balanced, isName, isProgramWord, names } from "../engine/giacPrint.ts";
import { isFlagName } from "../engine/flags.ts";
import { isOwnName } from "../engine/ourNames.ts";
import { FN } from "../input/emit.ts";
import type { UnitSlot, UnitToken } from "../units/types.ts";

/** A named number: `value` and `sigma` (its standard uncertainty, in the same unit) are decimal text; `slot` its unit. */
export interface SetInput {
  name: string;
  value: string;
  sigma?: string;
  slot?: UnitSlot;
}

/** A named step: `expr` is Giac text over the names of the set's inputs and of its other steps; `end` the unit its
 *  result is shown in. */
export interface SetStep {
  name: string;
  expr: string;
  end?: UnitSlot;
}

export interface FormulaSet {
  name: string;
  inputs: SetInput[];
  steps: SetStep[];
}

/** Why a set is refused: data for the view to word (no user string here). */
export type SetError =
  /** The text is not JSON. */
  | { error: "json" }
  /** No `"n62-set"` number (a whole number from 1) in a JSON object. */
  | { error: "format" }
  /** Written by a newer N62: its format number. */
  | { error: "newer"; version: number }
  /** A field missing, of the wrong type, or not one of the model's; `path` names it (`steps[1]`, `inputs[0].slot`). */
  | { error: "field"; path: string }
  /** An input's or a step's name is not a user's name (ASCII letters, digits and _, a letter first). */
  | { error: "name"; name: string }
  /** A name Giac or N62 reads already (a function, a constant, a keyword, a setting, one of ours). */
  | { error: "reserved"; name: string }
  /** Two inputs or steps of the same name. */
  | { error: "repeat"; name: string }
  /** An input's value, or its sigma, is not decimal text (a sigma below 0 too). */
  | { error: "value" | "sigma"; input: string }
  /** A step reads a name that is neither an input, nor a step, nor a constant of Giac's. */
  | { error: "unknown"; step: string; name: string }
  /** G275 fix 1: a step calls an input or a step as a function (`M(2)`): a set's name holds a value, and Giac would
   *  read the call as a value applied to a number (a silent wrong answer) or substitute without end (`M: S(1)`, `S: M(1)`). */
  | { error: "call"; step: string; name: string }
  /** Steps that read each other, in the order they read: each reads the next, the last the first. */
  | { error: "cycle"; steps: string[] };

export function isSetError<T extends object>(r: T | SetError): r is SetError {
  return "error" in r;
}

/** The text form's format number (`"n62-set": 1`, as the backup's `"n62-backup": 1`). */
export const SET_FORMAT = 1;
const FORMAT = "n62-set";

/** Giac's constants a step may read (`2*pi*f`, `exp(i*w*t)`): no input or step may be named so. */
const CONSTANTS: ReadonlySet<string> = new Set(["pi", "e", "i", "inf", "infinity"]);
/** The functions our entry line writes (input/emit.ts FN): the names the engine-free check knows to be Giac's. */
const FUNCTIONS: ReadonlySet<string> = new Set(Object.values(FN));

/** A name this module knows Giac or N62 reads already. Giac has hundreds of commands more: the engine's check of a
 *  name (G276) is passed to readSet as `reserved`. */
export function reservedName(name: string): boolean {
  return CONSTANTS.has(name) || FUNCTIONS.has(name) || isProgramWord(name) || isFlagName(name) || isOwnName(name);
}

/** Decimal text: an optional minus, digits with an optional point, an optional exponent (`-4.7`, `.5`, `2.2e-3`). */
const DECIMAL = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
/** A unit token's power: an integer or p/q (units/types.ts UnitToken). */
const POWER = /^-?\d+(?:\/(\d+))?$/;

/** The set as text: JSON, the format number first, then the fields in the model's order (two-space indent, a final
 *  newline). readSet reads it back to the same model. */
export function writeSet(set: FormulaSet): string {
  const ordered = {
    [FORMAT]: SET_FORMAT,
    name: set.name,
    inputs: set.inputs.map((i) => ({ name: i.name, value: i.value, ...opt("sigma", i.sigma), ...optSlot("slot", i.slot) })),
    steps: set.steps.map((s) => ({ name: s.name, expr: s.expr, ...optSlot("end", s.end) })),
  };
  return JSON.stringify(ordered, null, 2) + "\n";
}

/**
 * The steps in an order that runs each after the steps it reads, the listed order kept where none reads another
 * (`S` reads `M` and is listed first: `[M, S]`). Refuses a name a step reads that is neither an input, nor a step, nor a
 * Giac constant (the first, in listed order), or one an input or a step calls (`M(2)`: refused, never read as a
 * function), then a cycle. Names are taken as distinct (readSet's check).
 */
export function stepOrder(set: FormulaSet): string[] | SetError {
  const inputs = new Set(set.inputs.map((i) => i.name));
  const stepNames = new Set(set.steps.map((s) => s.name));
  const reads = new Map<string, string[]>();
  for (const s of set.steps) {
    const used: string[] = [];
    for (const { name: n, call } of names(s.expr, "typed")) {
      if (call) {
        // a called name is Giac's function (checked when the set runs); a set's own name never is one
        if (inputs.has(n) || stepNames.has(n)) return { error: "call", step: s.name, name: n };
      } else if (stepNames.has(n)) {
        if (!used.includes(n)) used.push(n);
      } else if (!inputs.has(n) && !CONSTANTS.has(n)) return { error: "unknown", step: s.name, name: n };
    }
    reads.set(s.name, used);
  }
  // a depth-first walk without recursion (an untrusted set may chain thousands of steps): 1 on the path, 2 placed
  const state = new Map<string, 1 | 2>();
  const order: string[] = [];
  for (const s of set.steps) {
    if (state.has(s.name)) continue;
    const path: { name: string; next: number }[] = [{ name: s.name, next: 0 }];
    state.set(s.name, 1);
    while (path.length) {
      const top = path[path.length - 1]!;
      const deps = reads.get(top.name)!;
      if (top.next < deps.length) {
        const d = deps[top.next++]!;
        const st = state.get(d);
        if (st === 1) return { error: "cycle", steps: path.slice(path.findIndex((p) => p.name === d)).map((p) => p.name) };
        if (st === undefined) {
          state.set(d, 1);
          path.push({ name: d, next: 0 });
        }
      } else {
        state.set(top.name, 2);
        order.push(top.name);
        path.pop();
      }
    }
  }
  return order;
}

/** A refusal found deep in the read: thrown to readSet, which returns it. */
class Refused {
  constructor(readonly why: SetError) {}
}
const refuse = (why: SetError): never => {
  throw new Refused(why);
};
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** `v` is an object holding only the fields `known` (own keys: JSON.parse makes `"__proto__"` an ordinary one). */
function record(v: unknown, path: string, known: readonly string[]): Record<string, unknown> {
  if (!isObject(v)) return refuse({ error: "field", path });
  const extra = Object.keys(v).find((k) => !known.includes(k));
  if (extra !== undefined) refuse({ error: "field", path: path ? `${path}.${extra}` : extra });
  return v;
}

/** The field `key` of `o`, which must be a string (non-empty when `filled`). */
function str(o: Record<string, unknown>, key: string, path: string, filled: boolean): string {
  const v = o[key];
  if (typeof v !== "string" || (filled && v.trim() === "")) return refuse({ error: "field", path: path ? `${path}.${key}` : key });
  return v;
}

/** A unit slot (units/types.ts UnitSlot) as untrusted data: one token or more, each a unit id with an optional prefix id
 *  and power, `per` an index of a token. Unit and prefix ids are not looked up here (the Find index is the view's). */
function slotOf(v: unknown, path: string): UnitSlot {
  const bad = (): never => refuse({ error: "field", path });
  if (!isObject(v) || Object.keys(v).some((k) => k !== "tokens" && k !== "per")) return bad();
  const raw = v["tokens"];
  if (!Array.isArray(raw) || raw.length === 0) return bad();
  const tokens = raw.map((t: unknown): UnitToken => {
    if (!isObject(t) || Object.keys(t).some((k) => k !== "prefix" && k !== "unit" && k !== "power")) return bad();
    const { prefix, unit, power } = t;
    if (!nonEmpty(unit) || (prefix !== undefined && !nonEmpty(prefix))) return bad();
    const p = typeof power === "string" ? POWER.exec(power) : null;
    if (power !== undefined && (!p || (p[1] !== undefined && /^0+$/.test(p[1])))) return bad();
    return { ...(prefix !== undefined ? { prefix } : {}), unit, ...(typeof power === "string" ? { power } : {}) };
  });
  const per = v["per"];
  if (per !== undefined && (typeof per !== "number" || !Number.isInteger(per) || per < 0 || per >= tokens.length)) return bad();
  return { tokens, ...(per !== undefined ? { per } : {}) };
}

/**
 * A set from its text, every field checked as untrusted: the format number (none, or one larger than SET_FORMAT, is
 * refused), the fields of the model and no other, each name a user's name that nothing reads already (`reserved`: the
 * engine's check, added to reservedName) and used once, decimal values and sigmas (a sigma not below 0), each step's
 * Giac text with its brackets closed, and stepOrder's checks. The first fault is returned.
 */
export function readSet(text: string, reserved?: (name: string) => boolean): FormulaSet | SetError {
  let j: unknown;
  try {
    j = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return { error: "json" };
  }
  try {
    if (!isObject(j) || !Object.hasOwn(j, FORMAT)) return { error: "format" };
    const f = j[FORMAT];
    if (typeof f !== "number" || !Number.isInteger(f) || f < 1) return { error: "format" };
    if (f > SET_FORMAT) return { error: "newer", version: f };
    const top = record(j, "", [FORMAT, "name", "inputs", "steps"]);
    const name = str(top, "name", "", true);
    const seen = new Set<string>();
    const named = (o: Record<string, unknown>, path: string): string => {
      const n = str(o, "name", path, false);
      if (!isName(n, true)) refuse({ error: "name", name: n });
      if (reservedName(n) || reserved?.(n) === true) refuse({ error: "reserved", name: n });
      if (seen.has(n)) refuse({ error: "repeat", name: n });
      seen.add(n);
      return n;
    };
    const list = (key: string): unknown[] => {
      const v = top[key];
      return Array.isArray(v) ? v : refuse({ error: "field", path: key });
    };
    const inputs = list("inputs").map((raw, k): SetInput => {
      const path = `inputs[${k}]`;
      const o = record(raw, path, ["name", "value", "sigma", "slot"]);
      const n = named(o, path);
      const { value, sigma } = o;
      if (typeof value !== "string" || !DECIMAL.test(value)) refuse({ error: "value", input: n });
      if (sigma !== undefined && (typeof sigma !== "string" || !DECIMAL.test(sigma) || sigma.startsWith("-"))) refuse({ error: "sigma", input: n });
      return { name: n, value: value as string, ...opt("sigma", sigma as string | undefined), ...optSlot("slot", o["slot"] === undefined ? undefined : slotOf(o["slot"], `${path}.slot`)) };
    });
    const steps = list("steps").map((raw, k): SetStep => {
      const path = `steps[${k}]`;
      const o = record(raw, path, ["name", "expr", "end"]);
      const n = named(o, path);
      const expr = str(o, "expr", path, true);
      if (!balanced(expr, "typed")) refuse({ error: "field", path: `${path}.expr` });
      return { name: n, expr, ...optSlot("end", o["end"] === undefined ? undefined : slotOf(o["end"], `${path}.end`)) };
    });
    const set: FormulaSet = { name, inputs, steps };
    const order = stepOrder(set);
    return isSetError(order) ? order : set;
  } catch (e) {
    if (e instanceof Refused) return e.why;
    throw e;
  }
}

/** `{[key]: v}` when `v` is there, else nothing (an optional field stays absent, never `undefined`). */
function opt<K extends string>(key: K, v: string | undefined): { [k in K]?: string } {
  return v === undefined ? {} : ({ [key]: v } as { [k in K]?: string });
}
function optSlot<K extends string>(key: K, v: UnitSlot | undefined): { [k in K]?: UnitSlot } {
  return v === undefined ? {} : ({ [key]: { tokens: v.tokens.map((t) => ({ ...(t.prefix !== undefined ? { prefix: t.prefix } : {}), unit: t.unit, ...(t.power !== undefined ? { power: t.power } : {}) })), ...(v.per !== undefined ? { per: v.per } : {}) } } as { [k in K]?: UnitSlot });
}
