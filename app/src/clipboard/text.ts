// SPDX-License-Identifier: GPL-3.0-or-later
// What Copy puts on the clipboard (docs/04 section 2.6): the full value of a result, the shown text, the exact text,
// the LaTeX, a whole session and a Num table. Plain functions, no Svelte and no clipboard: the actions
// (actions.svelte.ts) pick the text and the port (port.ts) delivers it.
import {
  confirmedOptions,
  DECIMAL_KEEP,
  decimalFromString,
  digitsShown,
  isZero,
  itemsText,
  roundSignificant,
  ZERO_VALUE,
  type ComplexValue,
  type DecimalValue,
  type Mark,
  type MarkInfo,
  type PrecisionFacts,
  type PrecisionWarn,
} from "../engine/format.ts";
import { decimalFromRational } from "../engine/rational.ts";
import { defaultHomeSettings } from "../engine/homeDefaults.ts";
import { mapNames } from "../engine/giacPrintStart.ts";
import { isStandIn, typedName } from "../engine/standIns.ts";
import type { ChipTable } from "../input/chips.ts";
import { withUnit } from "../state/results.ts";
import { commaResult, drawnFormat, markFor, modeOf, renderNumeric, type DisplayContext, type DrawnSettings, type FmtMode, type FormStep, type Rational, type ResultFacts } from "../state/displayMode.ts";

/** The part of a history item that Copy reads (HistoryItem in state/session.svelte.ts has all of it). */
export interface CopySource {
  latex: string;
  status: string;
  /** The result as LaTeX, as the screen draws it (empty unless done); sessionLatex's result, else the value's text. */
  resultLatex?: string;
  /** The view the row was worked in: a Home row is always drawn through renderNumeric (Session.display). */
  view?: string;
  /** Plain text of the result (CAS: Giac's text or our formatter's) or of the error. */
  text: string;
  value?: ComplexValue;
  rational?: Rational;
  /** The exact text, or every confirmed digit (the `\res` chip value). */
  full?: string;
  fullExact?: boolean;
  /** G46f1: the text drawn when it differs from `full` (DEG: `full` is the radian text); Copy gives it. */
  drawn?: string;
  /** The value's facts, whole (G86; a history item's own): `reliableDigits` the digits confirmed by the agreement check
   *  (null = nothing in doubt), `warn`, `exact`. Absent: nothing in doubt, not claimed exact. */
  facts?: ResultFacts;
  /** An inexact chip went into the input: never `=` (decisions M4-4). */
  inexactInput?: boolean;
  /** The item's display settings (Format key): the mode and the a b/c form the screen draws it in. */
  fmt?: FmtMode;
  form?: FormStep;
  chips?: ChipTable;
  /** R63f2: a unit-view row (units/row.ts UnitRow, read back unchecked): `input` the request as drawn (unit after each
   *  number, → the end unit), `text` the ` ± σ unit` after the value. Both strings, else the row is exported as Home's. */
  units?: { input?: unknown; text?: unknown; unit?: unknown; unc?: { text?: unknown }; latex?: unknown; why?: unknown };
}

/** Text options: `decimalComma` writes `,` for the decimal point (the Settings option, docs/04 section 6.2); `display` the
 *  settings the rows are drawn with (G796f1: a row nobody checked copies the digits it draws in its mode, modeOf of its
 *  `fmt` and `form`; absent: STD with the default digits, 12); `kept` (the
 *  session format, state/sessionLine.ts) a warned row's value too with every digit within its count, as the chips matched
 *  against it hold it (Copy as Python's links, G213; the line carries the warning and the count itself). */
export interface TextOptions {
  decimalComma?: boolean;
  display?: DrawnSettings;
  kept?: boolean;
}

/** Plain notation from 1E-4 up to (not including) 1E21, else `d.ddd…E±k` (docs/04 section 2.6). */
const PLAIN_LOW = -4;
const PLAIN_HIGH = 21;

