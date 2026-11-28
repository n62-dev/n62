// SPDX-License-Identifier: GPL-3.0-or-later
// What a key does while a sheet is open (docs/05 3.1 with section 7). Shift and Alpha are ignored for picking: a key
// is read by what it is, never by the layer, so no key goes through the sheet into the entry line (rule 4).
import { actionFor, type Key, type Layer } from "../keyboard/keyboard.ts";
import { deadPress, holdKeys, isSelect, layerOf, modsFor, special, type Mods, type RouteCtx } from "../keyboard/route.ts";
import type { MenuItem } from "../apps/types.ts";
import type { Sheet } from "./sheet.svelte.ts";

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
  /** R814, Memory: Shift + ⌫ (the hardware Delete) deletes the highlighted name, or arms Clear all, as its swipe and Enter do. */
  | { kind: "delete" }
  /** R815, the Copy key (Shift + Select) in Find, Vars and Memory: the highlighted row copies its value (MenuItem.copy: a stored name's full
   *  value, a constant's); a row with none, or no row, is the dead press. */
  | { kind: "copy" }
  /** The key keeps its own job: Shift and Alpha (their state is kept as it is), the ⚙ key (Settings as the sheet's next
   *  level, R887), and the controls that change place (the status line's ☰ and place name, and Tmpl, toggle their sheet;
   *  its view tabs and a user key that holds Home, CAS, Apps, Menu or a view close it and go there). A user key that
   *  holds anything else does nothing in a sheet. */
  | { kind: "pass" }
  /** R900, the Paste key in a list whose filter takes a pasted name (SheetCtx.paste): the clipboard's name is typed into it. */
  | { kind: "paste" }
  /** R869: Help in Find (the Help action of the layer pressed): the highlighted row's help as a level over it; a row that is no index
   *  item, or none, is the dead press. */
  | { kind: "help" }
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
/** A key that keeps its own job in a sheet: its primary is one of `list`; `settings` only on the ⚙ key itself (R887; a free key that
 *  holds Settings does nothing in a sheet, R15b). */
const passes = (key: Key, list: readonly string[]): boolean => {
  const p = key.actions.primary;
  return p?.kind === "special" && list.includes(p.name) && (p.name !== "settings" || !key.user);
};
const PASS: readonly string[] = ["shift", "alpha", "settings", "menu", "apps", "slot", "tmpl", "home", "cas", "switch", "symb", "plot", "num"];

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
  if (passes(key, PASS)) return { kind: "pass" };
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
const FIND_PASS: readonly string[] = ["settings", "menu", "apps", "slot", "home", "cas", "switch", "symb", "plot", "num"];

/** R946: the keys whose hardware character has no one-character primary: a hardware `/`, `*`, `^` presses them in `primary`. */
const HW_OPERATOR: Readonly<Record<string, string>> = { div: "/", mul: "*", pow: "^" };

/**
 * A key in Find (R4a, docs/04 3.7, decisions.md S2 rule M1). Every key types its letter in lower case, Tmpl and Math
 * too (no Alpha press); a flick down types it on any key. A digit key picks the row with its number while the level's
 * query is empty (the categories, a category's items) and types its digit once a letter is typed (`g0`, `log10`).
 * Shift + a key, or a flick up, types the key's own character (a digit, `.`). R889: Alpha armed (a tap, `alpha`) types
 * the key's letter as a flick down does, Shift or not, digits included (Alpha, 7 is q); a key with no letter keeps its
 * job. A key whose own character is a letter types that letter (the x key types x; its letter d by Alpha or a flick).
 * ▲ ▼ move, Enter inserts, ▶ opens a category, ◀ and Esc go back a level (the top closes), ⌫ deletes. `shift`, `alpha`:
 * Shift, Alpha is on for this tap; `empty`: the open level's query is empty. R814: `memory` (Memory's level): Shift + ⌫, a tap with
 * Shift on or the layer a hardware Delete presses, deletes the highlighted row; plain ⌫ stays the search's.
 */
