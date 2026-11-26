// SPDX-License-Identifier: GPL-3.0-or-later
// R869: the help card of a unit, a prefix or a constant (Help on Find's highlighted row, views/helpSheet.ts showHelpFor), made
// from the Find index alone (find/types.ts): no text of its own beyond the card's words (i18n/enHelp.ts). Each row only informs
// (`keep`); the caller adds the Insert row. A unit: its symbol and names, its quantity (the units menu's category whose `dims`
// hold its `dim`, spec/units-menu.yaml), its value in the coherent SI unit (units/dims.ts siUnit) worked out exactly from `si`
// (units/slot.ts exactFactor): a decimal that ends within 30 digits is exact, else the fraction (with π) and 12 digits after ≈;
// an offset scale (°C, °F) as its formula; no `si`: Find's note (finder.ts unitNote). A prefix: its power of ten (or two). A
// constant: its value and uncertainty as the index holds them, in its own unit (G801) or its SI one.
import raw from "../../../spec/units-menu.yaml";
import type { MenuItem } from "../apps/types.ts";
import { unitNote } from "../find/finder.ts";
import type { FindItem } from "../find/types.ts";
import { helpText as t } from "../i18n/enHelp.ts";
import { unitText, type UnitMessageKey } from "../i18n/enUnits.ts";
import { siUnit, unitProduct } from "../units/dims.ts";
import { exactFactor, type Exact } from "../units/slot.ts";

const categories = (raw as unknown as { categories: { name: string; dims: string[] }[] }).categories;

/** The most digits after the point an exact decimal is written with. */
const EXACT_MAX = 30;
/** The significant digits after ≈. */
const SIG = 12;
/** π to 60 digits (scaled by 10^60): enough for 12 digits of any power the index writes (π² at most). */
const PI60 = 3141592653589793238462643383279502884197169399375105820974944n;
const PI_SCALE = 10n ** 60n;

const SUPER: Readonly<Record<string, string>> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const sup = (n: number | string): string => [...String(n)].map((c) => SUPER[c] ?? c).join("");

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

/** n/d as an exact decimal when it ends within `max` digits after the point, else undefined. */
export function exactDecimal(n: bigint, d: bigint, max = EXACT_MAX): string | undefined {
  const g = gcd(n, d);
  [n, d] = [n / g, d / g];
  if (d < 0n) [n, d] = [-n, -d];
  let q = d;
  let twos = 0;
  let fives = 0;
  while (q % 2n === 0n) (q /= 2n), twos++;
  while (q % 5n === 0n) (q /= 5n), fives++;
  const k = Math.max(twos, fives);
  if (q !== 1n || k > max) return undefined;
  const sign = n < 0n ? "-" : "";
  const s = ((n < 0n ? -n : n) * 10n ** BigInt(k) / d).toString().padStart(k + 1, "0");
  const whole = s.slice(0, s.length - k);
  const frac = s.slice(s.length - k).replace(/0+$/, "");
  return sign + whole + (frac ? `.${frac}` : "");
}

/** n/d to SIG significant digits, rounded half up: plain from 1E-5 to below 1E12, else `d.ddd…E±k`; trailing zeros dropped. */
export function approx(n: bigint, d: bigint): string {
  if (n === 0n) return "0";
  const neg = n < 0n !== d < 0n;
  [n, d] = [n < 0n ? -n : n, d < 0n ? -d : d];
  let e = n.toString().length - d.toString().length; // 10^e ≤ n/d < 10^(e+2)
  if (n * 10n ** BigInt(Math.max(0, -e)) < d * 10n ** BigInt(Math.max(0, e))) e--;
  const shift = SIG - 1 - e;
  const scaled = shift >= 0 ? n * 10n ** BigInt(shift) : n;
  const den = shift >= 0 ? d : d * 10n ** BigInt(-shift);
  let m = (2n * scaled + den) / (2n * den); // half up
  if (m >= 10n ** BigInt(SIG)) {
    m /= 10n;
    e++;
  }
  const digits = m.toString();
  const sign = neg ? "-" : "";
  if (e < -5 || e >= SIG) {
    const rest = digits.slice(1).replace(/0+$/, "");
    return `${sign}${digits[0]}${rest ? `.${rest}` : ""}E${e}`;
  }
  const text = e >= 0 ? `${digits.slice(0, e + 1)}.${digits.slice(e + 1)}` : `0.${"0".repeat(-e - 1)}${digits}`;
  return sign + text.replace(/\.?0+$/, "");
}

