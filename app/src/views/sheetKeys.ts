// SPDX-License-Identifier: GPL-3.0-or-later
// What a key does while a sheet is open (docs/05 3.1 with section 7). Shift and Alpha are ignored for picking: a key
// is read by what it is, never by the layer, so no key goes through the sheet into the entry line (rule 4).
import { actionFor, type Key, type Layer } from "../keyboard/keyboard.ts";
import { deadPress, isSelect, modsFor, special, type Mods, type RouteCtx } from "../keyboard/route.ts";

export type SheetKey =
  | { kind: "move"; by: 1 | -1 }
  /** Digit keys: the row numbered 1…10 (0 picks the tenth); the two keys after 0, `.` and the space bar, pick rows 11 and 12 (R780). */
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
const PASS: readonly string[] = ["shift", "alpha", "menu", "apps", "slot", "tmpl", "home", "cas", "switch", "symb", "plot", "num"];

/** The key's letter: its Alpha layer when that types one letter (A on Vars … Z on 2). A free key has none: its Alpha
 *  slot is the user's own (R15c3), and the letters of the sheet's filter stay where they are. */
export function letterOf(key: Key): string | undefined {
  const a = key.user ? undefined : key.actions.alpha;
  return a?.kind === "type" && /^\p{L}$/u.test(a.text) ? a.text : undefined;
}

/** R780: the row a pad key picks beyond the ten digits: the two keys after 0 (spec/keyboard.yaml row 9), `.` row 11 and the space bar row 12. */
const KEY_OF_ROW: Readonly<Record<string, number>> = { dot: 11, space: 12 };
/** R780: the pick of a key after 0 (`.` row 11, the space bar row 12) when the open level numbers that many rows (`numbered`), else undefined. */
const afterZero = (key: Key, numbered: number): SheetKey | undefined => {
  const n = KEY_OF_ROW[key.id];
  return n !== undefined && n <= numbered ? { kind: "pick", n } : undefined;
};