export function findKey(key: Key, layer: Layer | undefined, shift: boolean, empty: boolean, numbered = 10, alpha = false, memory = false): SheetKey {
  if (memory && key.id === "bksp" && (layer === "shift" || (layer === undefined && shift))) return { kind: "delete" };
  const fixed = BY_ID[key.id];
  if (fixed) return fixed;
  const typed = layer === "primary" && !memory ? HW_OPERATOR[key.id] : undefined; // R946: a hardware / * ^ types itself, never the key's Alpha letter (a tap has no layer); Memory's filter keeps its keys as before
  if (typed) return { kind: "letter", ch: typed };
  const letter = letterOf(key)?.toLowerCase();
  const byAlpha = layer === "alpha" || (layer === undefined && alpha && letter !== undefined); // a flick down, or Alpha armed on a key with a letter
  const more = empty && !byAlpha && layer !== "shift" && !(layer === undefined && shift) ? afterZero(key, numbered) : undefined; // R780: `.` and the space bar pick rows 11 and 12 of the empty query's list
  if (more) return more;
  if (passes(key, FIND_PASS)) return { kind: "pass" };
  if (byAlpha) return letter ? { kind: "letter", ch: letter } : { kind: "none" };
  const p = key.actions.primary;
  const own = p?.kind === "type" && [...p.text].length === 1 ? p.text : undefined;
  const ownLetter = own !== undefined && /^\p{L}$/u.test(own);
  if (layer === "shift" || (layer === undefined && shift)) return own && !ownLetter ? { kind: "letter", ch: own } : { kind: "none" };
  const d = DIGIT.exec(key.id);
  if (d) return empty ? { kind: "pick", n: Number(d[1]) || 10 } : { kind: "letter", ch: d[1] as string };
  // a key's own character: x types x (R889), and a hardware key's (R31 hands it on as the primary layer): `.` and `/` type themselves
  if (own && ownLetter && !key.user) return { kind: "letter", ch: own.toLowerCase() };
  if (layer === "primary" && own) return { kind: "letter", ch: own };
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
  const p = key.actions.primary;
  if (p?.kind === "special" && p.name === "settings") return { kind: "line" }; // the ⚙ key: Settings from the line, as before R887
  return k && k.kind !== "none" ? k : { kind: "line" };
}

/** The open sheet as the keys read it (R820): its kind (`find`: Vars, Find and Memory; `store`; `other`: the rest), whether the open level
 *  takes letters (`filter`), how many rows it numbers, whether its query is empty, whether the CAS view is under the keys (the
 *  store sheet's letter case, R58), and whether the Paste key types a pasted name into its filter (`paste`, R900; the keypad gives the
 *  sheet itself, `of`, and pastes reads it here, so the start chunk carries no rule of its own). */
export type SheetCtx = { kind: "find" | "store" | "other"; filter: boolean; numbered: number; empty: boolean; cas: boolean; paste?: boolean; of?: Sheet };

/** R900: the Paste key types a pasted name into the open level's filter: Find, Vars and Store in, not Memory (its Paste is R816's)
 *  nor a matrix grid's level. */
export function pastes(sheet: Sheet): boolean {
  const l = sheet.level;
  return (sheet.id === "find" || sheet.id === "store") && l.filterable && !l.digitPick && !l.grid;
}

/** R900: the Paste key (Shift + Deselect, R723), by a tap with its modifiers or a flick's layer; a free key holding it does nothing in a sheet. */
const isPaste = (key: Key, mods: Mods, layer: Layer | undefined): boolean => {
  const a = key.user ? undefined : layer === undefined ? actionFor(key, mods.shift, mods.alpha) : key.actions[layer];
  return a?.kind === "special" && a.name === "paste";
};

/** R815: the Copy action (Shift + Select, R723), by a tap with its modifiers or a flick's layer; a free key holding it does nothing in a sheet. */
const isCopy = (key: Key, mods: Mods, layer: Layer | undefined): boolean => {
  const a = key.user ? undefined : layer === undefined ? actionFor(key, mods.shift, mods.alpha) : key.actions[layer];
  return a?.kind === "special" && a.name === "copy";
};

