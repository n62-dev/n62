// SPDX-License-Identifier: GPL-3.0-or-later
// R31 (F27): the keys of a hardware keyboard (a desktop, a Bluetooth keyboard on the phone or the Tab One) take the
// keypad's path, so the line they leave parses as the same keys pressed on the keypad. Before, MathLive took them with
// its own rules: `1e-3` was 1·e − 3, `*` stayed a bare star, `\` started a LaTeX command and `|` swallowed the rest of
// the line.
// - Backspace and Delete are ⌫ and Del (R26b, F16); the arrows are the pad's keys (R45, F38).
// - One table, spec/keyboard.yaml `desktop:` (R131, keyboard/desktopKeys.ts), names the hardware key of every keypad
//   key and layer, and of the status line's controls and results mode; this handler acts on it.
// - A character a keypad key types runs that key (in that layer) through the shell, as a tap would: digits, `.`, `+`,
//   `-` (the − key: on an empty line it starts with Ans), `,`, space, and `=` `_` (Shift) and `#` `:` `;` (Alpha).
// - `*` is ×, `/` is ÷ (a stacked fraction in textbook entry), `^` is xʸ, `(` is the bracket pair ( ), `|` the absolute
//   value |x|, `{` the list braces { } and `[` the matrix [ ] (R131); `)` and a second `|` leave the pair they close.
// - `e` or `E` right after a number's digits (or its point) is the exponent key ᴇ.
// - `<`, `>`, `!` and `%` insert the Shift palettes' own symbols (Shift + 6, Shift + 9; `%` as `\%`, R131: a bare `%`
//   is a LaTeX comment).
// - Other letters stay name letters. A function's name is reached through Find (R4a), as on the phone.
// - Every other character (`\ ] } ' " $ & ? @ ~` and the backtick) does nothing: no key types it (a dead press, R107).
// - Alt + a letter (or a digit, F1 to F4, Home, End, Shift+Enter, …) presses the key or the action the table names;
//   Ctrl+Z is the Undo key, Ctrl+Y and Ctrl+Shift+Z the Redo key (R119; Cmd on a Mac): on an empty line Undo brings
//   back what Clear or Delete took first (R98), which MathLive's own undo never did.
// Loaded with MathLive (EntryController.load), outside the start chunk. The Ctrl, Alt and Meta combinations the table
// does not name stay with MathLive and the browser (copy, cut, select all); a paste, Ctrl+V included, is field.ts's
// paste listener (R114). AltGr characters count as typed.
import type { MathfieldElement } from "mathlive";
import { numberRunStart } from "./numberRun.ts";
import type { Layer } from "../keyboard/keyboard.ts";
import { chordOf, desktop } from "../keyboard/desktopKeys.ts";

/** What the entry line (EntryController) lets the handler do. */
export interface HwTarget {
  readonly field: MathfieldElement | undefined;
  /** R57: the decimal comma is on. */
  readonly decimalComma: boolean;
  /** A palette symbol typed on the hardware keyboard (`<`, `>`, `!`, `%`): `latex`, the Shift palettes' own insert. */
  onSymbol(latex: string, repeat: boolean): void;
  /** Press a keypad key in a layer, as a tap would (the shell's path: Ans first, one-line forms, open sheets). `repeat`
   *  is the event's KeyboardEvent.repeat: a held key's auto-repeat acts again but is no new press (docs/04 5.2). */
  onKey(id: string, layer: Layer, repeat: boolean): void;
  /** A typed letter, through the shell's checks (open sheet, picked row, apps) before it reaches the line. */
  onLetter(ch: string, repeat: boolean): void;
  /** A key that does nothing here (docs/05 3.7); it is a press all the same (R107). */
  onDead(repeat: boolean): void;
  /** A key the handler acts on itself (a `)` or `|` that leaves its pair): a press all the same (R107f1). */
  onPress(repeat: boolean): void;
  /** A control no keypad key holds (R131, spec/keyboard.yaml `desktop.actions`): the status line's Apps, the place
   *  switch, Symb, Plot, Num, and results mode's fold. */
  onAction(name: string, repeat: boolean): void;
}

/** The keypad key that each character types, and its layer: the table's one-character names that are no letter
 *  (letters go to onLetter, R45). */
const KEYS: ReadonlyMap<string, readonly [string, Layer]> = new Map(
  [...desktop.byName].flatMap(([name, t]) =>
    "key" in t && (name.length === 1 || name === "Space") && !/^[A-Za-z]$/.test(name) ? [[name === "Space" ? " " : name, [t.key, t.layer] as const]] : [],
  ),
);
/** R131's characters that the unit view's field does not take (units/open.ts: it keeps R24c's set). */
const LINE_ONLY = new Set(["{", "[", "|"]);
/** The arrow keys and the keypad keys they press (R45, controlKey). */
const ARROWS: Readonly<Record<string, string>> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
/** The Shift palettes' symbols typed by one ASCII character, and their inserts (spec/keyboard.yaml `relations` lt, gt;
 *  `symbols` fact, percent). */
const PALETTE: Readonly<Record<string, string>> = { "<": "<", ">": ">", "!": "!", "%": "\\%" };

/** The keypad key and layer a hardware control key presses (R45, F38): Backspace is ⌫, Delete is Shift + ⌫ (Del), the
 *  arrows are the pad's arrow keys, Enter is Enter and Escape is Esc. Shift + an arrow is none (MathLive's selection on
 *  the entry line), nor are Home and End. One map for the entry line and the unit view's field (R24c). */