/** An exact factor with π as a fraction of integers close enough for SIG digits: π^k through PI60. */
function withPi(x: Exact): { n: bigint; d: bigint } {
  let { n, d } = x;
  for (let i = 0; i < Math.abs(x.pi); i++) {
    if (x.pi > 0) [n, d] = [n * PI60, d * PI_SCALE];
    else [n, d] = [n * PI_SCALE, d * PI60];
  }
  return { n, d };
}

/** The index's `si` with π as the card writes it: "π/180", "2π", "16129π/10¹⁴", "π²/32400". */
const piText = (si: string): string =>
  si.replace(/\s+/g, "").replace(/\*pi\b/g, "π").replace(/\bpi\b/g, "π").replace(/\^(-?\d+)/g, (_, e: string) => sup(e)).replace(/\*/g, "·");

/** The symbol a unit is drawn with on the line (its insert's \mathrm{…}: °C, Ω), a leading 1 dropped (the degree's `1°`). */
function unitSymbol(it: FindItem): string {
  const m = /\\mathrm\{([^{}]*)\}\}?$/.exec(it.insert);
  const s = m?.[1]?.replace(/^1(?=\D)/, "") ?? "";
  return s || (it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1));
}

/** A constant's LaTeX symbol (its chip's second argument) as plain text: `\mu_{0}` → μ_0, `\mathrm{V\_m101}` → V_m101. */
const GREEK: Readonly<Record<string, string>> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", varepsilon: "ε", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", sigma: "σ",
  tau: "τ", phi: "φ", Phi: "Φ", Omega: "Ω", hbar: "ℏ", infty: "∞",
};
export function constSymbol(it: FindItem): string {
  const m = /^\\const\{[^{}]*\}\{(.*)\}$/.exec(it.insert);
  if (!m) return it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1);
  return (m[1] as string)
    .replace(/\\_/g, "_")
    .replace(/\\(mathrm|text)\{([^{}]*)\}/g, "$2")
    .replace(/\\([A-Za-z]+)/g, (all, w: string) => GREEK[w] ?? w)
    .replace(/[{}]/g, "");
}

/** The symbol, then the other names a user may type (not the identifier forms with `_`): "ft · foot, feet". */
function namesLine(symbol: string, it: FindItem): string {
  const rest = it.names.filter((n) => n !== symbol && !n.includes("_"));
  return rest.length ? `${symbol} · ${rest.join(", ")}` : symbol;
}

/** A Find unit expression ("m*s^-1", "J*mol^-1*K^-1") as text ("m/s", "J/(mol·K)"). */
export function unitExprText(expr: string): string {
  const shown: Readonly<Record<string, string>> = { ohm: "Ω" };
  return unitProduct(expr.split("*").map((f) => {
    const [sym = "", e = "1"] = f.split("^");
    return [shown[sym] ?? sym, e] as const;
  }));
}

/** The units menu's category of a dimension (spec/units-menu.yaml: the first whose `dims` hold it), translated. */
export function quantityOf(dim: string | undefined): string | undefined {
  const cat = dim === undefined ? undefined : categories.find((c) => c.dims.includes(dim));
  return cat && unitText(`units.cat.${cat.name}` as UnitMessageKey);
}

const info = (id: string, label: string, hint?: string): MenuItem => ({ id, label, keep: true, ...(hint ? { hint } : {}) });

/** "1" with a unit symbol: a space before a letter (1 ft, 1 °C), none before ° ′ ″ (1°). */
const one = (sym: string): string => (/^[°′″]$/.test(sym) ? `1${sym}` : `1 ${sym}`);