/** R869: the Help action, by a tap with its modifiers or a flick's layer (Shift + the ⚙ key since R863; a free key holding it does
 *  nothing in a sheet). */
const isHelp = (key: Key, mods: Mods, layer: Layer | undefined): boolean => {
  const a = key.user ? undefined : layer === undefined ? actionFor(key, mods.shift, mods.alpha) : key.actions[layer];
  return a?.kind === "special" && a.name === "help";
};

/** R869: the open level's highlighted row when it is an item of the Find index (a function, template, unit, prefix or constant; not a
 *  unit of your own, `unit:@…`), else undefined: a stored name in Vars or Memory, a category, a product of units, a card's own row. */
export function helpRow(sheet: Sheet): MenuItem | undefined {
  const row = sheet.id === "find" ? sheet.level.current : undefined;
  return row && !row.disabled && /^(fn|tmpl|unit|pfx|const):(?!@)/.test(row.id) ? row : undefined;
}

/** R900: the longest name the Paste key types into a filter. */
const NAME_MAX = 32;
/** R900: the name in a pasted text: its first line, trimmed, when it is a name (a letter, then letters, digits and `_`, at most
 *  NAME_MAX characters); anything else (a number, a sum, a second word) is no name. */
export function pastedName(text: string): string | undefined {
  const line = (text.split(/\r\n|\n|\r/u)[0] ?? "").trim();
  return [...line].length <= NAME_MAX && /^\p{L}[\p{L}0-9_]*$/u.test(line) ? line : undefined;
}

/** What a tap (`layer` undefined, with the modifiers `mods` it is pressed in) or a flick (`layer`) on a key does in the open sheet: the one
 *  choice among Find, Store and the other lists, which sheetAct acts on and the keypad draws (sheetFace). Shift and Alpha keep their job
 *  in every sheet (route.ts takes them before the sheet does). */
export function sheetJob(key: Key, s: SheetCtx, mods: Mods, layer: Layer | undefined): SheetKey {
  const p = key.actions.primary;
  if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) return { kind: "pass" };
  if (s.paste && isPaste(key, mods, layer)) return { kind: "paste" };
  if (s.kind === "store") return storeKey(key, mods.shift, mods.alpha, s.cas, s.empty);
  if (s.kind === "find" && isHelp(key, mods, layer)) return { kind: "help" }; // R869: Help on Find's highlighted row
  if (s.kind === "find" && isCopy(key, mods, layer)) return { kind: "copy" }; // R815: Copy on the highlighted row
  if (s.of?.helpCloses && isHelp(key, mods, layer)) return { kind: "back" }; // R870: a second Help closes the unit view's Help sheet
  // R887: the ⚙ key's tap opens Settings on the sheet; Shift + it is Help, which stays dead in any other sheet (R863)
  if (p?.kind === "special" && p.name === "settings" && !key.user && (mods.shift || layer === "shift")) return { kind: "none" };
  if (s.kind === "find") return findKey(key, layer, mods.shift, s.empty, s.numbered, mods.alpha, s.of?.level.digitPick === "highlight");
  return layer === "alpha" || layer === "shift" ? sheetFlick(key, layer === "alpha", s.filter) : sheetKey(key, s.filter, s.numbered);
}

/** R820: how the keypad draws a key while a sheet is open. `text`: the character a tap types there, in the case it types it (the face, the
 *  pop and the flick bubble show it); `dead`: the key does nothing there (drawn dimmed, its face kept). Any other job (a pick, ▲ ▼ ◀ ▶,
 *  Enter, Esc, ⌫, a key that passes or goes on to the line): the key's own face, lit. */
