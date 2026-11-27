// SPDX-License-Identifier: GPL-3.0-or-later
// G800: the unit sweep's checks (scripts/unitsweep.ts), pure: each gets text the app drew or numbers the evaluator gave, and
// returns the failures. A family test (owner-style hunt 2026-11-23: unit rows cut above σ, a PFX σ in plain units beside a
// prefixed value, a row that dropped σ's ⚠: R885, R886).
//   drawingCheck: Home's unit row, the unit view's headline and Copy as shown draw value and σ by the one rule (docs/04 2.6, R885):
//     the row never cut above σ's last digit (unless the value is not confirmed that far), σ at 2 significant digits in the
//     value's form (its prefix or exponent; an exponent 0 may be left off σ), the digits read back are the value's and σ's
//     own, the headline is the row cut at σ with the same σ, Copy as shown is the row, and a σ ⚠ in the view is in the row; a σ is
//     never drawn plain with more than 12 digits (no digits setting draws a number so).
//   tripCheck: a value converted to another unit and back reads the same at the digits shown; σ is scaled like the value.
//   sigmaOracle / sigmaCheck: σ of a product, quotient or power of independent inputs against the GUM (first order plus G41's
//     second-order term, units.yaml's header), and its ⚠: "the interval reaches a singular point" where an input's x ± 2σ
//     reaches one, else "first order does not hold here" where the second-order part is over 10 % of σ².
import type { DecimalValue } from "../src/engine/format.ts";

export interface Failure {
  check: string;
  detail: string;
}

/** A number as drawn: `int` × 10^`last` (its last digit's place), and the power its form wrote (exponent or prefix). */
export interface Read {
  int: bigint;
  last: number;
  /** "E<n>" for an exponent, "p:<prefix>" for an SI prefix, "" for plain. */
  form: string;
  /** The digits after the decimal point. */
  decimals: number;
}

const PREFIX_POWER: Record<string, number> = { f: -15, p: -12, n: -9, "µ": -6, m: -3, k: 3, M: 6, G: 9, T: 12, P: 15 };
const NUM = /^([-−]?)(\d+)(?:\.(\d+))?(?:E([-−]?\d+))?(?:[\s   ]+([fpnµmkMGTP]))?$/u;

/** One drawn number ("4.70 k", "9.810E-6", "0.000090E14", "−3"); null when it does not read as one. */
export function readNumber(s: string): Read | null {
  const m = NUM.exec(s.trim());
  if (!m) return null;
  const [, sign, ip, fp = "", ex, px] = m;
  const p = ex !== undefined ? Number(ex.replace("−", "-")) : px !== undefined ? PREFIX_POWER[px]! : 0;
  const mag = BigInt(`${ip}${fp}`);
  return { int: sign ? -mag : mag, last: p - fp.length, form: ex !== undefined ? `E${p}` : px !== undefined ? `p:${px}` : "", decimals: fp.length };
}

/** "value ± [⚠]σ" (a row's unit `unit` after it, when given): its parts; null when it is not of that shape. */
export function readDrawn(text: string, unit = ""): { value: Read; sigma: Read; warn: boolean; valueText: string; sigmaText: string } | null {
  let t = text;
  if (unit) {
    if (!t.endsWith(` ${unit}`)) return null;
    t = t.slice(0, -unit.length - 1);
  }
  const at = t.indexOf(" ± ");
  if (at < 0) return null;
  const valueText = t.slice(0, at);
  let sigmaText = t.slice(at + 3);
  const warn = sigmaText.startsWith("⚠");
  if (warn) sigmaText = sigmaText.slice(1);
  const value = readNumber(valueText);
  const sigma = readNumber(sigmaText);
  return value && sigma ? { value, sigma, warn, valueText, sigmaText } : null;
}

