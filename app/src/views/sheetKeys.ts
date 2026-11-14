// SPDX-License-Identifier: GPL-3.0-or-later
// What a key does while a sheet is open (docs/05 3.1 with section 7). Shift and Alpha are ignored for picking: a key
// is read by what it is, never by the layer, so no key goes through the sheet into the entry line (rule 4).
import { actionFor, type Key, type Layer } from "../keyboard/keyboard.ts";

export type SheetKey =
  | { kind: "move"; by: 1 | -1 }
  /** Digit keys: the row numbered 1…10 (0 picks the tenth). */
  | { kind: "pick"; n: number }
  | { kind: "enter" }
  /** ▶: open the highlighted submenu. */
  | { kind: "right" }
  /** Esc: back one level (the root closes). There is no close-all key since R15c (Cancel went). */
  | { kind: "back" }
  /** ◀: step a setting down, else back one level (the root closes). */
  | { kind: "left" }
  /** A tap on a key that is not a digit types its letter into the filter (no Alpha press needed). */
  | { kind: "letter"; ch: string }
  | { kind: "backspace" }
  /** The key keeps its own job: Shift and Alpha (their state is kept as it is), and the controls that change place
   *  (the status line's ☰ and place name, and Tmpl, toggle their sheet; its view tabs and a user key that holds Home,
   *  CAS, Apps, Menu or a view close it and go there). A user key that holds anything else does nothing in a sheet. */
  | { kind: "pass" }
  /** Does nothing in a sheet. */
  | { kind: "none" }
  /** R281, the store sheet: the key types no name; the sheet closes and the key does its job on the line (Shift + 9's
   *  Greek palette, an operator, ⌫ with nothing typed), as it did after ▶ before the sheet. */
  | { kind: "line" };

const DIGIT = /^d([0-9])$/;
const BY_ID: Readonly<Record<string, SheetKey>> = {
  up: { kind: "move", by: -1 },
  down: { kind: "move", by: 1 },
  enter: { kind: "enter" },
  right: { kind: "right" },
  left: { kind: "left" },
  esc: { kind: "back" },
  bksp: { kind: "backspace" },
};
const PASS: readonly string[] = ["shift", "alpha", "menu", "apps", "tmpl", "home", "cas", "switch", "symb", "plot", "num"];

/** The key's letter: its Alpha layer when that types one letter (A on Vars … Z on 2). A free key has none: its Alpha
 *  slot is the user's own (R15c3), and the letters of the sheet's filter stay where they are. */
export function letterOf(key: Key): string | undefined {
  const a = key.user ? undefined : key.actions.alpha;
  return a?.kind === "type" && /^\p{L}$/u.test(a.text) ? a.text : undefined;
}

/** A key's job in a sheet. `filter`: the open level takes letters (long lists). */
export function sheetKey(key: Key, filter: boolean): SheetKey {
  const d = DIGIT.exec(key.id);
  if (d) return { kind: "pick", n: Number(d[1]) || 10 };
  const fixed = BY_ID[key.id];
  if (fixed) return fixed;
  const p = key.actions.primary;
  if (p?.kind === "special" && PASS.includes(p.name)) return { kind: "pass" };
  const ch = filter ? letterOf(key) : undefined;
  return ch ? { kind: "letter", ch } : { kind: "none" };
}

/** A flick in a sheet (R9): down types the key's letter into the filter, on any key, digits included (docs/05
 *  section 7 point 6); up does nothing (a sheet ignores the Shift layer). */
export function sheetFlick(key: Key, down: boolean, filter: boolean): SheetKey {
  const ch = down && filter ? letterOf(key) : undefined;
  return ch ? { kind: "letter", ch } : { kind: "none" };
}

/** The status line's controls keep their job in Find: they close it and go there, or toggle their sheet. */
const FIND_PASS: readonly string[] = ["menu", "apps", "home", "cas", "switch", "symb", "plot", "num"];

/**
 * A key in Find (R4a, docs/04 3.7, decisions.md S2 rule M1). Every key types its letter in lower case, Tmpl and Math
 * too (no Alpha press); a flick down types it on any key. A digit key picks the row with its number while the level's
 * query is empty (the categories, a category's items) and types its digit once a letter is typed (`g0`, `log10`).
 * Shift + a key, or a flick up, types the key's own character (a digit, `.`). ▲ ▼ move, Enter inserts, ▶ opens a
 * category, ◀ and Esc go back a level (the top closes), ⌫ deletes. `shift`: Shift is on for this tap; `empty`: the
 * open level's query is empty.
 */
export function findKey(key: Key, layer: Layer | undefined, shift: boolean, empty: boolean): SheetKey {
  const fixed = BY_ID[key.id];
  if (fixed) return fixed;
  const p = key.actions.primary;
  if (p?.kind === "special" && FIND_PASS.includes(p.name)) return { kind: "pass" };
  const own = p?.kind === "type" && [...p.text].length === 1 ? p.text : undefined;
  const letter = letterOf(key)?.toLowerCase();
  if (layer === "alpha") return letter ? { kind: "letter", ch: letter } : { kind: "none" };
  if (layer === "shift" || (layer === undefined && shift)) return own && !/^\p{L}$/u.test(own) ? { kind: "letter", ch: own } : { kind: "none" };
  const d = DIGIT.exec(key.id);
  if (d) return empty ? { kind: "pick", n: Number(d[1]) || 10 } : { kind: "letter", ch: d[1] as string };
  // a hardware key's own character (R31 hands it on as the primary layer): `.` and `/` type themselves
  if (layer === "primary" && own && !/^\p{L}$/u.test(own)) return { kind: "letter", ch: own };
  return letter ? { kind: "letter", ch: letter } : { kind: "none" };
}

/**
 * A key in the store sheet (R281, docs/archive/store-design.md design A): a name is typed into its filter. A key that
 * types a letter on the line types it, in the layer it was pressed in (`shift`, `alpha`: a tap before it or a flick; x
 * alone, Alpha + Vars A; lower case in CAS, `cas`, R58). ▲ ▼ ◀ ▶, Enter, Esc and ⌫ keep their sheet job (⌫ with
 * nothing typed goes on to the line, R281f1). A plain
 * digit picks no row there: after a letter it belongs to the name (`A1`), before one it does nothing. A plain key that
 * types no letter types its Alpha letter, as in every sheet, and the place keys keep theirs. Any other key types no name
 * (`line`): it does its job on the line, so every press after ▶ that did not type a name does what it did before.
 * `empty`: nothing typed yet.
 */
export function storeKey(key: Key, shift: boolean, alpha: boolean, cas: boolean, empty: boolean): SheetKey {
  const a = actionFor(key, shift, alpha, false, cas);
  if (a?.kind === "type" && /^\p{L}$/u.test(a.text)) return { kind: "letter", ch: a.text };
  const layered = shift || alpha;
  const fixed = BY_ID[key.id];
  if (fixed) return fixed.kind === "backspace" && empty ? { kind: "line" } : fixed; // ⌫ with nothing typed: the ▶ goes
  const d = DIGIT.exec(key.id);
  if (d && !layered) return empty ? { kind: "none" } : { kind: "letter", ch: d[1] as string };
  const k = layered ? undefined : sheetKey(key, true);
  return k && k.kind !== "none" ? k : { kind: "line" };
}