export function sheetFace(key: Key, s: SheetCtx, mods: Mods, layer?: Layer): { text?: string; dead: boolean } {
  const job = sheetJob(key, s.of ? { ...s, paste: pastes(s.of) } : s, mods, layer);
  if (job.kind === "letter") return { text: job.ch, dead: false };
  if (job.kind === "help") return { dead: s.of !== undefined && helpRow(s.of) === undefined }; // R869: no row to explain
  if (job.kind === "copy") return { dead: s.of !== undefined && s.of.level.current?.copy === undefined }; // R815: no row that copies
  return { dead: job.kind === "none" };
}

/** A key while a sheet is open (docs/05 3.1; every sheet is in the viewport with the keys live below it, R770; route.ts sheetPress,
 *  R930: here in the sheet's chunk). Shift and Alpha are ignored, and the sheet leaves them as they are; no key goes through to the
 *  entry line; a key the sheet does not use is dead. A flick down types the key's letter into the filter, on any key (digits too;
 *  docs/05 section 7 point 6); a flick up does nothing there. False: the key goes on to the line (sheetAct). */
export function sheetPress(c: RouteCtx, key: Key, layer: Layer | undefined, mods?: Mods): boolean {
  const shell = c.shell;
  const sheet = shell.sheet;
  if (!sheet) return false;
  const level = sheet.level;
  if (key.id !== "enter") sheet.disarm(); // R281: any press but Enter (the armed item's second pick) disarms
  // R4b: while Your keys is open, a free key goes to its own slot's row (the cluster stays live above the sheet)
  if (key.user && sheet.goKey(key.id, layerOf(modsFor(c, layer)))) return true;
  const cell = level.grid?.key(c, key, layer); // R189: a matrix grid's cell is edited on the line (matrixGrid.svelte.ts)
  if (cell === true && layer === undefined) c.session.clearModifiers(); // R300: a key the grid takes (Clear, Store ▶) uses a one-shot Shift up, as on the line
  if (cell !== undefined) return cell;
  // a grid whose cells show keys (Shift + 6, R18): a tap on such a key picks its cell, before its usual sheet job
  const byPlace = layer === "alpha" || layer === "shift" ? undefined : sheet.pickKey(key.id);
  if (byPlace) {
    shell.picked(byPlace);
    return true;
  }
  return sheetAct(c, key, layer, mods);
}

/** A letter from a hardware keyboard while a sheet is open (route.ts typeLetter, R930: here in the sheet's chunk). R300: an open
 *  matrix grid is asked first, as sheetPress asks it (the letter as a type action): it starts the cell's edit, or types into it;
 *  false when it leaves the letter to the line. Otherwise the letter goes to the level's filter (Find's in lower case, R4a). */
