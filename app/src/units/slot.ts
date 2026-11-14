// SPDX-License-Identifier: GPL-3.0-or-later
// R24a: the unit slot's model (docs/archive/r9-unit-pad.md section 2, docs/04 4.3 "Grammar per slot"). Its input is
// pad actions, never keys (R24b maps the pad's cells to them, R24c drives the entry); its state is G16's UnitSlot,
// a token list of Find ids, never text. The LaTeX it gives is output only (the entry writes it with setPromptValue),
// and the reading in words comes from Find's titles, with a prefixed pair outside Find's list marked (r7 5.4 guard 3).
// Plain TS, loaded with the unit view (nothing in the start chunk imports it).
import type { IndexItem } from "../find/types.ts";
import { unitText, type UnitMessageKey } from "../i18n/enUnits.ts";
import type { UnitSlot, UnitToken } from "./types.ts";

/** A press on the unit pad, as R24b hands it on. `power` -1 is ⁻¹; `delete` is ⌫. × has no action: units in a row
 *  multiply, so the dot it types changes nothing. */
export type PadAction =
  | { do: "prefix"; id: string }
  | { do: "unit"; id: string }
  | { do: "pair"; prefix: string; id: string }
  | { do: "per" }
  | { do: "power"; n: 2 | 3 | 4 | -1 }
  | { do: "sqrt" }
  | { do: "delete" };

/** `back`: ⌫ on an empty slot changed nothing; the view steps to the slot before (R118, as ⌫ at the start of a box on
 *  the entry line), or the key is dead on the first slot. */
export type SlotResult = { ok: true; back?: true } | { ok: false; key: UnitMessageKey; message: string };

/** What the model needs of one Find unit or prefix: its symbol as LaTeX, its name in words, and from the Find index
 *  its exact factor to SI base units (`si`, "1/1000", "16129*pi/10^14") and a unit's dimension key (`dim`). */
export interface SlotName {
  latex: string;
  words: string;
  si?: string;
  dim?: string;
}

/** The Find items the slot may hold: units and prefixes by id (without "unit:", "pfx:"). A prefixed pair is in
 *  Find's list when `units` has the prefix id followed by the unit id ("k" + "m" = "km") and that unit is the pair:
 *  the same dimension, and its factor the prefix's times the unit's, exactly (m + in is not min, d + B is not dB). */
export interface SlotCatalogue {
  units: ReadonlyMap<string, SlotName>;
  prefixes: ReadonlyMap<string, SlotName>;
  /** R313: the names of Find's units and prefixes that a keyboard types (letters only, as cased: `km`, `kWh`, `psi`,
   *  `hour`), each to its id; a name two units share goes to the one Find ranks first (tier, then id). Absent: no
   *  letters are read (a catalogue built by hand). */
  symbols?: { units: ReadonlyMap<string, string>; prefixes: ReadonlyMap<string, string> };
}

export interface ReadingPart {
  text: string;
  /** A prefixed pair outside Find's list (`Mm`, `Ms`, `kpsi`): drawn in the warning colour. */
  marked: boolean;
}

export interface Reading {
  text: string;
  parts: ReadingPart[];
  marked: boolean;
}

/** The symbol of a chip (`\unit{oC}{\mathrm{°C}}` → `°C`) as LaTeX inside \mathrm: `_` escaped, and the degree
 *  without the 1 its chip carries (`1°`, so that ° does not stand alone in Home). */
function symbolLatex(it: IndexItem): string {
  const m = /\{\\mathrm\{(.+)\}\}$/.exec(it.insert ?? "");
  const s = m?.[1] ?? it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1);
  return s.replace(/^1(?=\D)/, "").replace(/(?<!\\)_/g, "\\_");
}

/** Words of a unit's name that keep their capital: names of people and calendars. */
const PROPER = new Set(["Celsius", "Fahrenheit", "Rankine", "Réaumur", "Planck", "Gregorian", "Julian", "British", "American", "Johnson"]);

/** A Find title in words: "Kilo (10^3)" → "kilo", "Degree Celsius" → "degree Celsius", "Nautical Mile" → "nautical
 *  mile", "U.S. Survey Inch" → "U.S. survey inch". A word keeps its capital when it has a second one (an acronym:
 *  "TNT", "U.S.") or is a name (PROPER); "Watt hour" and "Ohm" lose only the first. */
