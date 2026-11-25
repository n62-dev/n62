// SPDX-License-Identifier: GPL-3.0-or-later
// G799: the view sweep's two checks on what a row says about itself (a family test, owner-style hunt 2026-11-23: CAS drew float lists
// unmarked where Home marked them, G794; Copy of an unchecked row gave more digits than it showed, G796). Pure: a row is what the
// history keeps of an engine result (state/resultItem.ts homeItem, casItem), its mark is the screen's (Session.mark: markFor), its
// copy Copy's (clipboard/text.ts copyFull) and Paste's reading of it (clipboard/paste.ts), so a test feeds it fixed rows.
//   Marks agree: Home and CAS of the same input carry the same kind of mark: `=` / none for exact, `≈` for a float, `⚠` for a warned
//     value (docs/04 2.4, 2.9). A float drawn with no mark fails on either side; CAS keeping an exact value Home draws as a decimal
//     agrees. Both are asked the same text (`approx(…)` of it too, Shift+Enter in CAS): Giac's `approx(0)` is ⚠ unchecked in both.
//   Copy keeps its word (docs/04 2.6): Copy writes no digit past the confirmed count, nor, on a row nobody checked (a bare ⚠), past the
//     digits shown; an exact row's copy reads back through Paste to the same value (to its 40th digit). A row with no digit confirmed
//     (⚠ 0) copies nothing (the Copy action refuses it), so it is not judged.
import { DECIMAL_KEEP, decimalFromString, isZero, type DecimalValue, type MarkInfo } from "../../../app/src/engine/format.ts";
import { EMARK } from "../../../app/src/entry/macros.ts";
import { copyFull, type CopySource } from "../../../app/src/clipboard/text.ts";
import { parsePastedNumber } from "../../../app/src/clipboard/paste.ts";
import { markFor, markText, noDigit, renderNumeric, type DisplayContext } from "../../../app/src/state/displayMode.ts";
import { casItem, homeItem } from "../../../app/src/state/resultItem.ts";
import type { CasIn, HomeIn } from "../../../app/src/state/results.ts";

/** A finished history row as Copy and the screen read it. */
export type Row = CopySource & { view: "home" | "cas" };

/** The row Home's history keeps of a result; null for an error (nothing to mark or copy). */
export function homeRow(r: HomeIn): Row | null {
  return r.ok ? { ...homeItem(r, false), view: "home", status: "done", latex: "", text: r.display } : null;
}

/** The row CAS's history keeps of a result; null for an error. */
export function casRow(r: CasIn): Row | null {
  return r.ok ? { ...casItem(r, false), view: "cas", status: "done", latex: "", text: r.text } : null;
}

/** The text the screen draws for a row (Session.display, no unit row): our formatter for a Home row and a row with facts, else the engine's text. */
export function drawnText(row: Row, ctx: DisplayContext): string {
  const formatted = row.view === "home" || row.facts !== undefined ? renderNumeric(row, undefined, ctx) : undefined;
  return formatted?.text ?? row.text;
}

/** The mark the screen draws (Session.mark; no Format key, no a b/c form). */
export const markOfRow = (row: Row, ctx: DisplayContext): MarkInfo | null => markFor(row, undefined, ctx);

/** Digits with a point or an exponent: a float as drawn (a CAS row's typed decimals are exact rationals, P9). */
const FLOAT_TEXT = /\d\.\d|\d[eE][+-]?\d/;

export type MarkKind = "exact" | "float" | "warn" | "unmarked" | "other";

/** What a row's mark says: `exact` (`=`, or a CAS number with no mark: CAS keeps it exact), `float` (≈), `warn` (⚠), `unmarked` (a
 *  float drawn with no mark: never right), `other` (no number: an exact symbolic CAS result, a string). */
export function markKind(row: Row, ctx: DisplayContext): MarkKind {
  const m = markOfRow(row, ctx);
  if (m) return m.mark === "=" ? "exact" : m.mark === "≈" ? "float" : "warn";
  if (FLOAT_TEXT.test(drawnText(row, ctx)) && !row.text.includes('"')) return "unmarked";
  return row.value ? "exact" : "other";
}

const said = (row: Row, ctx: DisplayContext): string => {
  const m = markOfRow(row, ctx);
  return `${m ? markText(m) : "no mark"} ${drawnText(row, ctx)}`;
};

/** Null when Home's and CAS's marks of the same input agree; else what differs. A side with no number is not compared, except that a
 *  float with no mark fails. */
export function compareMarks(home: Row, cas: Row, ctx: DisplayContext): string | null {
  const h = markKind(home, ctx);
  const c = markKind(cas, ctx);
  if (c === "unmarked") return `CAS draws a float with no mark: ${drawnText(cas, ctx)} (Home ${said(home, ctx)})`;
  if (h === "unmarked") return `Home draws a float with no mark: ${drawnText(home, ctx)} (CAS ${said(cas, ctx)})`;
  if (h === "other" || c === "other" || h === c || c === "exact") return null;
  return `Home ${said(home, ctx)} against CAS ${said(cas, ctx)}`;
}

/** The significant digits of one number as Copy writes it (`-1.25E-7` → 3, `1200` → 2, `0.0012` → 2). */
export function significantDigits(s: string): number {
  const mant = s.replace(/^[-+]/, "").replace(/[eE][-+]?\d+$/, "");
  const all = mant.replace(".", "").replace(/^0+/, "");
  return (mant.includes(".") ? all : all.replace(/0+$/, "")).length;
}