export function sheetLetter(c: RouteCtx, ch: string): boolean {
  const sheet = c.shell.sheet;
  if (!sheet) return false;
  sheet.disarm(); // R281
  const grid = sheet.level.grid;
  // (the grid's menu took it, or its read is still to come; R300: a letter as a key whose one action types it)
  if (grid) return grid.key(c, { id: "letter", row: 0, col: 0, span: 1, cls: "fn", label: { primary: ch }, actions: { primary: { kind: "type", text: ch } } }, "primary") !== false;
  if (sheet.level.filterable) sheet.level.type(sheet.id === "find" ? ch.toLowerCase() : ch);
  return true;
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
  const k = sheetJob(key, { kind: find ? "find" : store ? "store" : "other", filter: level.filterable, numbered: level.numbered, empty: level.filter === "", cas: c.casKeys, paste: pastes(sheet), of: sheet }, m, layer);
  if (store && k.kind !== "line" && layer === undefined) c.session.clearModifiers();
  if (sheet.helpCloses && k.kind === "back" && layer === undefined && isHelp(key, m, layer)) c.session.clearModifiers(); // R870: Shift + ⚙ uses its one-shot Shift up
  // in Find a one-shot Shift or Alpha is used up by the key it types (a lock stays, R889); elsewhere a sheet leaves it as it is
  if (find && ((c.session.shift && !c.session.shiftLock) || (c.session.alpha && !c.session.alphaLock))) c.session.clearModifiers();
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
    case "delete": {
      // R814 (Memory): the highlighted name goes as its swipe takes it (R813, with R314's Undo row); Clear all arms as Enter does;
      // any other row (Undo's) and an empty list are the dead press
      const row = level.current;
      if (row?.swipe) row.swipe();
      else if (row?.id === "clearall") shell.picked(sheet.enter());
      else c.dead();
      return true;
    }
    case "line":
      // R281: a key that types no name after ▶ (⌫ with nothing typed too, sheetKeys.ts storeKey): its job on the line.
      // R281f1: what was typed into the filter goes on the line first, one character at a time as typeLetter types it
      // (digits too), so the key meets the line it met before the sheet (x, Shift + space is x_)
      for (const ch of level.filter) c.entry.run({ kind: "type", text: ch });
      shell.closeSheet();
      return false;
    case "paste":
      // R900: the clipboard's name into the filter (Find's in lower case, as its letters type); no name, or the sheet gone meanwhile,
      // is the dead press and the sheet stays. The keys pressed while it reads wait for it (holdKeys), so Paste, Enter picks the name.
      c.withClip((x) =>
        holdKeys(c, x.readText().then((text) => {
          const name = text === null ? undefined : pastedName(text);
          if (name !== undefined && shell.sheet === sheet && sheet.level === level && level.type(find ? name.toLowerCase() : name)) return;
          if (text !== null) c.dead();
        })),
      );
      return true;
    case "copy": {
      // R815: the highlighted row's value (a name's full value, a constant's); Clear all, Undo's row, a function in Find and an empty list are the dead press
      const row = level.current;
      if (row?.copy) row.copy();
      else c.dead();
      return true;
    }
    case "help": {
      // R869: the highlighted row's help as a level over Find (the index and the help chunk load first; the keys pressed meanwhile
      // wait, holdKeys); no index item there, or the sheet changed meanwhile, is the dead press and Find stays
      const row = helpRow(sheet);
      if (!row) {
        c.dead();
        return true;
      }
      const still = (): boolean => shell.sheet === sheet && sheet.level === level && level.current === row;
      void holdKeys(c, import("../find/finder.ts").then(async (f) => {
        if (!(await f.showHelpFor(sheet, row, c.entry, still))) c.dead();
      }));
      return true;
    }
    case "none":
      c.dead(); // R770: a key the sheet does not use is dead (docs/05 3.7); the sheet stays
      return true;
    case "pass": {
      // read by what the key is, not by the layer: ☰, the place name and Tmpl toggle their sheet, a control that
      // changes place (a view tab, a user key that holds Home or CAS) closes it and goes there
      const p = key.actions.primary;
      if (p?.kind !== "special" || isSelect(p)) return true; // (R279: Select and Deselect act on the line only)
      if (p.name === "settings") {
        // R887: as the head's ⚙ (R145): Settings as the next level of the open sheet, on any level, so Esc goes back to it;
        // with Settings already open in the sheet there is nothing to open
        if (sheet.settingsOpen) c.dead();
        else settingsOnSheet(shell);
        return true;
      }
      if (p.name !== "menu" && p.name !== "apps" && p.name !== "slot" && p.name !== "tmpl") shell.closeSheet();
      special(c, p.name);
      return true;
    }
  }
}

/** R887: the ⚙ key over the open sheet: Settings as its next level on whatever level is open, as the head's ⚙ (R145), so Esc goes
 *  back to it. Before the Mode code is in it loads first (Shell.withModeCode); a sheet closed or changed meanwhile gets nothing. */
function settingsOnSheet(shell: RouteCtx["shell"]): void {
  const s = shell.sheet;
  const push = (): void => {
    if (s && shell.sheet === s && !s.settingsOpen) shell.picked(s.openSettings(shell.toSettings()));
  };
  if (shell.settingsMenu?.() || !shell.withModeCode) push();
  else shell.withModeCode(push);
}