/** `v` rounded half away from zero to a multiple of 10^`last`, as that multiple. */
export function roundAt(v: DecimalValue, last: number): bigint {
  const n = v.exp - last + 1; // digits kept
  if (v.digits === "" || n < 0) return 0n;
  const kept = n === 0 ? 0n : BigInt(v.digits.slice(0, n).padEnd(n, "0"));
  const up = (v.digits.charAt(n) || "0") >= "5" ? 1n : 0n;
  const r = kept + up;
  return v.neg ? -r : r;
}

/** σ's last digit's place at 2 significant digits (after its rounding: 9.96 → 10, place 0). */
export function sigmaPlace(s: DecimalValue): number {
  const two = roundAt({ ...s, neg: false }, s.exp - 1);
  return two >= 100n ? s.exp : s.exp - 1;
}

/** `a` and `b` are the same number (whatever their places). */
function same(a: { int: bigint; last: number }, b: { int: bigint; last: number }): boolean {
  const m = Math.min(a.last, b.last);
  return a.int * 10n ** BigInt(a.last - m) === b.int * 10n ** BigInt(b.last - m);
}

/** The most digits a number is drawn plain with at any digits setting (HomeSettings.digits is at most 12). */
const LONG = 12;

const show = (r: Read): string => `${r.int}E${r.last}`;

/** The place `v` was rounded at to read as `r`: r's last digit's, or, for a mantissa with no decimals that ends in zeros, the place
 *  of one of them (the smallest that fits); null when no place gives r's digits. */
export function placeOf(r: Read, v: DecimalValue): number | null {
  let tz = 0;
  if (r.int !== 0n) for (let x = r.int < 0n ? -r.int : r.int; x % 10n === 0n; x /= 10n) tz++;
  const free = r.decimals === 0 ? tz : 0;
  for (let L = r.last; L <= r.last + free; L++) if (roundAt(v, L) * 10n ** BigInt(L - r.last) === r.int) return L;
  return null;
}

/** What drawingCheck reads: the value and σ the evaluator gave (every digit it has), what the screen drew, and its facts. */
export interface DrawingIn {
  value: DecimalValue;
  sigma: DecimalValue;
  /** The value's confirmed significant digits (ValueFacts.reliableDigits; null: all). */
  reliable: number | null;
  /** Home's row text (Session.display), its unit after it. */
  row: string;
  unit: string;
  /** Copy as shown of the row. */
  copy: string;
  /** The unit view's headline (UnitShown.text) and its σ ⚠ (UnitShown.warn). */
  head: string;
  viewWarn: boolean;
  /** The digits setting the drawing used. */
  digits: number;
}