/** v rounded to n significant digits, trailing zeros dropped, `.` as the point; `0` for zero. */
export function realText(v: DecimalValue, n: number, o: TextOptions = {}): string {
  if (isZero(v)) return "0";
  const r = roundSignificant(v, Math.max(1, Math.min(n, DECIMAL_KEEP)));
  const d = r.digits.replace(/0+$/, "");
  const e = r.exp;
  let body: string;
  if (e >= PLAIN_LOW && e < PLAIN_HIGH) {
    if (e < 0) body = `0.${"0".repeat(-e - 1)}${d}`;
    else if (d.length <= e + 1) body = d + "0".repeat(e + 1 - d.length);
    else body = `${d.slice(0, e + 1)}.${d.slice(e + 1)}`;
  } else {
    body = `${d.length > 1 ? `${d[0]}.${d.slice(1)}` : d}E${e}`;
  }
  if (o.decimalComma) body = body.replace(".", ",");
  return r.neg ? `-${body}` : body;
}

/** `a+b*i` (a plain `i` for 1, `-i` for -1), each part as realText (the imaginary one to `nIm` digits). */
export function complexText(v: ComplexValue, n: number, o: TextOptions = {}, nIm = n): string {
  const re = realText(v.re, n, o);
  if (isZero(v.im)) return re;
  const im = realText({ ...v.im, neg: false }, nIm, o);
  const ims = im === "1" ? "i" : `${im}*i`;
  const sign = v.im.neg ? "-" : "+";
  return isZero(v.re) ? `${v.im.neg ? "-" : ""}${ims}` : `${re}${sign}${ims}`;
}

/** G796: a row nobody checked (a bare ⚠) is copied to its shown digits, except in the session format (`kept`). */
const cutToShown = (i: CopySource, o: TextOptions): boolean => i.facts?.warn !== undefined && !o.kept;

const STD_DEFAULT: DrawnSettings = { format: "std", digits: defaultHomeSettings.digits };

/** How many significant digits of a value may be copied: all that were kept (40), or the confirmed ones (`r`). */
function copyDigits(r: number | null | undefined): number {
  return r === null || r === undefined ? DECIMAL_KEEP : Math.max(1, Math.min(r, DECIMAL_KEEP));
}

/** G796f1: the significant digits each part of `v` is drawn with, as markFor counts them: the row's mode (modeOf) on its
 *  base notation, the input's digits or the setting, FIX's decimals, only confirmed digits (confirmedOptions). */
function drawnDigits(i: CopySource, o: TextOptions, v: ComplexValue, r: number | null | undefined): { re: number; im: number } {
  const d = o.display ?? STD_DEFAULT;
  const f = confirmedOptions(v, r ?? null, drawnFormat(i, modeOf(i, d), d));
  return { re: digitsShown(v.re, f), im: digitsShown(v.im, f) };
}

/** A value with its confirmed digits up to 40 (`r`); G796: on a row nobody checked (a bare ⚠, `facts.warn`) no more than
 *  each part draws (drawnDigits), whatever its agreement count (fsolve's is 13). Written as complexText. */
function valueText(i: CopySource, o: TextOptions, v: ComplexValue, r = i.facts?.reliableDigits): string {
  const n = copyDigits(r);
  if (!cutToShown(i, o)) return complexText(v, n, o);
  const s = drawnDigits(i, o, v, r);
  return complexText(v, Math.min(n, s.re), o, Math.min(n, s.im));
}

/** G796: a warned list or matrix as its full text with each element as valueText; undefined: not one, or an element
 *  without a value (then the engine's text, as before). `.` here: engineText applies the decimal comma to the whole. */
function warnedItems(i: CopySource, o: TextOptions): string | undefined {
  const f = i.facts;
  if (!f?.items || !cutToShown(i, o)) return undefined;
  const point = { ...o, decimalComma: false };
  return itemsText(f, (it: PrecisionFacts) => (it.value ? valueText(i, point, it.value, it.reliableDigits) : null)) ?? undefined;
}

/**
 * The default copy (the Copy key, docs/04 section 2.6): a number as every confirmed digit up to 40 with trailing
 * zeros dropped (an exact `1/3` as its 40 digits, an exact integer in full); anything else as the engine wrote it.
 * R269: a unit-view row adds its ` ± σ unit` (`39.488 ± 1.2 m²`) through withUnit, the writer of Copy as shown, so the
 * two agree on the unit part. undefined: nothing finished to copy.
 */
export function copyFull(i: CopySource, o: TextOptions = {}, seen?: NameSeen): string | undefined {
  const v = valueFull(i, o, seen);
  return v === undefined || !i.units ? v : withUnit({ text: v, latex: "" }, i.units, o.decimalComma ? commaResult : undefined).text;
}

/** G784f1: set by the copy writers when they turned a stand-in into its letter, so the text holds a name (Paste refuses it). */
export interface NameSeen {
  name: boolean;
}