function titleWords(title: string): string {
  const t = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return t.replace(/\p{L}[\p{L}.]*/gu, (w) =>
    /^\p{Lu}/u.test(w) && !/^.[\p{L}.]*\p{Lu}/u.test(w) && !PROPER.has(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w);
}

/** An exact factor n/d·π^pi (not reduced: compared by cross-multiplying). */
interface Exact { n: bigint; d: bigint; pi: number }

/** The Find index's `si` text as an exact factor: integers, `pi`, `*`, `/`, `^` with an integer, parentheses
 *  ("201168/125", "16129*pi/10^14", "44173801/(21362355120000000000000*pi)"). Anything else ("1+5463/20", the
 *  offset of °C) is undefined: such a unit is never part of a pair. */
function exactFactor(text: string): Exact | undefined {
  const toks = text.replace(/\s+/g, "").match(/\d+|pi|[-*/^()]|./g) ?? [];
  let i = 0;
  const mul = (a: Exact, b: Exact, inv: boolean): Exact =>
    inv ? { n: a.n * b.d, d: a.d * b.n, pi: a.pi - b.pi } : { n: a.n * b.n, d: a.d * b.d, pi: a.pi + b.pi };
  const atom = (): Exact | undefined => {
    const t = toks[i++];
    if (t === "pi") return { n: 1n, d: 1n, pi: 1 };
    if (t !== undefined && /^\d+$/.test(t)) return { n: BigInt(t), d: 1n, pi: 0 };
    if (t !== "(") return undefined;
    const e = expr();
    return toks[i++] === ")" ? e : undefined;
  };
  const power = (): Exact | undefined => {
    const a = atom();
    if (!a || toks[i] !== "^") return a;
    i++;
    const neg = toks[i] === "-" ? (i++, true) : false;
    const k = toks[i++];
    if (k === undefined || !/^\d+$/.test(k) || Number(k) > 64) return undefined;
    let r: Exact = { n: 1n, d: 1n, pi: 0 };
    for (let j = 0; j < Number(k); j++) r = mul(r, a, false);
    return neg ? mul({ n: 1n, d: 1n, pi: 0 }, r, true) : r;
  };
  const expr = (): Exact | undefined => {
    let a = power();
    while (a && (toks[i] === "*" || toks[i] === "/")) {
      const inv = toks[i++] === "/";
      const b = power();
      a = b && b.n !== 0n ? mul(a, b, inv) : undefined;
    }
    return a;
  };
  const e = expr();
  return e && i === toks.length && e.d !== 0n ? e : undefined;
}

/** Whether `pair` is `prefix` times `unit`: the same dimension, and the factors equal as exact fractions. */
function isPair(pair: SlotName, prefix: SlotName | undefined, unit: SlotName | undefined): boolean {
  if (!prefix || !unit || pair.dim === undefined || pair.dim !== unit.dim) return false;
  const [p, a, b] = [pair.si, prefix.si, unit.si].map((x) => (x === undefined ? undefined : exactFactor(x)));
  if (!p || !a || !b) return false;
  return p.pi === a.pi + b.pi && p.n * a.d * b.d === a.n * b.n * p.d;
}

/** A Find unit that is a prefix and a unit of Find's list (R24d: `MPa` is M and Pa, `kWh` is k and Wh): the pair
 *  the slot holds as tokens, else undefined. The longest prefix first (`da` before `d`); only an exact pair counts
 *  (isPair: `min` is no milli-inch, `dB` no deci-byte). */
export function splitPair(cat: SlotCatalogue, id: string): { prefix: string; unit: string } | undefined {
  const pair = cat.units.get(id);
  if (!pair) return undefined;
  const ids = [...cat.prefixes.keys()].filter((p) => id.length > p.length && id.startsWith(p)).sort((a, b) => b.length - a.length);
  for (const prefix of ids) {
    const unit = id.slice(prefix.length);
    if (isPair(pair, cat.prefixes.get(prefix), cat.units.get(unit))) return { prefix, unit };
  }
  return undefined;
}

/** The catalogue from the Find index's units and prefixes. */
export function slotCatalogue(items: readonly IndexItem[]): SlotCatalogue {
  const units = new Map<string, SlotName>();
  const prefixes = new Map<string, SlotName>();
  const symbols = { units: new Map<string, string>(), prefixes: new Map<string, string>() };
  const ranked = [...items].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const it of ranked) {
    if (it.kind !== "unit" && it.kind !== "pfx") continue;
    const id = it.id.slice(it.id.indexOf(":") + 1);
    (it.kind === "unit" ? units : prefixes).set(id, {
      latex: symbolLatex(it), words: titleWords(it.title),
      ...(it.si !== undefined ? { si: it.si } : {}), ...(it.dim !== undefined ? { dim: it.dim } : {}),
    });
    const to = it.kind === "unit" ? symbols.units : symbols.prefixes;
    for (const n of it.names) if (isLetters(n) && !to.has(n)) to.set(n, id);
  }
  return { units, prefixes, symbols };
}