/** One drawing of a value with σ: the failures (none when the row, the headline and Copy follow the rule). */
export function drawingCheck(d: DrawingIn): Failure[] {
  const out: Failure[] = [];
  const k = sigmaPlace(d.sigma);
  const s2 = roundAt({ ...d.sigma, neg: false }, k);
  // the value's confirmed last place: a σ finer than it leaves the value there (R885 FIX 1), σ alone in its own form
  const floor = d.reliable === null ? -Infinity : d.value.exp - Math.max(1, d.reliable) + 1;
  const limited = floor > k;
  const row = readDrawn(d.row, d.unit);
  const head = readDrawn(d.head);
  if (d.copy !== d.row) out.push({ check: "copy", detail: `Copy as shown ${JSON.stringify(d.copy)} is not the row ${JSON.stringify(d.row)}` });
  if (!row) out.push({ check: "row", detail: `the row ${JSON.stringify(d.row)} does not read as value ± σ ${d.unit}` });
  if (!head) out.push({ check: "head", detail: `the headline ${JSON.stringify(d.head)} does not read as value ± σ` });
  const one = (name: string, r: NonNullable<ReturnType<typeof readDrawn>>, text: string): void => {
    const zero = r.value.int === 0n;
    // the place the value was cut at: its last digit's, or a place of the zeros an integer mantissa ends in (4.70 k ± 0.10 k's
    // zero is a digit; 340E-6 ± 270E-6 is -34 at 10⁻⁵ with a zero padded)
    const at = zero ? Math.max(r.value.last, k) : placeOf(r.value, d.value);
    if (!limited && at !== null && at > k && !(zero && roundAt(d.value, k) === 0n))
      out.push({ check: "cut", detail: `the ${name} ${JSON.stringify(text)} is cut at 10^${at}, above σ's last digit (10^${k})` });
    if (zero ? roundAt(d.value, at!) !== 0n : at === null)
      out.push({ check: "value", detail: `the ${name} ${JSON.stringify(text)} reads ${show(r.value)}, the value rounded there is ${roundAt(d.value, r.value.last)}E${r.value.last}` });
    if (!same(r.sigma, { int: s2, last: k })) out.push({ check: "sigma", detail: `the ${name} ${JSON.stringify(text)} reads σ ${show(r.sigma)}, σ at 2 digits is ${s2}E${k}` });
    const vf = r.value.form, sf = r.sigma.form;
    // σ (2 significant digits) drawn plain with more than 12 digits, past what any digits setting draws plain: zeros padded on
    // (sigmaAlone writes 9.0E9, not 9000000000; R885's rule draws a σ in a plain value's form, 3 ± 120, so a σ up to 12 digits passes)
    const width = sigmaPlace(d.sigma) + 2;
    if (sf === "" && width > LONG) out.push({ check: "long", detail: `the ${name} ${JSON.stringify(text)} draws σ plain with ${width} digits (digits setting ${d.digits})` });
    if (!limited && !zero && vf !== sf && !(vf === "E0" && sf === "")) out.push({ check: "form", detail: `the ${name} ${JSON.stringify(text)} draws σ in another form than the value (${vf || "plain"} against ${sf || "plain"})` });
  };
  if (row) one("row", row, d.row);
  if (head) one("headline", head, d.head);
  if (row && head) {
    // σ in the value's form: the same text where both values took one form (the headline's rounding at σ may carry it into
    // the next exponent or prefix: 9.51411E5 ± 22E5 in the row, 1.0E6 ± 2.2E6 in the headline)
    if (row.value.form === head.value.form && row.sigmaText !== head.sigmaText) out.push({ check: "same", detail: `σ reads ${JSON.stringify(row.sigmaText)} in the row, ${JSON.stringify(head.sigmaText)} in the headline` });
    if (head.value.int !== 0n && head.value.last < row.value.last) out.push({ check: "same", detail: `the headline ${JSON.stringify(d.head)} draws more digits than the row ${JSON.stringify(d.row)}` });
    if (row.warn !== d.viewWarn) out.push({ check: "warn", detail: `the view's σ ${d.viewWarn ? "has" : "has no"} ⚠, the row ${JSON.stringify(d.row)} ${row.warn ? "has" : "has none"}` });
  }
  return out;
}

/** A conversion and its way back: `from` (the value in its unit as the view draws it), `back` (the value converted there
 *  and back, drawn the same way); `rel` σ/|value| before and after the conversion (absent without σ). */
export function tripCheck(t: { from: string; back: string; relFrom?: number; relThere?: number }): Failure[] {
  const out: Failure[] = [];
  if (t.back !== t.from) out.push({ check: "trip", detail: `there and back reads ${JSON.stringify(t.back)}, it was ${JSON.stringify(t.from)}` });
  if (t.relFrom !== undefined && t.relThere !== undefined && !(Math.abs(t.relThere - t.relFrom) <= 1e-9 * Math.abs(t.relFrom)))
    out.push({ check: "tripsigma", detail: `σ/value is ${t.relThere} after the conversion, ${t.relFrom} before` });
  return out;
}

/** An input x ± σ (σ > 0). */
export interface Input {
  x: number;
  s: number;
}
export type SigmaCase = { kind: "product" | "quotient"; a: Input; b: Input } | { kind: "power"; a: Input; n: number };

