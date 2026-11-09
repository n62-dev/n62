// SPDX-License-Identifier: GPL-3.0-or-later
// G172 (F73, F93): the double fallback (numeric.ts doubleFallback) of a result exactFacts found no MPFR value for, element
// by element: an element MPFR values keeps its own facts, an element only a double values gets the fallback's facts (⚠),
// an element with a free name (or no number at all) keeps the whole result symbolic. Each element is read at P from a slot
// of its own, so it takes the scalar path the scalar result takes; the checks G84 and G123 make for a scalar hold per element.
import type { GiacValue } from "./bridge.ts";
import { doubleFallback, exactFacts, valuePrecision, withDigits, size, type ElementFacts, type Giac, type Shape } from "./numeric.ts";
import { elementAt, mayBeNumbers, overflowAt, underflow, zeroElements } from "./novalue.ts";

/** The element read; the list as Ans will hold it, the doubles in. Both purged after the run. */
const EL = "pasel";
const COPY = "pasdl";
const SCALAR: Shape = { kind: "scalar" };

/** Most elements read one by one. An element costs about 11 Giac calls, 4.9 ms on the desktop (`seq(BesselJ(1,k),k,1,399)`
 *  took 1.95 s), so 32 take 1.3 s on a device 8× slower, inside HOME_DEADLINE_MS: the count decides, not the device's
 *  speed (G82), and a longer list is Giac's text, as before G172. */
export const MAX_DOUBLE_ELEMENTS = 32;

export interface DoubleElementsRun {
  /** Slot of the exact result (Ans). */
  name: string;
  /** The input, for the fallback's audit of its functions. */
  input: string;
  exactOut: string;
  value: GiacValue;
  shape: Shape;
  digits: number;
  maxExactDigits: number;
  once: boolean;
  late: () => boolean;
}

/** The facts of `run`'s result by the double fallback; the reason it is refused; null: it stays symbolic. Ans holds the
 *  numbers only when every element has one. */
export function doubleElements(giac: Giac, run: DoubleElementsRun): ElementFacts[] | "overflow" | "underflow" | null {
  const { name, input, exactOut, value, shape, digits, once, late } = run;
  const P = valuePrecision(digits);
  if (shape.kind === "scalar") {
    // G123 (F123): MPFR's infinity at P is an overflow, whatever a double makes of it (1.000000000000001^(10^50) gave 1.0).
    if (!once && !late() && overflowAt(giac, name, exactOut, P)) return "overflow";
    const d = doubleFallback(giac, name, input, digits, digits, value);
    if (!d) return null;
    // G84 (F60): a double's 0 where MPFR found no value (exp(cosh(asin(π)/pasdeg))) whose exact answer is not 0.
    return !once && !late() && underflow(giac, zeroElements(`(${exactOut})`, [d], shape), null) ? "underflow" : [d];
  }
  const n = size(shape);
  // A free name or a string in the text: no number to find, and no engine call to learn it.
  if (n > MAX_DOUBLE_ELEMENTS || !mayBeNumbers(exactOut)) return null;
  const out: ElementFacts[] = [];
  const copy = { made: false };
  try {
    for (let k = 0; k < n; k++) {
      if (late()) return null;
      const f = oneElement(giac, run, k, P, copy);
      if (f === null || typeof f === "string") return f;
      out.push(f);
    }
    // only now: an element with no number leaves Ans as it was
    if (copy.made) withDigits(giac, P, digits, () => giac.eval(`${name}:=${COPY}`));
    return out;
  } finally {
    giac.eval(`purge(${EL},${COPY})`);
  }
}

function oneElement(giac: Giac, run: DoubleElementsRun, k: number, P: number, copy: { made: boolean }): ElementFacts | "overflow" | "underflow" | null {
  const { name, input, shape, digits, maxExactDigits, once, late } = run;
  // P and P + 20 always: G153's check (numberLost) of an element needs both, whatever else the input holds
  const ev = withDigits(giac, P, digits, () => {
    const v = giac.value(`${EL}:=${elementAt(name, shape, k)}`, [P, P + 20]);
    return v.cut ? { ...v, text: giac.eval(EL) } : v;
  });
  let under = false;
  const asked = new Set<number>();
  const underflowAt = once
    ? undefined
    : (j: number): boolean => {
        asked.add(j);
        under = !late() && underflow(giac, [EL], P);
        return under;
      };
  const f = exactFacts(giac, EL, SCALAR, digits, maxExactDigits, ev.text, ev, underflowAt);
  if (f) {
    // G84: an element that reads as 0 while its exact answer is not 0 (after G126's question, when exactFacts asked it)
    if (!once && (under || (!late() && underflow(giac, zeroElements(EL, f, SCALAR, asked), P)))) return "underflow";
    return f[0]!;
  }
  if (!once && !late() && overflowAt(giac, EL, ev.text, P)) return "overflow";
  const d = doubleFallback(giac, EL, input, digits, digits, ev);
  if (!d) return null;
  if (!once && !late() && underflow(giac, zeroElements(`(${ev.text})`, [d], SCALAR), null)) return "underflow";
  // Ans's copy takes the double (doubleFallback left it in pasd), at P so the other elements stay as they are
  withDigits(giac, P, digits, () => {
    if (!copy.made) giac.eval(`${COPY}:=${name}`);
    giac.eval(`${elementAt(COPY, shape, k)}:=pasd`);
  });
  copy.made = true;
  return d;
}
