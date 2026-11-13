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
//   value |x|, `{` the list braces { } and `[` the matrix [ ] (R131); `)`, a second `|`, `}` and `]` leave the pair they
//   close (with no such pair, a dead press).
// - `e` or `E` right after a number's digits (or its point) is the exponent key ᴇ.
// - `<`, `>`, `!` and `%` insert the Shift palettes' own symbols (Shift + 6, Shift + 9; `%` as `\%`, R131: a bare `%`
//   is a LaTeX comment).
// - Other letters stay name letters. R198 (the owner, 2026-11-12; R31 had them stay letters): a function's name typed
//   before `(` becomes the function, as Find's pick of it puts it on the line (`sin(` is \sin with the cursor in its
//   bracket): a name of the parser's FUNCS, or of a function or template of Find's index (tier 1 too), which the first
//   letter loads (finder.ts loadIndex; until it is in, FUNCS alone). One letter (`f(`), pi and the user's own names stay
//   as before. The keypad's letters and ( ) key are untouched.
// - Every other character (`\ ' " $ & ? @ ~` and the backtick) does nothing: no key types it (a dead press, R107).
// - Alt + a letter (or a digit, F1 to F4, Home, End, Shift+Enter, …) presses the key or the action the table names;
//   Ctrl+Z is the Undo key, Ctrl+Y and Ctrl+Shift+Z the Redo key (R119; Cmd on a Mac): on an empty line Undo brings
//   back what Clear or Delete took first (R98), which MathLive's own undo never did.
// - Counting (R127, R131's removal test): a key the table adds (an Alt chord, Home, F1, Shift+Enter, `{`, `[`) goes to
//   onDesk with its desktop name, counted `hw:<name>`; the keys R31, R45 and R119 had before it keep onKey (`<key id>:hw`).
// Loaded with MathLive (EntryController.load), outside the start chunk; R198's names load on the first letter (askIndex).
// The Ctrl, Alt and Meta combinations the table does not name stay with MathLive and the browser (copy, cut, select
// all); a paste, Ctrl+V included, is field.ts's paste listener (R114). AltGr characters count as typed, and so do a Mac's Option characters that are ASCII punctuation
// (Option + 5 is `[` on a German Mac; R131f1, optionChar).
import type { MathfieldElement } from "mathlive";
import { numberRunStart } from "./numberRun.ts";
import { keyboard, type Key, type Layer, type Special } from "../keyboard/keyboard.ts";
import { chordOf, desktop, type DeskTarget } from "../keyboard/desktopKeys.ts";
import type { FindItem } from "../find/types.ts";

/** The desktop key map (R131), for the help text: it reaches it through this chunk, so the map stays in it and no
 *  dynamic import of hwkeys lists a chunk more. */
export { desktop };

/** What the entry line (EntryController) lets the handler do. */
export interface HwTarget {
  readonly field: MathfieldElement | undefined;
  /** R57: the decimal comma is on. */
  readonly decimalComma: boolean;
  /** R198: the user's names (session.userNames): typed before `(`, they stay the user's. */
  readonly stored?: readonly string[];
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
  /** R131: a desktop key the table adds, resolved here (this chunk), so the start chunk only presses it: `as`, its count
   *  name (`hw:<desktop name>`, apart from the keypad's taps); `key`, a keypad key pressed in `layer`, or a control no
   *  keypad key holds as a key (controlAsKey) (`desktop.actions`: the status line's Apps, the place switch, Symb, Plot,
   *  Num); no key: results mode's fold, which the shell folds or unfolds. */
  onDesk?(as: string, key: Key | undefined, layer: Layer | undefined, repeat: boolean): void;
}

/** The keypad key that each character types, and its layer: the table's one-character names that are no letter
 *  (letters go to onLetter, R45). */