/** R313: `s` is ASCII letters only, what a keyboard types into a slot's letter run (by char code: no pattern, G88). */
export function isLetters(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) | 32; // (A–Z to a–z)
    if (c < 97 || c > 122) return false;
  }
  return s.length > 0;
}

/** R313: a run of letters typed on a hardware keyboard as a slot factor, the way Find reads an exact symbol: the whole
 *  run as a unit's name (`km`, `kWh`, `psi`; a unit that is a prefix and a unit of Find's list as both, as a pick from
 *  Find gives it: km is k and m), else the longest prefix name and a unit's name for the rest (`mN`, as the pad's prefix
 *  and unit cells give it). Exact, as cased (`Ms` is no ms); undefined: no unit. */
export function readSymbol(cat: SlotCatalogue, text: string): { prefix?: string; unit: string } | undefined {
  const sym = cat.symbols;
  if (!sym) return undefined;
  const whole = sym.units.get(text);
  if (whole !== undefined) return splitPair(cat, whole) ?? { unit: whole };
  for (let i = text.length - 1; i >= 1; i--) {
    const prefix = sym.prefixes.get(text.slice(0, i));
    const unit = sym.units.get(text.slice(i));
    if (prefix !== undefined && unit !== undefined && !splitPair(cat, unit)) return { prefix, unit };
  }
  return undefined;
}

type Pending = { kind: "prefix"; id: string } | { kind: "sqrt" };

interface Factor {
  prefix?: string;
  unit: string;
  /** The integer power the keys gave (², ³, ⁴, ⁻¹); with `root` the power is exp/2. */
  exp: number;
  root: boolean;
  /** The armed presses this unit took, in their order: ⌫ on the unit arms them again. */
  took: Pending[];
}

/** R313: the letters typed into the slot since the last other key (`text`), with the slot's armed presses when it began
 *  (`took`) and the factor it reads as, the slot's last (none: the run is no unit, and stays as typed, marked). */
interface Run { text: string; took: Pending[]; factor?: Factor }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** A factor's power as UnitToken text ("2", "-1", "1/2", "-3/2"), the sign turned when `negate`. */
function powerText(f: Factor, negate: boolean): string {
  const num = negate ? -f.exp : f.exp;
  const den = f.root ? 2 : 1;
  const g = gcd(num, den);
  return den / g === 1 ? String(num / g) : `${num / g}/${den / g}`;
}

const refuse = (key: UnitMessageKey, vars?: Readonly<Record<string, string>>): SlotResult =>
  ({ ok: false, key, message: unitText(key, vars) });
const OK: SlotResult = { ok: true };
const BACK: SlotResult = { ok: true, back: true };

export class SlotModel {
  readonly #cat: SlotCatalogue;
  #factors: Factor[] = [];
  /** Index of the first factor below the ÷; absent: no ÷. Equal to the length: a ÷ with nothing after it yet. */
  #per: number | undefined;
  #pending: Pending[] = [];
  #run: Run | undefined;