/** A key's job in a sheet. `filter`: the open level takes letters (long lists); `numbered`: how many rows the open level numbers (Level.numbered). */
export function sheetKey(key: Key, filter: boolean, numbered = 10): SheetKey {
  const d = DIGIT.exec(key.id);
  if (d) return { kind: "pick", n: Number(d[1]) || 10 };
  const more = afterZero(key, numbered);
  if (more) return more;
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
const FIND_PASS: readonly string[] = ["menu", "apps", "slot", "home", "cas", "switch", "symb", "plot", "num"];

/**
 * A key in Find (R4a, docs/04 3.7, decisions.md S2 rule M1). Every key types its letter in lower case, Tmpl and Math
 * too (no Alpha press); a flick down types it on any key. A digit key picks the row with its number while the level's
 * query is empty (the categories, a category's items) and types its digit once a letter is typed (`g0`, `log10`).
 * Shift + a key, or a flick up, types the key's own character (a digit, `.`). ▲ ▼ move, Enter inserts, ▶ opens a
 * category, ◀ and Esc go back a level (the top closes), ⌫ deletes. `shift`: Shift is on for this tap; `empty`: the
 * open level's query is empty.
 */
export function findKey(key: Key, layer: Layer | undefined, shift: boolean, empty: boolean, numbered = 10): SheetKey {
  const fixed = BY_ID[key.id];
  if (fixed) return fixed;
  const more = empty && layer !== "alpha" && layer !== "shift" && !(layer === undefined && shift) ? afterZero(key, numbered) : undefined; // R780: `.` and the space bar pick rows 11 and 12 of the empty query's list
  if (more) return more;
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

/** The open sheet as the keys read it (R820): its kind (`find`: Vars, Find and Memory; `store`; `other`: the rest), whether the open level
 *  takes letters (`filter`), how many rows it numbers, whether its query is empty, and whether the CAS view is under the keys (the
 *  store sheet's letter case, R58). */
export type SheetCtx = { kind: "find" | "store" | "other"; filter: boolean; numbered: number; empty: boolean; cas: boolean };

/** What a tap (`layer` undefined, with the modifiers `mods` it is pressed in) or a flick (`layer`) on a key does in the open sheet: the one
 *  choice among Find, Store and the other lists, which sheetAct acts on and the keypad draws (sheetFace). Shift and Alpha keep their job
 *  in every sheet (route.ts takes them before the sheet does). */
export function sheetJob(key: Key, s: SheetCtx, mods: Mods, layer: Layer | undefined): SheetKey {
  const p = key.actions.primary;
  if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) return { kind: "pass" };
  if (s.kind === "find") return findKey(key, layer, mods.shift, s.empty, s.numbered);
  if (s.kind === "store") return storeKey(key, mods.shift, mods.alpha, s.cas, s.empty);
  return layer === "alpha" || layer === "shift" ? sheetFlick(key, layer === "alpha", s.filter) : sheetKey(key, s.filter, s.numbered);
}

/** R820: how the keypad draws a key while a sheet is open. `text`: the character a tap types there, in the case it types it (the face, the
 *  pop and the flick bubble show it); `dead`: the key does nothing there (drawn dimmed, its face kept). Any other job (a pick, ▲ ▼ ◀ ▶,
 *  Enter, Esc, ⌫, a key that passes or goes on to the line): the key's own face, lit. */
export function sheetFace(key: Key, s: SheetCtx, mods: Mods, layer?: Layer): { text?: string; dead: boolean } {
  const job = sheetJob(key, s, mods, layer);
  if (job.kind === "letter") return { text: job.ch, dead: false };
  return { dead: job.kind === "none" };
}

/** What a key does in the open sheet (route.ts sheetPress, once the grid, a free key's slot and a cell's place have not taken it; here, in
 *  the sheet's own code, so the start chunk does not carry it). `layer`: the one a gesture chose; `mods`: the modifiers a queued key was
 *  pressed with (R8). True: the key was used up. */
export function sheetAct(c: RouteCtx, key: Key, layer: Layer | undefined, mods?: Mods): boolean {
  const shell = c.shell;
  const sheet = shell.sheet!;
  const level = sheet.level;
  const find = sheet.id === "find";
  const store = sheet.id === "store";
  // Find reads the session's Shift; R281: a key that types a letter on the line types the same letter into the store sheet's name (x alone,
  // Alpha + Vars A, lower case in CAS, R58; a flick as its layer), so the typed path stores as before; a key that types no name goes on to
  // the line (`line`) with its Shift or Alpha, and one the sheet takes uses a one-shot Shift or Alpha up, as on the line
  const m = find ? { shift: c.session.shift, alpha: c.session.alpha } : (mods ?? modsFor(c, layer));
  const k = sheetJob(key, { kind: find ? "find" : store ? "store" : "other", filter: level.filterable, numbered: level.numbered, empty: level.filter === "", cas: c.casKeys }, m, layer);
  if (store && k.kind !== "line" && layer === undefined) c.session.clearModifiers();
  // in Find a one-shot Shift is used up by the key it types (its lock stays); elsewhere a sheet leaves it as it is
  if (find && c.session.shift && !c.session.shiftLock) c.session.clearModifiers();
  switch (k.kind) {
    case "move":
      level.move(k.by);
      return true;
    case "pick":
      shell.picked(sheet.pickNumber(k.n));
      return true;
    case "enter":
      shell.picked(sheet.enter());
      return true;
    case "right":
      shell.picked(sheet.right());
      return true;
    case "left":
      if (!sheet.left() && !sheet.back()) shell.closeSheet();
      return true;
    case "back":
      if (!sheet.back()) shell.closeSheet();
      return true;
    case "letter":
      level.type(k.ch);
      return true;
    case "backspace":
      // in Find ⌫ on an empty query goes back from a category to the list of categories; elsewhere nothing to delete is a dead
      // press (R770; deadPress)
      if (find) {
        if (!level.backspace()) sheet.back();
      } else if (deadPress(c, key)) c.dead();
      else level.backspace();
      return true;
    case "line":
      // R281: a key that types no name after ▶ (⌫ with nothing typed too, sheetKeys.ts storeKey): its job on the line.
      // R281f1: what was typed into the filter goes on the line first, one character at a time as typeLetter types it
      // (digits too), so the key meets the line it met before the sheet (x, Shift + space is x_)
      for (const ch of level.filter) c.entry.run({ kind: "type", text: ch });
      shell.closeSheet();
      return false;
    case "none":
      c.dead(); // R770: a key the sheet does not use is dead (docs/05 3.7); the sheet stays
      return true;
    case "pass": {
      // read by what the key is, not by the layer: ☰, the place name and Tmpl toggle their sheet, a control that
      // changes place (a view tab, a user key that holds Home or CAS) closes it and goes there
      const p = key.actions.primary;
      if (p?.kind !== "special" || isSelect(p)) return true; // (R279: Select and Deselect act on the line only)
      if (p.name !== "menu" && p.name !== "apps" && p.name !== "slot" && p.name !== "tmpl") shell.closeSheet();
      special(c, p.name);
      return true;
    }
  }
}
