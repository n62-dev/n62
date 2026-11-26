// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key and the a b/c key on the last result (R10, Session.cycleFormat and cycleForm). Out of the start
// chunk (R135: its room was spent): main.ts fetches it when idle, the first press waits for it otherwise. The choice of
// the next mode and form (nextMode, nextForm, isApplicable) is here too, and the base forms' drawing (R192).
import type { Calc, CalcSettings } from "../calc/port.ts";
import type { MarkInfo } from "../engine/format.ts";
import { formatBase, type Base } from "../engine/formatBase.ts";
import { PASDEG } from "../engine/pasdeg.ts";
import { decimalToString, type ComplexValue, type DecimalValue } from "../engine/format.ts";
import { polarDigits } from "../engine/polarDigits.ts";
import {
  type DisplayContext,
  type Drawn,
  type Facts,
  factsOf,
  FMT_MODES,
  type FmtMode,
  NOTATION_MODES,
  type FormStep,
  markFor,
  type NumericResult,
  renderNumeric,
  type Polar,
} from "./displayMode.ts";
import type { HistoryItem, Session } from "./session.svelte.ts";
import { wordStore } from "./wordStore.svelte.ts";
import { fmtSay } from "./fmtSay.svelte.ts";
import { fmtSayText, type FmtSayKey } from "../i18n/enFmtSay.ts";
export { wordStore };
export { passCas, passHome } from "../calc/portKeys.ts"; // R930: the Calc port's pass of a result, loaded with the word store (calc/engine.ts word)

const isBase = (m: FmtMode | undefined): m is Base => m === "hex" || m === "bin" || m === "oct";

/** Fraction modes need an exact rational, a base an exact integer; polar needs a complex result (and the engine). */
export function isApplicable(mode: FmtMode, f: Facts): boolean {
  if (!f.numeric) return false;
  if (mode === "frac" || mode === "mixed") return f.rational;
  if (isBase(mode)) return f.rational && !f.properFraction;
  if (mode === "polar") return f.complex;
  return true;
}

/** The word a base form is drawn in: the setting's (R194, wordStore.ts: read once this code is in), else 64 bits unsigned, as G229's word ops. */
export interface Word {
  bits: number;
  signed: boolean;
}
const WORD: Word = { bits: 64, signed: false };
void wordStore.restore(); // R194: read when this code loads (main.ts, idle); a base form is drawn in the setting's word once it is in

/** R192: `r` drawn in the base `mode` (formatBase, G228), not padded to the word: `0xFF`. Undefined when `mode` is no
 *  base, the result no exact integer, or the value outside the word (a negative one in an unsigned word too): the
 *  result then keeps its form, the number in its notation (Session.display). */
export function baseDrawn(r: NumericResult, mode: FmtMode | undefined, word: Word = wordStore.value ?? WORD): Drawn | undefined {
  if (!isBase(mode) || !r.rational || !isApplicable(mode, factsOf(r))) return undefined;
  const s = formatBase(r.rational.n, mode, word.bits, word.signed);
  return typeof s === "string" ? { text: s, latex: `\\mathrm{${s}}` } : undefined;
}

/** R192: `r` drawn in `mode` (Session.display): a base form when it applies (baseDrawn), else as renderNumeric draws it. */
export function drawnIn(r: NumericResult, mode: FmtMode | undefined, ctx: DisplayContext, grouped?: boolean): Drawn | undefined {
  return baseDrawn(r, mode) ?? renderNumeric(r, mode, ctx, grouped);
}

/** R192: the mark of `r` drawn in `mode` (Session.mark). A base form draws the integer whole, as a fraction does, so it
 *  is marked as the fraction is: `=` when exact (`≈` from an inexact chip, `⚠` kept); every other drawing as markFor. */
export function baseMark(r: NumericResult, mode: FmtMode | undefined, ctx: DisplayContext, word?: Word): MarkInfo | null {
  return markFor(r, baseDrawn(r, mode, word ?? wordStore.value ?? WORD) ? "frac" : mode, ctx);
}

/**
 * The a b/c key: the form after `current` (undefined = the base form). Each result type has one toggle: a fraction
 * that is not whole goes decimal ↔ fraction, a complex number a+bi ↔ polar. Home (`exactBase` false): the base is the
 * decimal (in the result's notation). CAS (`exactBase` true): the base is the exact result, which already is the
 * fraction, so a fraction toggles with its decimal ("dec"). null: nothing to switch (a whole number, a symbolic result).
 */
export function nextForm(current: FormStep | undefined, f: Facts, exactBase: boolean): { form: FormStep | undefined } | null {
  if (!f.numeric) return null;
  const other: FormStep | null = f.complex ? "polar" : f.properFraction ? (exactBase ? "dec" : "frac") : null;
  if (other === null) return null;
  return { form: current === other ? undefined : other };
}

/**
 * The mode after `current`. Home (`exactBase` false): the global mode counts as the current one and the cycle wraps.
 * CAS (`exactBase` true): the exact result is the first step and the cycle returns to it. null: nothing to cycle
 * (no ticked mode applies to this result).
 */
export function nextMode(
  current: FmtMode | undefined,
  ticked: readonly FmtMode[],
  facts: Facts,
  exactBase: boolean,
): { mode: FmtMode | undefined } | null {
  const list = FMT_MODES.filter((m) => ticked.includes(m) && isApplicable(m, facts));
  if (list.length === 0) return null;
  const seq: (FmtMode | undefined)[] = exactBase ? [undefined, ...list] : list;
  const i = seq.indexOf(current);
  return { mode: seq[(i + 1) % seq.length] };
}