const KEYS: ReadonlyMap<string, readonly [string, Layer]> = new Map(
  [...desktop.byName].flatMap(([name, t]) =>
    "key" in t && (name.length === 1 || name === "Space") && !/^[A-Za-z]$/.test(name) ? [[name === "Space" ? " " : name, [t.key, t.layer] as const]] : [],
  ),
);
/** R131's characters (onDesk). */
const DESK_CHARS = new Set(["{", "["]);
/** The keys the handler pressed before the table (R45, R119): still onKey, counted `<key id>:hw` as before. */
const BEFORE = new Set(["Ctrl+Z", "Ctrl+Y", "Ctrl+Shift+Z", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
/** The characters that the unit view's field does not take (units/open.ts: it keeps R24c's set). */
const LINE_ONLY = new Set([...DESK_CHARS, "|"]);
/** The pairs a closing character leaves (`leave`): the LaTeX its opening atom starts with. */
const CLOSES: Readonly<Record<string, RegExp>> = { ")": /^\\left\(/, "|": /^\\left\|/, "}": /^\\left\\\{/, "]": /^\\begin\{pmatrix\}/ };
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
  // field by field: a real KeyboardEvent keeps key, ctrlKey and the rest as getters on its prototype, which a spread skips
  const name = chordOf({ key: ev.key, code: ev.code ?? "", ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, altKey: ev.altKey, shiftKey: ev.shiftKey });
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
  if ((ev.ctrlKey || ev.metaKey || ev.altKey) && !altGr && !optionChar(ev)) {
    // R119, R131: a chord the table names presses its key (Ctrl+Z, Alt+S); every other one stays MathLive's (copy, select all)
    const name = chordOf(ev);
    const t = name === undefined ? undefined : desktop.byName.get(name);
    if (!t || name === undefined) return false;
    act(t, name, ev, tg);
    return true;
  }
  if (ch.length !== 1) {
    // a plain Enter or Escape: the field's own listener presses the same keys (EntryController: onKey, R45)
    if ((ch === "Enter" || ch === "Escape") && !ev.shiftKey) return false;
    // R131: a named key the table holds (Backspace, Delete, the arrows, Home, End, F1 to F4, Shift+Enter); else R45's
    // (F38) controlKey (Shift + Backspace is ⌫ too); the rest (Shift + an arrow, Tab, Shift + Escape) stays as it was
    const name = chordOf(ev) ?? "";
    const t = desktop.byName.get(name);
    const ctl = t || ch === "Enter" || ch === "Escape" ? undefined : controlKey(ev);
    if (t) act(t, name, ev, tg);
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
  const closes = CLOSES[ch];
  if (closes) {
    if (leave(mf, closes)) {
      mf.focus();
      tg.onPress(ev.repeat);
    } else if (ch === "|") tg.onKey("neg", "shift", ev.repeat);
    else tg.onDead(ev.repeat);
    return true;
  }
  // R57: with the decimal comma both `.` and `,` type the decimal mark (the keypad's `.` key); `;` stays the separator
  const k = KEYS.get(tg.decimalComma && ch === "," ? "." : ch);
  const sym = PALETTE[ch];
  const call = ch === "(" && tg.onDesk ? callKey(mf, tg) : undefined;
  if (call) tg.onDesk?.("hw:name", call, "primary", ev.repeat); // R198: counted apart from the ( ) key's `paren:hw`
  else if (k && DESK_CHARS.has(ch)) desk({ key: k[0], layer: k[1] }, ch, ev, tg);
  else if (k) tg.onKey(k[0], k[1], ev.repeat);
  else if (sym !== undefined) tg.onSymbol(sym, ev.repeat);
  else if (/^[A-Za-z]$/.test(ch)) {
    askIndex();
    tg.onLetter(ch, ev.repeat);
  } else tg.onDead(ev.repeat);
  return true;
}

/** R198: a name of one letter is a variable's or a user function's (`f(`); pi is π, which Giac's help lists as a function;
 *  R198f1: Giac's program words (do od fi si by in of) and its French operator words (et ou) are syntax, not functions
 *  (Find lists them at tier 1 for its own search; `at` stays the function). */
const NO_CALL = new Set(["pi", "Pi", "do", "od", "fi", "si", "by", "in", "of", "et", "ou"]);
/** R198f1: the names of FUNCS that MathLive has no command for (a typed `\lcm` is an error element, the history row then
 *  reads the raw text): they get Find's own insert (callsOf), not a command. Every other FUNCS name has its command
 *  (the e2e case in hwkeys.spec.ts types each one and looks for an error element). */
const NO_COMMAND = new Set(["lcm"]);
/** A name the hardware letters type as one run (nameBefore): letters, then digits. */
const TYPED = /^[A-Za-z]{2,}\d*$/;
/** R198: each typed name's insert: none until the parser's FUNCS is in, FUNCS until Find's index is. */
let calls: ReadonlyMap<string, string> = new Map();
let asked = false;

/** R198: the first hardware letter loads the names: the parser's function commands (input/parseTables.ts FUNCS, through
 *  parse.ts, the parser's own chunk: a chunk of the tables alone would join the start chunk's preload list) as calls, then
 *  Find's index (finder.ts loadIndex). A failed load is asked again by the next letter. */
function askIndex(): void {
  if (asked) return;
  asked = true;
  const funcs = import("../input/parse.ts").then((m) => new Map(Object.keys(m.FUNCS).filter((n) => !NO_COMMAND.has(n)).map((n) => [n, `\\${n}\\left(#0\\right)`])));
  void funcs.then((f) => void (calls.size || (calls = f)), () => {});
  const index = import("../find/finder.ts").then((m) => m.loadIndex());
  void Promise.all([funcs, index]).then(([f, ix]) => void (calls = callsOf(f, ix.items)), () => void (asked = false));
}

/** The typed names of Find's functions and templates: FUNCS first, then an item's own name (Giac's `and` for `and`, not
 *  bitand's alias), then the other names, tier 0 before tier 1. */
function callsOf(funcs: ReadonlyMap<string, string>, items: readonly FindItem[]): ReadonlyMap<string, string> {
  const m = new Map(funcs);
  const add = (name: string, insert: string): void => void (TYPED.test(name) && !NO_CALL.has(name) && !m.has(name) && m.set(name, insert));
  const fns = items.filter((it) => it.kind === "fn" || it.kind === "tmpl");
  for (const it of fns) add(it.id.slice(it.id.indexOf(":") + 1), it.insert);
  for (const tier of [0, 1]) for (const it of fns) if (it.tier === tier) for (const n of it.names) add(n, it.insert);
  return m;
}

/** R198: the name typed right before the cursor: a run of letters, then digits (`log10`), each an atom of its own at the
 *  cursor's depth; none with a selection or with no letter there. */
function nameBefore(mf: MathfieldElement): string | undefined {
  if (!mf.selectionIsCollapsed) return undefined;
  const d = mf.getElementInfo(mf.position)?.depth ?? 0;
  const at = (o: number): string => (o > 0 && (mf.getElementInfo(o)?.depth ?? 0) === d ? (mf.getElementInfo(o)?.latex ?? "") : "");
  let name = "";
  let k = mf.position;
  for (; /^\d$/.test(at(k)); k--) name = at(k) + name;
  const digits = name.length;
  for (; /^[A-Za-z]$/.test(at(k)); k--) name = at(k) + name;
  return name.length > digits ? name : undefined;
}

/** R198: the key a `(` presses after a typed function name: the ( ) key with the function's insert (field.ts puts it in
 *  place of the letters); none where the letters before the cursor name no function, or a name of the user's. */
function callKey(mf: MathfieldElement, tg: HwTarget): Key | undefined {
  const name = nameBefore(mf);
  const latex = name && !tg.stored?.includes(name) ? calls.get(name) : undefined;
  const key = keyboard.byId.get("paren");
  const paren = key?.actions.primary;
  if (!name || latex === undefined || !key || !paren) return undefined;
  return { ...key, actions: { primary: { kind: "insert", latex, call: { name, paren } } } };
}

/** R131f1: a Mac's Option is Alt with no AltGraph, so its characters (German Mac: Option + 5 is `[`, Option + L is `@`)
 *  would read as Alt chords. With Alt alone (no Ctrl, no Meta), a key that is one printable ASCII character, neither a
 *  letter nor a digit, is typed, as AltGr's characters are. Alt + Shift on a digit's place stays the chord (Windows and
 *  Linux give `!` for Alt + Shift + 1: the user key's Shift slot); Option's other characters (ß) stay chords by place. */
function optionChar(ev: KeyboardEvent): boolean {
  const k = ev.key;
  if (!ev.altKey || ev.ctrlKey || ev.metaKey || k.length !== 1 || k < " " || k > "~" || /^[A-Za-z0-9]$/.test(k)) return false;
  return !(ev.shiftKey && /^Digit\d$/.test(ev.code));
}

/** Press what the table names under `name`: a key R45 or R119 had before it as before (onKey), else through onDesk. */
function act(t: DeskTarget, name: string, ev: KeyboardEvent, tg: HwTarget): void {
  if ("key" in t && BEFORE.has(name)) tg.onKey(t.key, t.layer, ev.repeat);
  else desk(t, name, ev, tg);
}

/** A status-line control as a key (as StatusLine.svelte's statusKey): its press takes a key's path (an open sheet gives
 *  way, it runs at once while an app loads, and waits while a sheet's code loads). Built here, outside the start chunk. */
const controlAsKey = (name: Special): Key => ({ id: name, row: 0, col: 0, span: 1, cls: "nav", label: { primary: "" }, actions: { primary: { kind: "special", name } } });

/** R131: a table key through onDesk, counted `hw:<name>`: a keypad key in its layer, a status-line control as its tap
 *  (controlAsKey), or the fold (no key). */
function desk(t: DeskTarget, name: string, ev: KeyboardEvent, tg: HwTarget): void {
  const as = `hw:${name}`;
  if ("key" in t) {
    const key = keyboard.byId.get(t.key); // (the spec test holds every table key to a keypad key)
    if (key) tg.onDesk?.(as, key, t.layer, ev.repeat);
  } else tg.onDesk?.(as, t.action === "fold" ? undefined : controlAsKey(t.action as Special), "primary", ev.repeat);
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

/** `)`, `|`, `}` or `]`: put the cursor after the innermost pair around it whose LaTeX `open` matches (CLOSES). False:
 *  none. */
function leave(mf: MathfieldElement, open: RegExp): boolean {
  const depthAt = (o: number): number => mf.getElementInfo(o)?.depth ?? 0;
  let pos = mf.position;
  let d = depthAt(pos);
  while (d > 0) {
    // the parent atom is the first one after the cursor that sits higher up (offsets list an atom's parts first)
    let o = pos + 1;
    while (o <= mf.lastOffset && depthAt(o) >= d) o++;
    if (o > mf.lastOffset) return false;
    if (open.test(mf.getElementInfo(o)?.latex ?? "")) {
      mf.position = o;
      return true;
    }
    pos = o;
    d = depthAt(o);
  }
  return false;
}