/** A unit's value line: `1 ft = 0.3048 m` exact; `1 x = p/q m` with ≈; `1° = π/180 rad` with ≈; an offset scale's formula. */
function unitValue(it: FindItem, sym: string): MenuItem | undefined {
  if (it.si === undefined) {
    const note = unitNote(it);
    return note ? info("value", note) : undefined;
  }
  const si = it.dim === undefined ? "" : siUnit(it.dim).text;
  const off = /^(.+)\+(.+)$/.exec(it.si.replace(/\s+/g, ""));
  if (off) {
    // T in K = a·x + b: x = K/a − b/a; a difference of 1 x is a K
    const a = exactFactor(off[1] as string);
    const b = exactFactor(off[2] as string);
    if (!a || !b || a.pi || b.pi) return undefined;
    const num = (n: bigint, d: bigint): string => exactDecimal(n, d) ?? `${n / gcd(n, d)}/${d / gcd(n, d)}`;
    const inv = a.n === a.d ? "" : `${num(a.d, a.n)}·`;
    return info("value", t("card.offset", { unit: sym, si, scale: inv, offset: num(b.n * a.d, b.d * a.n) }), t("card.step", { unit: sym, si, size: num(a.n, a.d) }));
  }
  const x = exactFactor(it.si);
  if (!x) return undefined;
  const lhs = `${one(sym)} = `;
  if (x.pi === 0) {
    const exact = exactDecimal(x.n, x.d);
    if (exact !== undefined) return info("value", `${lhs}${exact} ${si}`.trim(), t("card.exact"));
    const g = gcd(x.n, x.d);
    return info("value", `${lhs}${x.n / g}/${x.d / g} ${si}`.trim(), `≈ ${approx(x.n, x.d)} ${si}`.trim());
  }
  const v = withPi(x);
  return info("value", `${lhs}${piText(it.si)} ${si}`.trim(), `≈ ${approx(v.n, v.d)} ${si}`.trim());
}

/** A prefix's factor: "× 1000 = 10³", "× 1024 = 2¹⁰"; past 12 digits the power alone ("× 10⁻³⁰"). */
function prefixValue(it: FindItem): MenuItem | undefined {
  const x = it.si === undefined ? undefined : exactFactor(it.si);
  if (!x || x.pi) return undefined;
  const power = (base: bigint): number | undefined => {
    let [n, d, k] = [x.n, x.d, 0];
    while (n > 1n && n % base === 0n) (n /= base), k++;
    while (d > 1n && d % base === 0n) (d /= base), k--;
    return n === 1n && d === 1n ? k : undefined;
  };
  const p10 = power(10n);
  const p2 = p10 === undefined ? power(2n) : undefined;
  const pow = p10 !== undefined ? `10${sup(p10)}` : p2 !== undefined ? `2${sup(p2)}` : undefined;
  const dec = exactDecimal(x.n, x.d);
  const short = dec !== undefined && dec.replace(/[-.]/g, "").length <= SIG;
  const label = short && pow ? `× ${dec} = ${pow}` : short ? `× ${dec}` : pow ? `× ${pow}` : `× ${x.n}/${x.d}`;
  return info("value", label, t("card.exact"));
}

/** R869: the card's rows for a unit, a prefix or a constant (each only informs; the caller adds Insert); undefined for any other
 *  kind (a function's help is R197's helpRows). */
export function cardRows(it: FindItem): MenuItem[] | undefined {
  const rows: (MenuItem | undefined)[] = [];
  if (it.kind === "unit") {
    const sym = unitSymbol(it);
    const q = quantityOf(it.dim);
    rows.push(info("names", namesLine(sym, it)), q ? info("quantity", q) : undefined, unitValue(it, sym));
  } else if (it.kind === "pfx") {
    const sym = it.insert.match(/^\\pfx\{[^{}]*\}\{\\mathrm\{([^{}]*)\}\}$/)?.[1] ?? it.names[0] ?? "";
    rows.push(info("names", namesLine(sym, it)), prefixValue(it));
  } else if (it.kind === "const") {
    const sym = constSymbol(it);
    const unit = it.ownUnit ?? it.unit;
    const u = unit ? ` ${unitExprText(unit)}` : "";
    const value = it.value ?? "?";
    rows.push(
      info("names", namesLine(sym, it)),
      it.unc === undefined ? info("value", `${value}${u}`, t("card.definition")) : info("value", `${value} ± ${it.unc}${u}`, t("card.codata")),
    );
  } else return undefined;
  if (it.tier === 1) rows.push(info("tier", t("card.notChecked")));
  return rows.filter((r): r is MenuItem => r !== undefined);
}