/** G784: Giac's print with the parser's stand-ins (`i_`, `beta_`, `Pi_`, …; engine/standIns.ts) as the letters the screen
 *  draws (`i`, `β`, `Π`; typedName); any other name, and every string, as it is. `named` (G784f1): a stand-in was turned. */
export function copyNames(text: string): { text: string; named: boolean } {
  let named = false;
  const out = mapNames(text, (n) => (isStandIn(n.name) ? ((named = true), typedName(n.name)) : null), "printed");
  return { text: out, named };
}

/** copyNames' text, `seen.name` set when it turned a stand-in. */
function lettersOf(t: string, seen: NameSeen | undefined): string {
  const r = copyNames(t);
  if (r.named && seen) seen.name = true;
  return r.text;
}

/** An engine text as Copy writes it: the letters for the stand-ins, then `;` between a list's elements with the decimal comma (R100).
 *  A row read back from storage without its text (not a string) is passed on as it is, as before G784. */
function engineText(t: string, o: TextOptions, seen?: NameSeen): string {
  if (typeof t !== "string") return t;
  return o.decimalComma ? commaResult(lettersOf(t, seen), false) : lettersOf(t, seen);
}

/** Copy as shown (docs/04 2.6): the row's display text without its mark, the stand-ins as their letters (G784). */
export function copyShownText(shown: string, seen?: NameSeen): string {
  return lettersOf(withoutMark(shown), seen);
}

/** Copy exact: Giac's exact text (exact.ts), the stand-ins as their letters (G784), `;` in a list with the decimal comma. */
export function copyExactText(i: CopySource, o: TextOptions = {}, seen?: NameSeen): string | undefined {
  const exact = copyExact(i);
  return exact === undefined ? undefined : engineText(exact, o, seen);
}

/** copyFull's number alone, without a unit row's ` ± σ unit`. */
function valueFull(i: CopySource, o: TextOptions, seen?: NameSeen): string | undefined {
  if (i.status !== "done") return undefined;
  if (i.drawn !== undefined) return engineText(i.drawn, o, seen); // R100: a list's elements by `;`
  const f = i.full;
  if (f !== undefined && /^-?\d+$/.test(f)) return f; // an exact integer, however long
  // A real the engine wrote as digits (CAS floats too): its confirmed digits, in the notation of docs/04 2.6.
  const dec = f !== undefined && !i.fullExact ? decimalFromString(f.replace("E", "e")) : null;
  // G796: a warned row is cut from its kept value, never from `full` already rounded to its count (13 → 12 would round twice)
  if (dec) return valueText(i, o, cutToShown(i, o) && i.value && isZero(i.value.im) ? i.value : { re: dec, im: ZERO_VALUE });
  // An exact fraction: its 40 digits rounded from the 41st (the value kept only 40, cut).
  if (i.rational && i.value && isZero(i.value.im)) {
    const q = decimalFromRational(BigInt(i.rational.n), BigInt(i.rational.d), DECIMAL_KEEP + 1);
    return realText(q, DECIMAL_KEEP, o);
  }
  if (i.value) return valueText(i, o, i.value);
  return engineText(warnedItems(i, o) ?? f ?? i.text, o, seen); // (R57) a list or an expression the engine wrote
}

import { copyExact } from "./exact.ts";
export { copyExact };

/** A mark glyph (and a count) that R3's display may put before the shown text; Copy as shown leaves it out. */
const LEADING_MARK = /^(?:[=≈]|⚠(?:\s*\d+(?=\s))?)\s*/;
export function withoutMark(shown: string): string {
  return shown.replace(LEADING_MARK, "");
}

/**
 * The mark of a copied result: the one the screen shows (R69), `markFor` of the item's facts. `ctx` is the display
 * settings (the session's), required: the item's own mode is read against its global format. undefined: not a number.
 */
export function copyMark(i: CopySource, ctx: DisplayContext): { mark: Mark; n?: number; warn?: PrecisionWarn } | undefined {
  if (i.status !== "done" || !i.value) return undefined;
  // copyFull writes a decimal, so a fraction form is marked as the decimal it writes (R69f1)
  const mode = modeOf(i, ctx);
  const m = markFor(i, mode === "frac" || mode === "mixed" ? (i.fmt && i.fmt !== "frac" && i.fmt !== "mixed" ? i.fmt : ctx.format) : mode, ctx);
  return m ?? undefined;
}