  /** A new slot, empty or as `from` (a line keeps its slots, so the units key shows them again). Throws on a slot
   *  the pad cannot make (a power other than an integer or n/2, a ÷ place outside the tokens). */
  constructor(catalogue: SlotCatalogue, from?: UnitSlot) {
    this.#cat = catalogue;
    if (!from) return;
    if (from.per !== undefined && (from.per < 0 || from.per > from.tokens.length || !Number.isInteger(from.per))) throw new Error(`bad ÷ place ${from.per}`);
    this.#per = from.per;
    for (const t of from.tokens) {
      const m = /^(-?\d+)(?:\/(\d+))?$/.exec(t.power ?? "1");
      const num = Number(m?.[1]), den = Number(m?.[2] ?? "1");
      if (!m || (den !== 1 && den !== 2) || num === 0) throw new Error(`a power the pad cannot make: ${t.power ?? ""}`);
      const root = den === 2;
      const took: Pending[] = [...(root ? [{ kind: "sqrt" } as const] : []), ...(t.prefix !== undefined ? [{ kind: "prefix", id: t.prefix } as const] : [])];
      this.#factors.push({ ...(t.prefix !== undefined ? { prefix: t.prefix } : {}), unit: t.unit, exp: num, root, took });
    }
  }

  /** One pad press. A refused press leaves the slot as it was; its message is from the i18n table. R313: a press ends a
   *  letter run first (refused while the run is no unit); ⌫ takes the run's last letter. */
  apply(a: PadAction): SlotResult {
    if (this.#run) {
      if (a.do === "delete") {
        this.untype();
        return OK;
      }
      const r = this.endRun();
      if (!r.ok) return r;
    }
    switch (a.do) {
      case "prefix": {
        if (!this.#cat.prefixes.has(a.id)) return refuse("units.slot.unknown", { unit: a.id });
        const i = this.#pending.findIndex((p) => p.kind === "prefix");
        const was = this.#pending[i];
        if (was?.kind === "prefix" && was.id === a.id) this.#pending.splice(i, 1); // the same again disarms
        else if (was) this.#pending[i] = { kind: "prefix", id: a.id }; // another replaces it
        else this.#pending.push({ kind: "prefix", id: a.id });
        return OK;
      }
      case "sqrt": {
        const i = this.#pending.findIndex((p) => p.kind === "sqrt");
        if (i >= 0) this.#pending.splice(i, 1);
        else this.#pending.push({ kind: "sqrt" });
        return OK;
      }
      case "unit": {
        if (!this.#cat.units.has(a.id)) return refuse("units.slot.unknown", { unit: a.id });
        const prefix = this.#armedPrefix();
        this.#factors.push({ ...(prefix !== undefined ? { prefix } : {}), unit: a.id, exp: 1, root: this.#pending.some((p) => p.kind === "sqrt"), took: this.#pending });
        this.#pending = [];
        return OK;
      }
      case "pair": {
        if (!this.#cat.prefixes.has(a.prefix)) return refuse("units.slot.unknown", { unit: a.prefix });
        if (!this.#cat.units.has(a.id)) return refuse("units.slot.unknown", { unit: a.id });
        this.#pending = this.#pending.filter((p) => p.kind !== "prefix"); // (a pair replaces an armed prefix, never disarms it)
        this.apply({ do: "prefix", id: a.prefix });
        return this.apply({ do: "unit", id: a.id });
      }
      case "per": {
        const pending = this.#pendingRefusal();
        if (pending) return pending;
        if (this.#per !== undefined) return refuse("units.slot.secondPer");
        this.#per = this.#factors.length;
        return OK;
      }
      case "power": {
        const pending = this.#pendingRefusal();
        if (pending) return pending;
        const last = this.#factors[this.#factors.length - 1];
        if (!last || this.#per === this.#factors.length) return refuse("units.slot.powerAlone");
        last.exp = a.n === -1 ? -last.exp : Math.sign(last.exp) * a.n;
        return OK;
      }
      case "delete": {
        if (this.empty) return BACK;
        if (this.#pending.length) this.#pending.pop();
        else if (this.#per !== undefined && this.#per === this.#factors.length) this.#per = undefined;
        else {
          const last = this.#factors[this.#factors.length - 1];
          if (last && last.exp !== 1) last.exp = 1;
          else if (last) {
            this.#factors.pop();
            this.#pending = [...last.took];
          }
        }
        return OK;
      }
    }
  }

  /** R313: a letter typed on a hardware keyboard: it starts or extends the slot's letter run, read again as a unit at
   *  each letter (readSymbol), so the slot and its reading follow every letter. The run's factor takes the armed prefix
   *  and √ as a unit cell does (a prefix of its own replaces the armed one, as a pair does). */
  type(ch: string): void {
    const run = this.#run ?? { text: "", took: this.#pending };
    this.#unread(run);
    run.text += ch;
    this.#run = run;
    this.#readRun(run);
  }

  /** R313: ⌫ in a letter run: its last letter (the run's last letter gone, the slot is as before it); false: no run. */
  untype(): boolean {
    const run = this.#run;
    if (!run) return false;
    this.#unread(run);
    run.text = run.text.slice(0, -1);
    if (run.text) this.#readRun(run);
    else this.#run = undefined;
    return true;
  }

  /** R313: the letter run ends (any key but a letter or ⌫): one that reads as a unit is that factor from now on; one
   *  that does not stays, and is refused with its letters. */
  endRun(): SlotResult {
    const run = this.#run;
    if (!run) return OK;
    if (!run.factor) return refuse("units.slot.notUnit", { letters: run.text });
    this.#run = undefined;
    return OK;
  }

  /** R313: Esc: the run is dropped, the slot as before it. */
  dropRun(): void {
    if (this.#run) this.#unread(this.#run);
    this.#run = undefined;
  }

  /** R313: a letter run is open. */
  get typing(): boolean {
    return this.#run !== undefined;
  }

  #unread(run: Run): void {
    if (!run.factor) return;
    this.#factors.pop();
    this.#pending = run.took;
    delete run.factor;
  }

  #readRun(run: Run): void {
    const s = readSymbol(this.#cat, run.text);
    if (!s) return;
    const prefix = s.prefix ?? this.#armedPrefix();
    run.factor = { ...(prefix !== undefined ? { prefix } : {}), unit: s.unit, exp: 1, root: run.took.some((p) => p.kind === "sqrt"), took: run.took };
    this.#factors.push(run.factor);
    this.#pending = [];
  }

  /** Whether the slot can be left (Enter, ▶, evaluate): not with a prefix or √ alone, nor a ÷ with nothing after it,
   *  nor with letters that are no unit (R313). */
  check(): SlotResult {
    if (this.#run && !this.#run.factor) return refuse("units.slot.notUnit", { letters: this.#run.text });
    return this.#pendingRefusal() ?? (this.#per !== undefined && this.#per === this.#factors.length ? refuse("units.slot.perEmpty") : OK);
  }

  /** The slot for the evaluator (G16's UnitSlot). A ÷ with nothing after it is left out; a ÷ on an empty slot (1/s)
   *  becomes the powers negated with no ÷, since the evaluator wants a numerator. */
  get slot(): UnitSlot {
    const per = this.#per === this.#factors.length ? undefined : this.#per;
    const tokens = this.#factors.map((f): UnitToken => {
      const power = powerText(f, per === 0);
      return { ...(f.prefix !== undefined ? { prefix: f.prefix } : {}), unit: f.unit, ...(power !== "1" ? { power } : {}) };
    });
    return per === undefined || per === 0 ? { tokens } : { tokens, per };
  }

  /** The armed prefix (highlighted on the pad) and whether √ is armed. */
  get armed(): { prefix?: string; sqrt: boolean } {
    const prefix = this.#armedPrefix();
    return { ...(prefix !== undefined ? { prefix } : {}), sqrt: this.#pending.some((p) => p.kind === "sqrt") };
  }

  get empty(): boolean {
    return !this.#factors.length && this.#per === undefined && !this.#pending.length && !this.#run;
  }

  /** The slot as LaTeX (output only): factors joined by ·, the ÷ as a stacked fraction, the armed prefix or √ in
   *  `pas-armed`, a pair outside Find's list in `pas-rare`, an empty denominator as `pas-empty` □. */
  get latex(): string {
    const parts = this.#factors.map((f) => this.#factorLatex(f));
    const armed = this.#pending.map((p) =>
      p.kind === "prefix" ? `\\class{pas-armed}{\\mathrm{${this.#cat.prefixes.get(p.id)?.latex ?? p.id}}}` : "\\class{pas-armed}{\\sqrt{\\square}}");
    // R313: letters that are no unit, as typed and marked (a run that reads as a unit is its factor)
    if (this.#run && !this.#run.factor) armed.push(`\\class{pas-rare}{\\mathrm{${this.#run.text}}}`);
    if (this.#per === undefined) return [...parts, ...armed].join("\\cdot");
    const num = parts.slice(0, this.#per).join("\\cdot") || "1";
    const den = [...parts.slice(this.#per), ...armed].join("\\cdot") || "\\class{pas-empty}{\\square}";
    return `\\frac{${num}}{${den}}`;
  }

  /** The reading in words from Find's titles ("kilonewton meter", "joule per kilogram kelvin"): the factors with a
   *  positive power, then "per" and the rest, whichever side of the ÷ they were typed on. */
  get reading(): Reading {
    const per = this.#per ?? this.#factors.length;
    const above: ReadingPart[] = [];
    const below: ReadingPart[] = [];
    this.#factors.forEach((f, i) => {
      const exp = i >= per ? -f.exp : f.exp;
      const names = this.#names(f);
      const { marked } = names;
      // G37: °C, °F (an offset in its factor) with another unit or a power is an interval, as the evaluator reads it.
      const affine = this.#cat.units.get(f.unit)?.si?.includes("+") === true;
      const words = affine && (this.#factors.length > 1 || exp !== 1 || f.root) ? unitText("units.read.interval", { u: names.words }) : names.words;
      let text = Math.abs(exp) === 1 ? words
        : Math.abs(exp) === 2 ? unitText("units.read.square", { u: words })
        : Math.abs(exp) === 3 ? unitText("units.read.cube", { u: words })
        : Math.abs(exp) === 4 ? unitText("units.read.fourth", { u: words })
        : unitText("units.read.power", { u: words, p: String(Math.abs(exp)) });
      if (f.root) text = unitText("units.read.root", { u: text });
      (exp > 0 ? above : below).push({ text, marked });
    });
    if (this.#run && !this.#run.factor) (this.#per === undefined ? above : below).push({ text: this.#run.text, marked: true }); // R313
    const parts = below.length ? [...above, { text: unitText("units.read.per"), marked: false }, ...below] : above;
    return { text: parts.map((p) => p.text).join(" "), parts, marked: parts.some((p) => p.marked) };
  }

  #armedPrefix(): string | undefined {
    const p = this.#pending.find((x) => x.kind === "prefix");
    return p?.kind === "prefix" ? p.id : undefined;
  }

  #pendingRefusal(): SlotResult | undefined {
    if (this.#pending.some((p) => p.kind === "prefix")) return refuse("units.slot.prefixAlone");
    if (this.#pending.length) return refuse("units.slot.rootAlone");
    return undefined;
  }

  /** A factor's words, and whether it is a prefixed pair outside Find's list. A Find unit whose id is the prefix id
   *  and the unit id counts only when it is the pair (isPair): "min" is no milli-inch. */
  #names(f: Factor): { words: string; marked: boolean } {
    const unit = this.#cat.units.get(f.unit);
    const u = unit?.words ?? f.unit;
    if (f.prefix === undefined) return { words: u, marked: false };
    const prefix = this.#cat.prefixes.get(f.prefix);
    const pair = this.#cat.units.get(f.prefix + f.unit);
    if (pair && isPair(pair, prefix, unit)) return { words: pair.words, marked: false };
    return { words: (prefix?.words ?? f.prefix) + u, marked: true };
  }

  #factorLatex(f: Factor): string {
    const u = `\\mathrm{${this.#cat.units.get(f.unit)?.latex ?? f.unit}}`;
    let body = f.prefix !== undefined ? `\\mathrm{${this.#cat.prefixes.get(f.prefix)?.latex ?? f.prefix}}${u}` : u;
    if (f.root) body = `\\sqrt{${body}}`;
    if (f.exp !== 1) body += `^{${f.exp}}`;
    return this.#names(f).marked ? `\\class{pas-rare}{${body}}` : body;
  }
}