export interface SigmaWant {
  /** σ/|f|, first and second order. */
  rel: number;
  /** The second-order part's share of σ². */
  share: number;
  /** An input's x ± 2σ reaches a point where f or its derivative is not defined; null when it lies within 10⁻⁹ of one (not judged). */
  singular: boolean | null;
}

/** x ± 2σ reaches 0: true, false, or null within 10⁻⁹ of it. */
function reachesZero(i: Input): boolean | null {
  const gap = Math.abs(i.x) - 2 * i.s;
  return Math.abs(gap) <= 1e-9 * Math.max(Math.abs(i.x), i.s) ? null : gap <= 0;
}

/** σ by the GUM with the second-order term of uncorrelated inputs (GUM 5.1.2 note): σ² = Σ (∂f/∂xᵢ uᵢ)² +
 *  Σᵢ Σⱼ [½ (∂²f/∂xᵢ∂xⱼ)² + ∂f/∂xᵢ · ∂³f/∂xᵢ∂xⱼ²] uᵢ² uⱼ², relative to |f|. Derived by hand for the three shapes:
 *  x·y: second = σx²σy²; x/y: second = 3σx²σy²/y⁴ + 8x²σy⁴/y⁶; xⁿ: second = (½ f″² + f′ f‴) σ⁴. */
export function sigmaOracle(c: SigmaCase): SigmaWant {
  if (c.kind === "power") {
    const { x, s } = c.a, n = c.n;
    const f = x ** n, d1 = n * x ** (n - 1), d2 = n * (n - 1) * x ** (n - 2), d3 = n * (n - 1) * (n - 2) * x ** (n - 3);
    const first = (d1 * s) ** 2, second = (0.5 * d2 * d2 + d1 * d3) * s ** 4;
    const whole = Number.isInteger(n) && n > 0;
    return { rel: Math.sqrt(first + second) / Math.abs(f), share: second / (first + second), singular: whole ? false : reachesZero(c.a) };
  }
  const { x, s: sx } = c.a, { x: y, s: sy } = c.b;
  if (c.kind === "product") {
    const first = (y * sx) ** 2 + (x * sy) ** 2, second = sx * sx * sy * sy;
    return { rel: Math.sqrt(first + second) / Math.abs(x * y), share: second / (first + second), singular: false };
  }
  const first = (sx / y) ** 2 + ((x * sy) / (y * y)) ** 2;
  const second = (3 * sx * sx * sy * sy) / y ** 4 + (8 * x * x * sy ** 4) / y ** 6;
  return { rel: Math.sqrt(first + second) / Math.abs(x / y), share: second / (first + second), singular: reachesZero(c.b) };
}

/** The evaluator's σ/|value| and its ⚠ reason (Uncertainty.why: "order2", "singular", "jump"; undefined: none) against the oracle. */
export function sigmaCheck(want: SigmaWant, got: { rel: number; why?: string }): Failure[] {
  const out: Failure[] = [];
  if (!(Math.abs(got.rel - want.rel) <= 1e-9 * want.rel)) out.push({ check: "sigma1", detail: `σ/|f| is ${got.rel}, the GUM's (first and second order) ${want.rel}` });
  // the reasons in evaluate.ts's order: a singular point before the second order; a share within 10⁻⁶ of 10 % is not judged
  const near = Math.abs(want.share - 0.1) <= 1e-6;
  const whyWant = want.singular === true ? "singular" : want.singular === null || near ? undefined : want.share > 0.1 ? "order2" : "";
  if (whyWant !== undefined && (got.why ?? "") !== whyWant)
    out.push({ check: "sigmawarn", detail: `σ's ⚠ is ${got.why ?? "none"}, wanted ${whyWant || "none"} (second order ${(want.share * 100).toPrecision(3)} % of σ²${want.singular ? ", the interval reaches a singular point" : ""})` });
  return out;
}