const markText = (m: ReturnType<typeof copyMark>): string => (m === undefined ? "=" : m.mark === "⚠" && m.n !== undefined && !m.warn ? `⚠ ${m.n}` : m.mark);

import { entryText, exportLatex } from "./plaintext.ts";
import { rowSigma, sigmaLatex } from "./rowSigma.ts";
import { whyLine } from "./whyLine.ts";
export { entryText };

/** A unit-view row's request, else the row's entry (LaTeX); and whether it is a unit row. R63f2: a unit row's latex is the
 *  plain line and its value is in the result's unit: the request as drawn, the value with its unit (copyFull); without
 *  the request the line is Home's, the number alone (never `2×π×25 ≈ 0.157 m`). */
function rowInput(i: CopySource): { input: string; unitRow: boolean } {
  const u = i.units;
  return u && typeof u.input === "string" && typeof u.text === "string" ? { input: u.input, unitRow: true } : { input: i.latex, unitRow: false };
}

/** σ of a row drawn as Home's (no unit row): the facts' σ (G400), never a unit row's σ without its unit. */
const homeSigma = (i: CopySource, ctx: DisplayContext, comma: boolean): string | null => rowSigma({ facts: i.facts }, modeOf(i, ctx) ?? ctx.format, comma);

/** The session as text: one line per finished entry, `input mark result` with the full value and its ` ± σ` (a unit row's
 *  through copyFull, else the facts', G400); an error line shows the message. */
export function sessionText(items: readonly CopySource[], o: TextOptions, ctx: DisplayContext): string {
  const lines: string[] = [];
  for (const i of items) {
    if (i.status === "done") {
      const { input, unitRow } = rowInput(i);
      const sigma = unitRow ? null : homeSigma(i, ctx, !!o.decimalComma);
      const result = ((unitRow ? copyFull(i, o) : undefined) ?? valueFull(i, o) ?? i.text) + (sigma === null ? "" : ` ± ${sigma}`);
      lines.push(`${entryText(input, o)} ${markText(copyMark(i, ctx))} ${result}`);
    } else if (i.status === "error") lines.push(`${entryText(i.latex, o)} → ${i.text}`);
  }
  return lines.join("\n");
}

/** The glyph of a finished row's mark: Copy's for a number (copyMark), else the facts' (a float in a CAS result), else
 *  `≈` when an inexact chip went in, `=` for the rest; the same rule as the session line (state/sessionLine.ts). */
function rowMark(i: CopySource, ctx: DisplayContext, asDrawn = false): { mark: Mark; info?: MarkInfo } {
  // asDrawn (LaTeX): the result is the screen's form, so the mark is the screen's too (an a b/c fraction is exact: `=`)
  const m = i.value && !asDrawn ? copyMark(i, ctx) : markFor(i, modeOf(i, ctx), ctx);
  if (m) return { mark: m.mark, info: m };
  return { mark: i.inexactInput ? "≈" : "=" };
}

/** The rows an export writes: finished entries and errors; pending rows and notes are no results. */
const exported = (items: readonly CopySource[]): CopySource[] => items.filter((i) => i.status === "done" || i.status === "error");

const str = (x: unknown): string => (typeof x === "string" ? x : "");

/**
 * G232: the history as CSV (a preview in v0.1.0). The header `input,value,mark,unit,sigma`, then one row per finished
 * entry: the entry as text, the full value (every confirmed digit, as Copy writes it) alone, the mark glyph, a unit row's
 * unit, and σ (rowSigma: a unit row's, else a Home row's σ line, G400). An error row has its message in `value` and no mark. No comment line (it breaks a spreadsheet's import).
 * "" when there is no row to write. Quoting, separator (`;` with the decimal comma) and CRLF are tableCsv's.
 */
export function sessionCsv(items: readonly CopySource[], o: TextOptions, ctx: DisplayContext): string {
  const rows = exported(items).map((i): string[] => {
    if (i.status === "error") return [entryText(i.latex, o), i.text, "", "", ""];
    const { input } = rowInput(i);
    const sigma = rowSigma(i, modeOf(i, ctx) ?? ctx.format, !!o.decimalComma) ?? "";
    return [entryText(input, o), valueFull({ ...i, units: undefined }, o) ?? i.text, rowMark(i, ctx).mark, str(i.units?.unit), sigma];
  });
  return rows.length ? tableCsv(["input", "value", "mark", "unit", "sigma"], rows, o) : "";
}

