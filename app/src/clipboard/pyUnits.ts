// SPDX-License-Identifier: GPL-3.0-or-later
// G216: Copy as Python's unit table, Find id → pint name (docs/04 2.6, 4.3). Hand-kept, closed: a unit, prefix or constant
// not here is not translated (`# N62 NOT TRANSLATED (unit <id>)`). scripts/pyunits-check.ts (the pydiff stage) checks
// every entry in pint's own registry: it exists, it has Find's dimension, and its factor to SI base units is Find's
// (find/factors.yaml) as an exact rational, π by pint's own π; each prefix on each unit that takes one likewise. Left out
// on purpose: rpm and tr (N62 counts turns, G40), the logarithmic units (dB, dBm, Np: G17's rules are not pint's), the
// units pint names with another size (Btu: pint's is the ISO one; gauss, Mx: Gaussian units), the US survey units, the
// typographic ones, units of constants (c, e), bit and byte (pure numbers in pint, a dimension in Find). A prefix on
// cd or bar is left out: pint reads `mcd` as micro-day and `hbar` as ℏ. A constant is never pint's: N62's value goes in as a literal with its SI
// unit (CONSTS holds only the dimension). Lazy: reached only through clipboard/python.ts.
import type { UnitSlot, UnitToken } from "../units/types.ts";

/** Find unit ids pint reads as they are (`^` written `**`). */
const SAME =
  ("m km dm cm mm um nm micron nmi angstrom in hand ft li yd rd fathom ch fur mi thou au ly rad deg arcmin arcsec deg^2 sr " +
    "rad/s^2 rad/s g kg hg t gr dr oz lb stone carat slug kg/m^3 g/dm^3 g/cm^3 g/mol s min h d week fortnight month Hz A " +
    "A/m^2 C C/m^3 C*m D C/m^2 V F V/C ohm S V/m N/C F/m H H/m K mol mol/(m^2*s) umol/(m^2*s) mol/m^3 mol/L mol/dm^3 " +
    "molar kat kat/m^3 cd cd/m^2 lm lx W/sr W/m^2 W/(sr*m^2) m^2 km^2 ha b acre ft^2 in^2 mi^2 m^3 L mL cL dL in^3 cm^3 " +
    "L/km km/L acre*ft m^3/kg L/s L/min L/h m^3/s cm^3/min ft^3/min ft^3/s acre*ft/d m/s km/h nmi/h knot mph min/km " +
    "min/mi m/s^2 Gal m/s^3 A/m Wb T A*m^2 N dyn lbf ozf pdl gf kgf N*m kg*m/s Pa kgf/cm^2 psi ksi bar atm mmHg inHg Ba " +
    "Pa*s P cP m^2/s St cSt N/m J kJ W*h kW*h cal kcal eV erg ft*lbf J/kg kcal/g W hp erg/s J/K J/(kg*K) W/(m*K) J/m^3 " +
    "J/mol J/(mol*K) J*s Bq Ci Gy erg/g Sv rem mrem C/kg Gy/s mrem/h kN MN kPa MPa GPa hPa kN*m MJ Wh kWh MWh mW kW MW GW uA mA kA mV kV mohm kohm Mohm pF nF uF mF nH uH mH uT mT " +
    "kHz MHz GHz ug mg ns us ms mmol kmol kip Ah mAh").split(" ");