/** The polar form of `item` from the engine's r and θ, with the digits of each that the value's confirmed digits
 *  confirm (G312; none for a value with no count, an exact one). */
export function polarOf(item: NumericResult, v: ComplexValue, r: DecimalValue, theta: DecimalValue, angle: Polar["angle"]): Polar {
  const n = item.facts?.reliableDigits ?? null;
  if (n === null) return { r, theta, angle, confirmed: null };
  const k = polarDigits(v, n, r, theta, angle);
  return { r, theta, angle, confirmed: Math.min(k.r, k.theta) };
}

/** The item needs r and θ computed (again): none yet, another angle unit, or stored before G312 (no counts). */
const polarStale = (item: HistoryItem, angle: Polar["angle"]): boolean => item.polar?.angle !== angle || item.polar.confirmed === undefined;

/** abs and arg of the value, from the engine (arg follows the angle unit setting). */
async function computePolar(s: Session, calc: Calc, item: HistoryItem, v: ComplexValue): Promise<boolean> {
  const z = `((${decimalToString(v.re)})+(${decimalToString(v.im)})*i)`;
  const set: CalcSettings = { digits: s.settings.digits, angle: s.settings.angle, format: s.settings.format };
  try {
    const [r, th] = [await calc.home(`abs(${z})`, set), await calc.home(`(arg(${z})/${PASDEG})`, set)]; // G46: Giac answers in radians; the factor gives the mode's unit
    if (!r.ok || !th.ok || !r.value || !th.value) return false;
    item.polar = polarOf(item, v, r.value.re, th.value.re, s.settings.angle);
    return true;
  } catch {
    return false;
  }
}

/** G785: what `item` draws in the form a key leaves it in (the text and the mark, as the row shows them): two steps that
 *  draw alike are one. */
const look = (s: Session, item: HistoryItem): string => {
  const m = s.mark(item);
  return `${s.display(item).text}\n${m?.mark}${m?.n}${m?.warn}`;
};

/** G785: the Format key's next step on `item` (Session.lastForKey's row): `item.form` dropped, else the next ticked mode
 *  (nextMode), past each step that would draw what the row shows now (SCI and ENG draw 5 alike, STD draws a CAS 5 as its
 *  exact form). Polar, which needs the engine to draw, counts as a change. null: no step changes the row (a dead press). */
export function fmtStep(s: Session, item: HistoryItem): { mode: FmtMode | undefined } | null {
  const exactBase = item.view === "cas";
  const now = look(s, item);
  let mode = item.fmt;
  if (item.form !== undefined && look(s, { ...item, form: undefined }) !== now) return { mode };
  for (let i = 0; i < FMT_MODES.length; i++) {
    const next = nextMode(mode ?? (exactBase ? undefined : s.settings.format), s.settings.fmtCycle, factsOf(item), exactBase);
    if (!next) return null;
    mode = next.mode;
    if (mode === "polar" || look(s, { ...item, form: undefined, fmt: mode }) !== now) return next;
  }
  return null;
}

/** G785: Fmt (`cycleFormat`) or a b/c (`cycleForm`) on `item` changes nothing (fmtStep, nextForm): a dead press (route.ts deadPress). */
export const formDead = (s: Session, item: HistoryItem, key: "cycleFormat" | "cycleForm"): boolean =>
  (key === "cycleFormat" ? fmtStep(s, item) : nextForm(item.form, factsOf(item), item.view === "cas")) === null;

void fmtSay.restore(); // R871: read when this code loads, as the word; a Fmt press waits for this code, so it is read by its say

/** R871: the notice a Fmt press that changed `item` shows with Say the format on: its notation now (a CAS row back at its
 *  exact form: Exact). */
export const fmtSaid = (item: HistoryItem): string =>
  fmtSayText("fmtSay.notice", { mode: fmtSayText(`fmtSay.${item.fmt && NOTATION_MODES.includes(item.fmt) ? item.fmt : "exact"}` as FmtSayKey) });

/** The Format key: `item` (the last result of the open view at the press, Session.lastForKey) in the next ticked mode
 *  (Settings) whose drawing differs (fmtStep), that result only. True when the display changed; with Say the format on
 *  (R871), the notice to show instead (fmtSaid). */
export async function cycleFormat(s: Session, calc: Calc, item: HistoryItem): Promise<boolean | string> {
  const next = fmtStep(s, item);
  if (!next) return false;
  if (next.mode === "polar" && item.value && polarStale(item, s.settings.angle) && !(await computePolar(s, calc, item, item.value)))
    return false;
  delete item.form; // a form chosen with a b/c: the Format key goes back to the number in its notation
  item.fmt = next.mode;
  s.saveHistory();
  return fmtSay.on ? fmtSaid(item) : true;
}

/** The a b/c key on an empty line (R10): `item` (the last result at the press) in its other form (decimal ↔ fraction, a+bi ↔ polar), that result
 *  only. True when the display changed; false when no other form applies (a whole number, a symbolic result). */
export async function cycleForm(s: Session, calc: Calc, item: HistoryItem): Promise<boolean> {
  const next = nextForm(item.form, factsOf(item), item.view === "cas");
  if (!next) return false;
  if (next.form === "polar" && item.value && polarStale(item, s.settings.angle) && !(await computePolar(s, calc, item, item.value)))
    return false;
  if (next.form === undefined) delete item.form;
  else item.form = next.form;
  s.saveHistory();
  return true;
}