/** Text inside `\text{}`: the characters LaTeX reads as commands escaped. */
function latexText(s: string): string {
  return s.replace(/[\\&%$#_{}~^]/g, (c) => (c === "\\" ? "\\textbackslash{}" : c === "~" ? "\\textasciitilde{}" : c === "^" ? "\\textasciicircum{}" : `\\${c}`));
}

/** Session.display draws the row through renderNumeric (not as the engine wrote it). */
const drawnShown = (i: CopySource): boolean => i.view === "home" || i.fmt !== undefined || i.form !== undefined || i.facts !== undefined;

/** The result of a row as LaTeX the way Session.display draws it: a Home row, or one with a Format-key mode, form or facts,
 *  through renderNumeric in the row's mode (so a b/c, the digits and the decimal comma follow the screen); else the
 *  engine's LaTeX (or the value's text) with the decimal comma applied. A unit row's σ and unit are added by the caller. */
function drawnLatex(i: CopySource, o: TextOptions, ctx: DisplayContext): string {
  const r = drawnShown(i) ? renderNumeric(i, modeOf(i, ctx), ctx) : undefined; // renderNumeric applies ctx.decimalComma itself
  if (r) return r.latex;
  const plain = i.resultLatex || valueFull({ ...i, units: undefined }, { ...o, decimalComma: false }) || i.text;
  return o.decimalComma || ctx.decimalComma ? commaResult(plain, true) : plain;
}

/**
 * G232: the history as LaTeX (a preview in v0.1.0; the first line says so, `version` is the app's). One `align*` line per
 * finished entry: the entry's LaTeX, the mark as the relation (`=`, `\approx`, `\triangle` for ⚠ with the reason after the
 * result), the result as the screen draws it (its text when the row keeps no LaTeX; a unit row adds its σ and unit, a Home row its
 * `\pm` σ, G400). An
 * error row has `\rightarrow` and its message. "" when there is no row to write.
 */
export function sessionLatex(items: readonly CopySource[], o: TextOptions, ctx: DisplayContext, version: string): string {
  const comma = !!(o.decimalComma || ctx.decimalComma);
  const lines = exported(items).map((i) => {
    if (i.status === "error") return `\\begin{align*}${exportLatex(i.latex)} &\\rightarrow \\text{${latexText(i.text)}}\\end{align*}`;
    const { input, unitRow } = rowInput(i);
    const { mark, info } = rowMark(i, ctx, drawnShown(i));
    const rel = mark === "=" ? "=" : mark === "≈" ? "\\approx" : "\\mathrel{\\triangle}";
    let result = drawnLatex(i, o, ctx);
    // R886: σ's ⚠ as the file's ⚠ relation (\triangle), not a glyph LaTeX has no font for
    const ul = typeof i.units?.latex === "string" ? i.units.latex.replace(/⚠/g, "\\triangle ") : undefined;
    if (unitRow && ul !== undefined) result += `\\,${comma ? commaResult(ul, true) : ul}`;
    const sigma = unitRow ? null : homeSigma(i, ctx, comma);
    if (sigma !== null) result += `\\,\\pm${sigmaLatex(sigma)}`;
    const why = mark === "⚠" && info ? whyLine(i, info, ctx.digits) : null;
    const reason = why ? `\\quad\\text{(${latexText(why.replace(/^⚠\s*/, "").replace(/ · /g, "; "))})}` : "";
    return `\\begin{align*}${exportLatex(`${input} &${rel} ${result}`)}${reason}\\end{align*}`;
  });
  return lines.length ? [`% N62 ${version} · preview: the form of this file can change`, ...lines].join("\n") + "\n" : "";
}

/** One CSV field: quoted when it holds the separator, a quote or a line break. */
function csvField(s: string, sep: string): string {
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * A table as CSV (docs/04 section 2.6): a header row, then the rows; the separator is `,`, or `;` with the decimal
 * comma. Lines end with CRLF (RFC 4180), which spreadsheets and scripts both read.
 */
export function tableCsv(header: readonly string[], rows: readonly (readonly string[])[], o: TextOptions = {}): string {
  const sep = o.decimalComma ? ";" : ",";
  return [header, ...rows].map((r) => r.map((c) => csvField(c, sep)).join(sep)).join("\r\n") + "\r\n";
}