/** Find unit ids pint names otherwise. */
const OTHER: readonly (readonly [string, string])[] = [
  ["oz_t", "ozt"],
  ["lb_t", "lbt"],
  ["pwt", "pennyweight"],
  ["s_ton", "short_ton"],
  ["l_ton", "long_ton"],
  ["cwt_US", "short_hundredweight"],
  ["l_cwt", "long_hundredweight"],
  ["a_j", "julian_year"],
  ["a_g", "gregorian_year"],
  ["oR", "degR"],
  ["a", "are"],
  ["gal_US", "gallon"],
  ["gal_UK", "imperial_gallon"],
  ["fl_oz_US", "fluid_ounce"],
  ["fl_oz_UK", "imperial_fluid_ounce"],
  ["liq_pt_US", "liquid_pint"],
  ["liq_qt_US", "quart"],
  ["pt_UK", "imperial_pint"],
  ["qt_UK", "imperial_quart"],
  ["gi_US", "gill"],
  ["gi_UK", "imperial_gill"],
  ["cup_US", "cup"],
  ["tsp_US", "teaspoon"],
  ["tbsp_US", "tablespoon"],
  ["bbl", "oil_barrel"],
  ["bu_US", "bushel"],
  ["pk_US", "peck"],
  ["dry_pt_US", "dry_pint"],
  ["dry_qt_US", "dry_quart"],
  ["cfm", "ft**3/min"],
  ["cfs", "ft**3/s"],
  ["gpm_US", "gallon/min"],
  ["gal_US/s", "gallon/s"],
  ["Torr", "torr"],
  ["mTorr", "millitorr"],
  ["gee", "standard_gravity"],
  ["cal_IT", "cal_it"],
  ["PS", "metric_horsepower"],
];

/** The table: Find unit id (without "unit:") → pint's name, as pint parses it. */
export const PY_UNITS: ReadonlyMap<string, string> = new Map([...SAME.map((id) => [id, id.replace(/\^/g, "**")] as const), ...OTHER]);

/** The units that take a prefix in a slot (`k` + `N`): pint reads the prefix's symbol before the name. */
export const PY_PREFIXED: ReadonlySet<string> = new Set(
  "m g s A K mol N J W Pa Hz V ohm F H C S T Wb L eV Gy Sv Bq lm lx kat".split(" "),
);

/** Find prefix id (without "pfx:") → pint's prefix symbol; the binary ones are left out with the data units. */
export const PY_PREFIXES: ReadonlyMap<string, string> = new Map(
  ["q", "r", "y", "z", "a", "f", "p", "n", "u", "m", "c", "d", "da", "h", "k", "M", "G", "T", "P", "E", "Z", "Y", "R", "Q"].map((p) => [p, p]),
);

/** The absolute temperatures (docs/04 4.3): alone in a slot they carry their offset (`Q_(20, 'degC')`), anywhere else
 *  they are an interval (`J/(kg·°C)`: pint's delta unit). */
export const PY_TEMPS: ReadonlyMap<string, { abs: string; delta: string }> = new Map([
  ["oC", { abs: "degC", delta: "delta_degC" }],
  ["oF", { abs: "degF", delta: "delta_degF" }],
]);

/** The constants a unit row writes, by Find id (without "const:") → Find's dimension key; the value is always the row's
 *  own (its chip, N62's value). The exact ones only: a constant with σ makes the result's σ (G217). */
export const PY_CONSTS: ReadonlyMap<string, string> = new Map([
  ["planck", "kg1m2s-1"],
  ["c", "m1s-1"],
  ["g_0", "m1s-2"],
  ["q_e", "A1s1"],
  ["N_A", "mol-1"],
  ["k_B", "K-1kg1m2s-2"],
  ["faraday", "A1mol-1s1"],
  ["gas_constant", "K-1kg1m2mol-1s-2"],
  ["StdT", "K1"],
  ["StdP", "kg1m-1s-2"],
]);

/** The SI base unit pint writes for each symbol of a dimension key; rad is pint's radian (a pure number there). */
const BASE: Readonly<Record<string, string>> = { kg: "kg", m: "m", s: "s", A: "A", K: "K", mol: "mol", cd: "cd", rad: "rad", bit: "bit" };

/** A dimension key ("kg1m2s-2") as pint's SI unit text ("kg*m**2/s**2"); undefined for a symbol pint has no base for. */
export function pintDim(dim: string): string | undefined {
  const up: string[] = [];
  const down: string[] = [];
  for (const [, sym, pow] of dim.matchAll(/([A-Za-z]+)(-?\d+)/g)) {
    const base = BASE[sym as string];
    if (base === undefined) return undefined;
    const n = Number(pow);
    if (n !== 0) (n > 0 ? up : down).push(Math.abs(n) === 1 ? base : `${base}**${Math.abs(n)}`);
  }
  const num = up.join("*") || "1";
  return down.length === 0 ? num : `${num}/${down.length === 1 ? down[0] : `(${down.join("*")})`}`;
}

