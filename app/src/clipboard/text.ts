// SPDX-License-Identifier: GPL-3.0-or-later
// What Copy puts on the clipboard (docs/04 section 2.6): the full value of a result, the shown text, the exact text,
// the LaTeX, a whole session and a Num table. Plain functions, no Svelte and no clipboard: the actions
// (actions.svelte.ts) pick the text and the port (port.ts) delivers it.
import {
  DECIMAL_KEEP,
  decimalFromRational,
  decimalFromString,
  isZero,
  roundSignificant,
  type ComplexValue,
  type DecimalValue,
  type Mark,
  type MarkInfo,
  type PrecisionWarn,
} from "../engine/format.ts";
import type { ChipTable } from "../input/chips.ts";
import { withUnit } from "../state/results.ts";
import { commaResult, markFor, modeOf, renderNumeric, type DisplayContext, type FmtMode, type FormStep, type Rational, type ResultFacts } from "../state/displayMode.ts";

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
  units?: { input?: unknown; text?: unknown; unit?: unknown; unc?: { text?: unknown }; latex?: unknown };
}

/** Text options: `decimalComma` writes `,` for the decimal point (the Settings option, docs/04 section 6.2). */
export interface TextOptions {
  decimalComma?: boolean;
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

/** `a+b*i` (a plain `i` for 1, `-i` for -1), each part as realText. */
export function complexText(v: ComplexValue, n: number, o: TextOptions = {}): string {
  const re = realText(v.re, n, o);
  if (isZero(v.im)) return re;
  const im = realText({ ...v.im, neg: false }, n, o);
  const ims = im === "1" ? "i" : `${im}*i`;
  const sign = v.im.neg ? "-" : "+";
  return isZero(v.re) ? `${v.im.neg ? "-" : ""}${ims}` : `${re}${sign}${ims}`;
}

/** How many significant digits of a result may be copied: all that were kept (40), or the confirmed ones. */
function copyDigits(i: CopySource): number {
  const r = i.facts?.reliableDigits;
  return r === null || r === undefined ? DECIMAL_KEEP : Math.max(1, Math.min(r, DECIMAL_KEEP));
}

/**
 * The default copy (the Copy key, docs/04 section 2.6): a number as every confirmed digit up to 40 with trailing
 * zeros dropped (an exact `1/3` as its 40 digits, an exact integer in full); anything else as the engine wrote it.
 * R269: a unit-view row adds its ` ± σ unit` (`39.488 ± 1.2 m²`) through withUnit, the writer of Copy as shown, so the
 * two agree on the unit part. undefined: nothing finished to copy.
 */
export function copyFull(i: CopySource, o: TextOptions = {}): string | undefined {
  const v = valueFull(i, o);
  return v === undefined || !i.units ? v : withUnit({ text: v, latex: "" }, i.units, o.decimalComma ? commaResult : undefined).text;
}

/** copyFull's number alone, without a unit row's ` ± σ unit`. */
function valueFull(i: CopySource, o: TextOptions): string | undefined {
  if (i.status !== "done") return undefined;
  if (i.drawn !== undefined) return o.decimalComma ? commaResult(i.drawn, false) : i.drawn; // R100: a list's elements by `;`
  const f = i.full;
  if (f !== undefined && /^-?\d+$/.test(f)) return f; // an exact integer, however long
  // A real the engine wrote as digits (CAS floats too): its confirmed digits, in the notation of docs/04 2.6.
  const dec = f !== undefined && !i.fullExact ? decimalFromString(f.replace("E", "e")) : null;
  if (dec) return realText(dec, copyDigits(i), o);
  // An exact fraction: its 40 digits rounded from the 41st (the value kept only 40, cut).
  if (i.rational && i.value && isZero(i.value.im)) {
    const q = decimalFromRational(BigInt(i.rational.n), BigInt(i.rational.d), DECIMAL_KEEP + 1);
    return realText(q, DECIMAL_KEEP, o);
  }
  if (i.value) return complexText(i.value, copyDigits(i), o);
  const rest = f ?? i.text;
  return o.decimalComma ? commaResult(rest, false) : rest; // (R57) a list or an expression the engine wrote
}

export { copyExact } from "./exact.ts";

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
import { whyLine } from "./whyLine.ts";
export { entryText };

/** A unit-view row's request, else the row's entry (LaTeX); and whether it is a unit row. R63f2: a unit row's latex is the
 *  plain line and its value is in the result's unit: the request as drawn, the value with its unit (copyFull); without
 *  the request the line is Home's, the number alone (never `2×π×25 ≈ 0.157 m`). */
function rowInput(i: CopySource): { input: string; unitRow: boolean } {
  const u = i.units;
  return u && typeof u.input === "string" && typeof u.text === "string" ? { input: u.input, unitRow: true } : { input: i.latex, unitRow: false };
}

/** The session as text: one line per finished entry, `input mark result` with the full value; an error line shows the message. */
export function sessionText(items: readonly CopySource[], o: TextOptions, ctx: DisplayContext): string {
  const lines: string[] = [];
  for (const i of items) {
    if (i.status === "done") {
      const { input, unitRow } = rowInput(i);
      const result = (unitRow ? copyFull(i, o) : undefined) ?? valueFull(i, o) ?? i.text;
      lines.push(`${entryText(input)} ${markText(copyMark(i, ctx))} ${result}`);
    } else if (i.status === "error") lines.push(`${entryText(i.latex)} → ${i.text}`);
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
 * unit and σ. An error row has its message in `value` and no mark. No comment line (it breaks a spreadsheet's import).
 * "" when there is no row to write. Quoting, separator (`;` with the decimal comma) and CRLF are tableCsv's.
 */
export function sessionCsv(items: readonly CopySource[], o: TextOptions, ctx: DisplayContext): string {
  const rows = exported(items).map((i): string[] => {
    if (i.status === "error") return [entryText(i.latex), i.text, "", "", ""];
    const { input } = rowInput(i);
    const sigma = str(i.units?.unc?.text);
    return [entryText(input), valueFull({ ...i, units: undefined }, o) ?? i.text, rowMark(i, ctx).mark, str(i.units?.unit), o.decimalComma ? sigma.replace(".", ",") : sigma];
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
 * result), the result as the screen draws it (its text when the row keeps no LaTeX; a unit row adds its σ and unit). An
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
    if (unitRow && typeof i.units?.latex === "string") result += `\\,${comma ? commaResult(i.units.latex, true) : i.units.latex}`;
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
