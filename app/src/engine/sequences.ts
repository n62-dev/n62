// SPDX-License-Identifier: GPL-3.0-or-later
// G119 (F108), G173: Giac's sequence answers (fMin, fMax, op, divmod) are no value Home or CAS shows (`seq[1/2]`, `1,-1`), and
// Giac adds a stored sequence's elements into one sum (Ans+1 of 1,-1 gave 1). One element becomes its value with its own mark;
// several Giac's list type, shown in braces as G109's, so Ans, the chips and the copy read back what Giac reads; none (`op([])`,
// printed `seq[]`) is no value and is refused (owner, F50/F51: a lost answer is refused with its reason). Decisions: G119.
// G173f1: a store arrow (`v=>G`) is no `name:=value`: Giac has stored the sequence itself, so G follows the slot.
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import type { GiacValue } from "./bridge.ts";
import type { Giac } from "./numeric.ts";
import { isError, printsSequence } from "./giacPrint.ts";
import { putBack } from "./assumed.ts";
import type { InputForm } from "./stores.ts";

/** What the definitions log holds, by name (the host's `byName`). */
export type LoggedNames = ReadonlyMap<string, { readonly name: string; readonly cmds: readonly string[] }>;

export const NO_LOGGED_NAMES: LoggedNames = new Map();

/** The Giac text that gives `name` the value the log holds, or frees it when the log holds none. */
export function nameBack(name: string, logged: LoggedNames): string {
  const entry = logged.get(name);
  return entry ? putBack([], [entry]) : `purge(${name})`;
}

/** G173f1: the store arrow's name (a plain variable, `form.defined`; an element or a function name has none, and
 *  `name:=value` stores the slot itself) gets the value the sequence became, or goes back when there is none. */
function arrowFollows(giac: Giac, slot: string, form: InputForm, logged: LoggedNames, empty: boolean): void {
  if (form.assignment || form.defined?.kind !== "var") return;
  giac.eval(empty ? nameBack(form.defined.name, logged) : `${form.defined.name}:=${slot}`);
}

const asValue = (slot: string, n: number): string => `${slot}:=${n === 1 ? `${slot}[0]` : `list[${slot}]`}`;

/** Home: the sequence answer in `slot` (`v`, printed `text`) as a value or a list, or marked `empty`; `run` is the caller's
 *  Digits. Anything else as it came. `form.noValue`: an input that stores no value (a definition) is not refused. */
export function homeSequence(giac: Giac, slot: string, v: GiacValue, text: string, at: readonly number[], run: <T>(f: () => T) => T, form: InputForm, logged: LoggedNames): { value: GiacValue; text: string; empty: boolean } {
  const same = { value: v, text, empty: false };
  if (v.kind !== "sequence" || isError(text)) return same;
  const n = Number(giac.eval(`size(${slot})`));
  if (n === 0) {
    if (form.noValue) return same;
    arrowFollows(giac, slot, form, logged, true);
    return { ...same, empty: true };
  }
  if (!Number.isInteger(n) || n < 1) return same;
  const value = run(() => giac.value(asValue(slot, n), at));
  if (isError(value.text)) return same;
  arrowFollows(giac, slot, form, logged, false);
  return { value, text: value.cut ? run(() => giac.eval(slot)) : value.text, empty: false };
}

/** CAS: the same for Giac's print `text` of `slot`; null when it is no sequence (no call unless the print may be one). */
export function casSequence(giac: Giac, slot: string, text: string, run: <T>(f: () => T) => T, form: InputForm, logged: LoggedNames): { text: string; empty: boolean } | null {
  if (!printsSequence(text) || giac.value(slot, []).kind !== "sequence") return null;
  const n = Number(giac.eval(`size(${slot})`));
  if (n === 0) {
    if (form.noValue) return null;
    arrowFollows(giac, slot, form, logged, true);
    return { text, empty: true };
  }
  if (!Number.isInteger(n) || n < 1) return null;
  const out = run(() => giac.eval(asValue(slot, n)));
  if (isError(out)) return null;
  arrowFollows(giac, slot, form, logged, false);
  return { text: out, empty: false };
}