/** Why a slot is not translated: the unit (with its prefix) that has no entry, or a power pint is not given here. */
export class PyUnitMissing extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

/** A slot that is one absolute temperature and nothing else (°C, °F alone): its pint name, else undefined. */
export function absTemp(slot: UnitSlot): string | undefined {
  const t = slot.tokens[0];
  if (slot.tokens.length !== 1 || slot.per !== undefined || !t || t.prefix !== undefined || (t.power ?? "1") !== "1") return undefined;
  return PY_TEMPS.get(t.unit)?.abs;
}

/** One token as pint's name and its whole power (1 when none); throws PyUnitMissing. */
function token(t: UnitToken): { name: string; power: number } {
  const power = t.power ?? "1";
  if (!/^-?\d+$/.test(power)) throw new PyUnitMissing(`the power ${power} of a unit`);
  const temp = PY_TEMPS.get(t.unit);
  const base = temp ? temp.delta : PY_UNITS.get(t.unit);
  if (t.prefix === undefined) {
    if (base === undefined) throw new PyUnitMissing(`unit ${t.unit}`);
    return { name: base, power: Number(power) };
  }
  const pfx = PY_PREFIXES.get(t.prefix);
  if (base === undefined || pfx === undefined || !PY_PREFIXED.has(t.unit)) throw new PyUnitMissing(`unit ${t.prefix}${t.unit}`);
  return { name: `${pfx}${base}`, power: Number(power) };
}

/** A slot's tokens split at its ÷: each as pint's name and its power (a token below the ÷ with its power negated). */
function factors(slot: UnitSlot): { name: string; power: number }[] {
  return slot.tokens.map((t, i) => {
    const f = token(t);
    return slot.per !== undefined && i >= slot.per ? { ...f, power: -f.power } : f;
  });
}

const isName = (s: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);

/** A slot as Python: a product of `ureg.<name>` (`ureg('<text>')` for a name with an operator), each with its power;
 *  p is Python's precedence of the text (5 an atom, 4 a power, 2 a product). Throws PyUnitMissing. */
export function pintAttr(slot: UnitSlot): { s: string; p: number } {
  const fs = factors(slot);
  if (fs.length === 0) throw new PyUnitMissing("an empty slot");
  const one = (name: string, power: number): string => {
    const u = isName(name) ? `ureg.${name}` : `ureg('${name}')`;
    return power === 1 ? u : `${u}**${power < 0 ? `(${power})` : power}`;
  };
  const up = fs.filter((f) => f.power > 0).map((f) => one(f.name, f.power));
  const down = fs.filter((f) => f.power < 0).map((f) => one(f.name, -f.power));
  if (down.length === 0) return up.length === 1 ? { s: up[0] as string, p: fs[0]?.power === 1 ? 5 : 4 } : { s: up.join("*"), p: 2 };
  const den = down.length === 1 ? (down[0] as string) : `(${down.join("*")})`;
  return { s: `${up.length ? up.join("*") : "1"}/${den}`, p: 2 };
}

/** A slot as pint's unit text, for `.to('…')`: `lb`, `km/h`, `degF` (an absolute temperature alone keeps its offset). */
export function pintText(slot: UnitSlot): string {
  const abs = absTemp(slot);
  if (abs !== undefined) return abs;
  const fs = factors(slot);
  if (fs.length === 0) throw new PyUnitMissing("an empty slot");
  const one = (name: string, power: number): string => {
    const n = isName(name) ? name : `(${name})`;
    return power === 1 ? n : `${n}**${power}`;
  };
  const up = fs.filter((f) => f.power > 0).map((f) => one(f.name, f.power));
  const down = fs.filter((f) => f.power < 0).map((f) => one(f.name, -f.power));
  if (down.length === 0) return up.join("*");
  return `${up.length ? up.join("*") : "1"}/${down.length === 1 ? down[0] : `(${down.join("*")})`}`;
}