export function controlKey(ev: Pick<KeyboardEvent, "key" | "shiftKey">): readonly [string, Layer] | undefined {
  const k = ev.key;
  if (k === "Backspace" || k === "Delete") return ["bksp", k === "Backspace" ? "primary" : "shift"];
  if (k === "Enter") return ["enter", "primary"];
  if (k === "Escape") return ["esc", "primary"];
  const arrow = ARROWS[k];
  return arrow && !ev.shiftKey ? [arrow, "primary"] : undefined;
}

/** R119: the keypad key that Ctrl+Z (Undo) or Ctrl+Y and Ctrl+Shift+Z (Redo, a key of its own since R146) press, on its
 *  tap layer (Cmd for Ctrl on a Mac); undefined for every other key. From the table (R131). */
export function undoKey(ev: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"> & { code?: string }): "undo" | "redo" | undefined {
  if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return undefined;
  const name = chordOf({ code: "", ...ev });
  const t = name === undefined ? undefined : desktop.byName.get(name);
  return t && "key" in t && t.layer === "primary" && (t.key === "undo" || t.key === "redo") ? t.key : undefined;
}

/** The keypad key (and its layer) that types `ch` (R24c: the unit view's field takes the same path). */
export function keypadKeyOf(ch: string, decimalComma: boolean): readonly [string, Layer] | undefined {
  return LINE_ONLY.has(ch) ? undefined : KEYS.get(decimalComma && ch === "," ? "." : ch);
}

/** Handle a keydown on the entry line. True: handled, and the caller stops the event. */
export function hardwareKey(ev: KeyboardEvent, tg: HwTarget): boolean {
  const ch = ev.key;
  const mf = tg.field;
  if (!mf || ev.isComposing) return false;
  const altGr = ev.getModifierState("AltGraph");
  if ((ev.ctrlKey || ev.metaKey || ev.altKey) && !altGr) {
    // R119, R131: a chord the table names presses its key (Ctrl+Z, Alt+S); every other one stays MathLive's (copy, select all)
    const name = chordOf(ev);
    const t = name === undefined ? undefined : desktop.byName.get(name);
    if (!t) return false;
    act(t, ev, tg);
    return true;
  }
  if (ch.length !== 1) {
    // a plain Enter or Escape: the controller's own listener (onEnter, onEscape) presses the same keys
    if ((ch === "Enter" || ch === "Escape") && !ev.shiftKey) return false;
    // R131: a named key the table holds (Backspace, Delete, the arrows, Home, End, F1 to F4, Shift+Enter); else R45's
    // (F38) controlKey (Shift + Backspace is ⌫ too); the rest (Shift + an arrow, Tab, Shift + Escape) stays as it was
    const t = desktop.byName.get(chordOf(ev) ?? "");
    const ctl = t || ch === "Enter" || ch === "Escape" ? undefined : controlKey(ev);
    if (t) act(t, ev, tg);
    else if (ctl) tg.onKey(ctl[0], ctl[1], ev.repeat);
    else return false;
    return true;
  }
  // a character outside ASCII (é, µ, π from a keyboard layout) is left to MathLive, as before
  if (ch < " " || ch > "~") return false;
  if ((ch === "e" || ch === "E") && afterNumber(mf)) {
    tg.onKey("emark", "primary", ev.repeat);
    return true;
  }
  if (ch === ")" || ch === "|") {
    if (leave(mf, ch === ")" ? "(" : "|")) {
      mf.focus();
      tg.onPress(ev.repeat);
    } else if (ch === "|") tg.onKey("neg", "shift", ev.repeat);
    else tg.onDead(ev.repeat);
    return true;
  }
  // R57: with the decimal comma both `.` and `,` type the decimal mark (the keypad's `.` key); `;` stays the separator
  const k = KEYS.get(tg.decimalComma && ch === "," ? "." : ch);
  const sym = PALETTE[ch];
  if (k) tg.onKey(k[0], k[1], ev.repeat);
  else if (sym !== undefined) tg.onSymbol(sym, ev.repeat);
  else if (/^[A-Za-z]$/.test(ch)) tg.onLetter(ch, ev.repeat);
  else tg.onDead(ev.repeat);
  return true;
}

/** Press what the table names: a keypad key in its layer, or an action. */
function act(t: import("../keyboard/desktopKeys.ts").DeskTarget, ev: KeyboardEvent, tg: HwTarget): void {
  if ("key" in t) tg.onKey(t.key, t.layer, ev.repeat);
  else tg.onAction(t.action, ev.repeat);
}

/** The cursor stands right after a number's digits or its point (not after a name such as x2). */
function afterNumber(mf: MathfieldElement): boolean {
  if (!mf.selectionIsCollapsed) return false;
  const p = mf.position;
  const d = mf.getElementInfo(p)?.depth ?? 0;
  const at = (o: number, re: RegExp): boolean =>
    o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d && re.test(mf.getElementInfo(o)?.latex ?? "");
  let k = numberRunStart(mf, p, d); // digits, a point or the decimal comma (R57)
  return k < p && !at(k, /^\p{L}$/u);
}

/** `)` or `|`: put the cursor after the innermost pair around it that this character closes. False: none. */
function leave(mf: MathfieldElement, open: "(" | "|"): boolean {
  const depthAt = (o: number): number => mf.getElementInfo(o)?.depth ?? 0;
  let pos = mf.position;
  let d = depthAt(pos);
  while (d > 0) {
    // the parent atom is the first one after the cursor that sits higher up (offsets list an atom's parts first)
    let o = pos + 1;
    while (o <= mf.lastOffset && depthAt(o) >= d) o++;
    if (o > mf.lastOffset) return false;
    if ((mf.getElementInfo(o)?.latex ?? "").startsWith(`\\left${open}`)) {
      mf.position = o;
      return true;
    }
    pos = o;
    d = depthAt(o);
  }
  return false;
}