/** The numbers of a copied text, by element: a list's or matrix's elements in order (a complex element has two). */
function elementsOf(text: string): string[][] {
  const inner = text.replace(/[[\]{}]/g, "");
  return inner.split(",").map((e) => e.match(/\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|\.\d+/g) ?? []);
}

/** The digits Copy may write of a value with these facts: on a row nobody checked (a bare ⚠: the mark claims no digit, whatever the
 *  agreement count says; fsolve's row has 13) the shown digits; else its confirmed count, or no bound when nothing is in doubt. */
function copyBound(reliable: number | null | undefined, unchecked: boolean, shown: number): number | null {
  if (unchecked) return shown;
  return reliable !== null && reliable !== undefined ? Math.max(1, reliable) : null;
}

/** An exact rational n/d (d > 0) as BigInts. */
interface Frac {
  n: bigint;
  d: bigint;
}

const fracOfDecimal = (v: DecimalValue): Frac => {
  if (v.digits === "") return { n: 0n, d: 1n };
  const k = v.exp + 1 - v.digits.length;
  const n = BigInt(v.digits) * (k > 0 ? 10n ** BigInt(k) : 1n);
  return { n: v.neg ? -n : n, d: k < 0 ? 10n ** BigInt(-k) : 1n };
};

/** The real Paste puts on the entry line (`-1.5\emark-3`), as a decimal; null for anything else (a complex number, a list). */
function pastedReal(latex: string): DecimalValue | null {
  const t = latex.replace(EMARK, "e");
  return /^-?[\d.]+(?:e-?\d+)?$/.test(t) ? decimalFromString(t, 10_000) : null;
}

/** True when `got` is `want` to its 40th significant digit (half a unit there); an integer or zero exactly. */
function sameTo40(got: Frac, want: Frac, exp: number): boolean {
  const err = got.n * want.d - want.n * got.d;
  const e = err < 0n ? -err : err;
  // zero and an integer are copied whole (copyFull: an exact integer however long)
  if (want.n === 0n || want.d === 1n) return e === 0n;
  // |err| / (got.d·want.d) ≤ ½ · 10^(exp − 39), exp the decimal exponent of the value's first digit
  const k = exp - (DECIMAL_KEEP - 1);
  const lhs = 2n * e * (k < 0 ? 10n ** BigInt(-k) : 1n);
  const rhs = got.d * want.d * (k > 0 ? 10n ** BigInt(k) : 1n);
  return lhs <= rhs;
}

/** The exact value of an exact row: its rational, else its value when nothing was cut from it. */
function exactOf(row: Row): { frac: Frac; exp: number } | null {
  const v = row.value;
  if (!v || !isZero(v.im)) return null;
  if (row.rational) return { frac: { n: BigInt(row.rational.n), d: BigInt(row.rational.d) }, exp: v.re.exp };
  return v.re.sticky ? null : { frac: fracOfDecimal(v.re), exp: v.re.exp };
}

/**
 * Null when the text Copy wrote of a row keeps its word; else what it broke. `copied` is copyFull's text (undefined: nothing to
 * copy). A number's digits are bounded by its confirmed count, or by the digits shown when nobody checked it; a list's or matrix's
 * elements each by their own facts (a warning sits on the whole list). An exact real reads back through Paste to the same value.
 */
export function judgeCopy(row: Row, copied: string | undefined, ctx: DisplayContext): string | null {
  const m = markOfRow(row, ctx);
  if (copied === undefined || noDigit(m)) return null;
  const f = row.facts;
  const shown = f?.digits ?? ctx.digits;
  const unchecked = m?.mark === "⚠" && (m.warn !== undefined || m.n === undefined);
  const items = f?.items;
  if (row.value || items) {
    const els = elementsOf(copied);
    const counts = row.value ? [f?.reliableDigits] : items!.map((it) => it.reliableDigits);
    if (row.value || els.length === counts.length) {
      for (const [k, nums] of (row.value ? [els.flat()] : els).entries()) {
        const count = counts[k];
        const b = copyBound(count, unchecked, shown);
        const over = b === null ? undefined : nums.find((x) => significantDigits(x) > b);
        if (over !== undefined)
          return `Copy writes ${significantDigits(over)} digits of ${over} where ${unchecked ? `${b} are shown and none is confirmed` : `${b} are confirmed`} (${m ? markText(m) : "no mark"} ${drawnText(row, ctx)}; copied ${copied})`;
      }
    }
  }
  const kind = markKind(row, ctx);
  const exact = kind === "exact" ? exactOf(row) : null;
  if (exact) {
    const p = parsePastedNumber(copied);
    if (!p) return `Paste refuses the copy ${copied} of the exact ${drawnText(row, ctx)}`;
    const back = pastedReal(p.latex);
    if (!back) return `Paste reads the copy ${copied} of the exact ${drawnText(row, ctx)} as ${p.latex}, not a real number`;
    if (!sameTo40(fracOfDecimal(back), exact.frac, exact.exp)) return `Paste reads the copy ${copied} back as another value than the exact ${row.rational ? `${row.rational.n}/${row.rational.d}` : drawnText(row, ctx)}`;
  }
  return null;
}

/** judgeCopy of what Copy writes of the row now (copyFull). */
export const copyCheck = (row: Row, ctx: DisplayContext): string | null => judgeCopy(row, copyFull(row), ctx);
