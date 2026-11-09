// SPDX-License-Identifier: GPL-3.0-or-later
// R104: `± n %` right after a number in the unit view is σ = |value|·n/100 in the value's unit: a standard uncertainty
// given relative to the value (G18), not a tolerance limit (a limit ± a has the standard uncertainty a/√3). The parser
// writes it as the literal σ it writes for `± σ`, computed exactly from the two decimal literals. Plain TS, no engine.
import type { Json } from "./emit.ts";

/** Units mode, a sign before a ± value: `e` with the sign inside its pasupm call, or null when `e` holds none. */
export function negateUncertain(e: Json): Json | null {
  if (!Array.isArray(e)) return null;
  if (e[0] === "Call" && e[1] === "pasupm") {
    if (e.length > 4) return ["Negate", e]; // R115: a chip's call (with its key) is one input: the sign stays outside
    const v = e[2] as Json;
    return ["Call", "pasupm", Array.isArray(v) && v[0] === "Negate" ? (v[1] as Json) : ["Negate", v], ...e.slice(3)] as Json;
  }
  if ((e[0] === "Multiply" || e[0] === "Divide") && e.length > 1) {
    const l = negateUncertain(e[1] as Json);
    return l ? ([e[0], l, ...e.slice(2)] as Json) : null;
  }
  return null;
}

/** A literal's text as the parser writes it ("250", "0.4", "1.5e3", "2e-9") as m·10^k, or null. */
function decimal(text: string): { m: bigint; k: number } | null {
  const t = /^(\d*)\.?(\d*)(?:e([+-]?\d+))?$/.exec(text);
  if (!t || (t[1] === "" && t[2] === "")) return null;
  return { m: BigInt(t[1]! + t[2]! || "0"), k: Number(t[3] ?? 0) - t[2]!.length };
}

/** m·10^k as a literal: plain from 10⁻⁵ up to 10¹², else the digits with an e exponent (2e-11). */
function literal(m: bigint, k: number): string {
  if (m === 0n) return "0";
  while (m % 10n === 0n) {
    m /= 10n;
    k++;
  }
  const d = m.toString();
  const e10 = d.length - 1 + k;
  if (e10 < -5 || e10 >= 12) return `${d}e${k}`;
  if (k >= 0) return d + "0".repeat(k);
  const pad = d.padStart(-k + 1, "0");
  return `${pad.slice(0, pad.length + k)}.${pad.slice(pad.length + k)}`;
}

const num = (j: Json): string | null => (typeof j === "object" && j !== null && !Array.isArray(j) && "num" in j ? String(j.num) : null);

/** σ for `value ± n %`: |value|·n/100. `value` is the number before ± (unsigned: a sign is put on it later), `n` the
 *  literal after it; a value that is not a decimal literal (a mixed number) gives the product as an expression. */
export function percentSigma(value: Json, n: Json): Json {
  const v = num(value);
  const p = num(n);
  const a = v === null ? null : decimal(v);
  const b = p === null ? null : decimal(p);
  if (a && b) return { num: literal(a.m * b.m, a.k + b.k - 2) };
  return ["Divide", ["Multiply", value, n], { num: "100" }];
}
