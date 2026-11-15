// SPDX-License-Identifier: GPL-3.0-or-later
// G213: Copy as Python, the core (docs/04 2.6). Rows of the session format (G210, state/sessionLine.ts) become a sympy
// script: each row is parsed by our own parser (the tree emit.ts reads, so this sees what the app sends, never
// MathLive's text) and written through a closed allow-list, head → template. Anything not listed is not translated,
// by construction: the row becomes `# N62 NOT TRANSLATED (<reason>): <input>` and binds nothing, and a later row that
// reads what it would have bound is comment-only too (owner, 2026-11-12). Every row ends with N62's own answer as a
// comment. G214: the tier-0 Find functions with a one-to-one sympy form (FUNCTIONS), each in the row's own angle mode;
// a row that does not keep its angle mode refuses trig rather than assume radians. Units are G216, σ G217. Lazy: reached only through clipboard/impl.ts.
import { parseLatex } from "../input/parse.ts";
import { FN, oddIndex, type Json } from "../input/emit.ts";
import { ANS_KEY } from "../input/chips.ts";
import { angleInSpec, returnsAngle } from "../engine/angles.ts";

/** A chip of a row's table as the session line keeps it. */
export interface PyChip {
  value: string;
  exact: boolean;
}

/** The fields of one session line (G210) the translator reads; any can be absent or null, as in the format. */
export interface PyRow {
  view?: string | null;
  input: string;
  chips?: Record<string, PyChip> | null;
  ok: boolean;
  error?: string | null;
  exact?: string | null;
  value?: string | null;
  mark?: string | null;
  unit?: string | null;
  dim?: string | null;
  sigma?: string | null;
  /** G219: this many earlier lines were dropped before this one. */
  gap?: number | null;
  /** G211: `rad` or `deg`, the angle mode the row was worked out in; null when the row does not keep it. */
  angle?: string | null;
  /** The stored values the input read: a name here was a value when the row ran, so `name(…)` multiplied it. */
  defs?: readonly { name: string }[] | null;
  /** G213f1: the value Ans held at Enter; absent on a line written before G213f1. */
  ans?: PyChip | null;
  /** G213f1: each stored name the input read, with its full value and exactness; absent on a line written before. */
  reads?: readonly ({ name: string } & PyChip)[] | null;
}

export interface PyOptions {
  /** The app's version, for the first line. */
  app: string;
}

/** Python's own words: never a name we bind. */
const KEYWORDS = new Set(
  ("False None True and as assert async await break class continue def del elif else except finally for from global if " +
    "import in is lambda nonlocal not or pass raise return try while with yield").split(" "),
);
/** The sympy names a template may write; a user name equal to one is not bound either (it would shadow it). */
const SYMPY = new Set(["E", "I", "Integer", "Rational", "pi", "sqrt", "rad", "deg", "log", "root", "real_root", "cos", "sin"]);

/** G214, the function table: a Find tier-0 function (find/functions.yaml, by its Giac name) → its sympy function, which
 *  takes the same arguments in the same order and gives the same value. Closed: a name not here is not translated,
 *  tier 1 by construction. ln, log10 and surd are written by their own rule below (ROOT_LOG). Left out on purpose
 *  (G214 report): N62's own definitions (median, percentile, sem, irem, par, eseries, sigfig, the word operations),
 *  Giac's own conventions (dot conjugates its first argument, stddevp is the sample deviation, frac is not settled for
 *  a negative number), and what needs a list, a matrix or a free variable (the core translates none). */
// Which of them takes or gives an angle is never written here: fn() asks angles.ts, the lists emit.ts adds pasdeg by.
// Exported for G215's stage only (scripts/pydiff.ts --corrupt): its test corrupts one entry and sees the stage go red.
export const FUNCTIONS: ReadonlyMap<string, { py: string; args: number }> = new Map([
  ["sqrt", { py: "sqrt", args: 1 }],
  ["exp", { py: "exp", args: 1 }],
  ["sin", { py: "sin", args: 1 }],
  ["cos", { py: "cos", args: 1 }],
  ["tan", { py: "tan", args: 1 }],
  ["asin", { py: "asin", args: 1 }],
  ["acos", { py: "acos", args: 1 }],
  ["atan", { py: "atan", args: 1 }],
  ["sinh", { py: "sinh", args: 1 }],
  ["cosh", { py: "cosh", args: 1 }],
  ["tanh", { py: "tanh", args: 1 }],
  ["abs", { py: "Abs", args: 1 }],
  ["floor", { py: "floor", args: 1 }],
  ["ceil", { py: "ceiling", args: 1 }],
  // sympy's gcd(a, b, c) reads c as a generator, so two arguments only
  ["gcd", { py: "gcd", args: 2 }],
  ["lcm", { py: "lcm", args: 2 }],
  ["factorial", { py: "factorial", args: 1 }],
  ["comb", { py: "binomial", args: 2 }],
  // Giac's Gamma(a, x) of two arguments is the incomplete one
  ["Gamma", { py: "gamma", args: 1 }],
  ["erf", { py: "erf", args: 1 }],
]);
/** The tier-0 functions written by their own rule: ln is sympy's log, log10 is log(x, 10), surd the real root. */
const ROOT_LOG = ["ln", "log10", "surd"];
/** Every Giac name the translator reads as a function (the test checks each is a tier-0 Find function). */
export const PY_FUNCTIONS: ReadonlySet<string> = new Set([...FUNCTIONS.keys(), ...ROOT_LOG]);
for (const f of FUNCTIONS.values()) SYMPY.add(f.py);

/** Python ints stay exact under + - * and ** n; a division or a negative power of two of them would be a float. */
type Kind = "int" | "sym";
/** Precedence as Python reads it: 1 + -, 2 * /, 3 unary minus, 4 **, 5 an atom. */
interface Out {
  s: string;
  p: number;
  k: Kind;
}

class NotTranslated extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}
const no = (reason: string): never => {
  throw new NotTranslated(reason);
};

/** What a Python name holds: the line that set it and its view, or that the line which would have set it is not here. */
/** G218: `def` when the line bound a stored name to the value it read (a sync file's stored value), not to its result. */
type Binding = { line: number; view: string; k: Kind; def?: PyChip } | { unknown: number };
/** A translated row: the name it bound and what that holds. */
interface Line {
  name: string;
  k: Kind;
}

const wrap = (o: Out, min: number): string => (o.p < min ? `(${o.s})` : o.s);
const isHead = (e: Json, h: string): e is Json[] => Array.isArray(e) && e[0] === h;
/** Row r's full value in the kind of `c` (exact text against exact, a decimal against a row without one), as a chip
 *  compares it: undefined when the row has none of that kind. */
const fullOf = (r: PyRow | undefined, c: PyChip): string | null | undefined => (c.exact ? r?.exact : r?.exact ? undefined : r?.value);
const numText = (e: Json): string | undefined => (typeof e === "object" && !Array.isArray(e) && "num" in e ? e.num : undefined);

/** A number literal: a whole number as a Python int, a decimal as sympy's exact Rational of its digits. */
function literal(text: string): Out {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.replace(/[\s_]/g, ""));
  if (!m || (m[2] === "" && (m[3] ?? "") === "")) return no(`the number ${text} is not translated`);
  const int = (m[2] ?? "").replace(/^0+(?=\d)/, "") || "0";
  const frac = m[3] ?? "";
  const body: Out =
    frac === "" && m[4] === undefined ? { s: int, p: 5, k: "int" } : { s: `Rational('${int}${frac ? `.${frac}` : ""}${m[4] !== undefined ? `e${m[4]}` : ""}')`, p: 5, k: "sym" };
  return m[1] === "-" ? { s: `-${body.s}`, p: 3, k: body.k } : body;
}

/** The fixed symbols: MathJSON name → sympy name. A Map, closed: `in` on an object would also find `toString` and the
 *  rest of Object.prototype (G213 fix round 3). */
const CONST = new Map([["Pi", "pi"], ["ExponentialE", "E"], ["ImaginaryUnit", "I"]]);

/** The translation of one row; it collects the sympy names it uses. */
class Row {
  readonly uses = new Set<string>();
  /** A chip went in as its own value (`# an earlier result`). */
  earlier = false;
  /** G218: the stored names this row binds before its own line, to the value it read: name → its line and value. */
  readonly defs = new Map<string, { code: string; k: Kind; value: PyChip }>();
  private readonly t: Translator;
  private readonly i: number;
  private readonly keys: readonly string[];
  // plain fields, no parameter properties: Node's type stripping runs this file in G215's stage (scripts/pydiff.ts)
  constructor(t: Translator, i: number, keys: readonly string[]) {
    this.t = t;
    this.i = i;
    this.keys = keys;
  }

  private use(name: string): string {
    this.uses.add(name);
    return name;
  }

  /** A number literal, with its import. */
  private lit(text: string): Out {
    const o = literal(text);
    if (o.k === "sym") this.use("Rational");
    return o;
  }

  private div(a: Out, b: Out): Out {
    if (a.k === "int" && b.k === "int") return { s: `${this.use("Rational")}(${a.s}, ${b.s})`, p: 5, k: "sym" };
    return { s: `${wrap(a, 2)}/${wrap(b, 4)}`, p: 2, k: "sym" };
  }

  private pow(base: Out, ex: Out, exJson: Json): Out {
    if (base.k === "int" && ex.k === "int") {
      if (/^\d+$/.test(numText(exJson) ?? "")) return { s: `${wrap(base, 5)}**${ex.s}`, p: 4, k: "int" };
      return { s: `${this.use("Integer")}(${base.s})**${wrap(ex, 5)}`, p: 4, k: "sym" };
    }
    return { s: `${wrap(base, 5)}**${wrap(ex, 5)}`, p: 4, k: "sym" };
  }

  /** The allow-list: each head this package translates, and nothing else. */
  ser(e: Json): Out {
    if (typeof e === "number") return Number.isSafeInteger(e) ? this.lit(String(e)) : no(`the number ${e} is not translated`);
    if (typeof e === "string") return this.name(e);
    if (!Array.isArray(e)) return "num" in e ? this.lit(e.num) : "sym" in e ? this.name(e.sym) : no("a string is not translated");
    const head = e[0] as string;
    const args = e.slice(1) as Json[];
    const one = (): Json => (args.length === 1 ? (args[0] as Json) : no(`${head} with ${args.length} arguments is not translated`));
    const two = (): [Json, Json] => (args.length === 2 ? [args[0] as Json, args[1] as Json] : no(`${head} with ${args.length} arguments is not translated`));
    switch (head) {
      case "Add": {
        // a Negate after the first term is written as a minus; a term with its own leading minus is bracketed
        const terms = args.map((a, n) => (n > 0 && isHead(a, "Negate") && a.length === 2 ? { neg: true, o: this.ser(a[1] as Json) } : { neg: false, o: this.ser(a) }));
        if (terms.length < 2) return no("Add with one term is not translated");
        const s = terms.map(({ neg, o }, n) => (n === 0 ? o.s : `${neg ? " - " : " + "}${o.p === 3 ? `(${o.s})` : wrap(o, 2)}`));
        return { s: s.join(""), p: 1, k: terms.every(({ o }) => o.k === "int") ? "int" : "sym" };
      }
      case "Subtract": {
        const [a, b] = two().map((x) => this.ser(x)) as [Out, Out];
        return { s: `${a.s} - ${b.p === 3 ? `(${b.s})` : wrap(b, 2)}`, p: 1, k: a.k === "int" && b.k === "int" ? "int" : "sym" };
      }
      case "Negate": {
        const a = this.ser(one());
        return { s: `-${wrap(a, 5)}`, p: 3, k: a.k };
      }
      case "Multiply": {
        const outs = args.map((a) => this.ser(a));
        if (outs.length < 2) return no("Multiply with one factor is not translated");
        return { s: outs.map((o, n) => wrap(o, n === 0 ? 3 : 4)).join("*"), p: 2, k: outs.every((o) => o.k === "int") ? "int" : "sym" };
      }
      case "Divide":
      case "Rational": {
        const [a, b] = two();
        return this.div(this.ser(a), this.ser(b));
      }
      case "Power": {
        const [a, b] = two();
        return this.pow(this.ser(a), this.ser(b), b);
      }
      case "Square":
        return this.pow(this.ser(one()), { s: "2", p: 5, k: "int" }, { num: "2" });
      case "Sqrt":
        return { s: `${this.use("sqrt")}(${this.ser(one()).s})`, p: 5, k: "sym" };
      case "Delimiter":
        return this.ser(one());
      case "Chip":
        return this.chip(one());
      case "Call": {
        const [name, ...rest] = args;
        return typeof name === "string" ? this.fn(name, rest) : no("a call is not translated");
      }
      case "Log": {
        // \log is base 10 (emit.ts Log), \log_b base b; plain sympy has no log10
        if (args.length === 1) return this.fn("log10", args);
        const [x, b] = two();
        return { s: `${this.use("log")}(${this.ser(x).s}, ${this.ser(b).s})`, p: 5, k: "sym" };
      }
      case "Root": {
        const [x, n] = two();
        return this.root(x, n, false);
      }
      case "Degrees": {
        // u° is u in the mode's own unit (emit.ts Degrees): u itself in DEG, rad(u) in RAD
        const u = this.ser(one());
        return this.angle() === "deg" ? u : { s: `${this.use("rad")}(${u.s})`, p: 5, k: "sym" };
      }
      case "PolarComplex": {
        // r∡θ, θ in the mode's unit (emit.ts PolarComplex): r*(cos(θ) + i*sin(θ))
        const [r, th] = two();
        const t = this.angleIn(this.ser(th).s);
        const z = `${this.use("cos")}(${t}) + ${this.use("I")}*${this.use("sin")}(${t})`;
        return { s: `${wrap(this.ser(r), 3)}*(${z})`, p: 2, k: "sym" };
      }
      default: {
        // the parser's own heads (`\sin`, `\left|x\right|`, `3!`, `\binom`) by emit.ts's own FN, so this writes the
        // function the app sends Giac; a Giac name outside PY_FUNCTIONS stays not translated
        const name = Object.hasOwn(FN, head) ? FN[head] : undefined;
        return name !== undefined && PY_FUNCTIONS.has(name) ? this.fn(name, args) : no(`${head} is not translated`);
      }
    }
  }

  /** The row's angle mode; a row that does not keep it refuses rather than assume radians. */
  private angle(): "rad" | "deg" {
    const a = this.t.rows[this.i]?.angle;
    return a === "rad" || a === "deg" ? a : no("angle not known");
  }

  /** An angle as the mode reads it, in radians for sympy. */
  private angleIn(s: string): string {
    return this.angle() === "deg" ? `${this.use("rad")}(${s})` : s;
  }

  /** A call of the function table, or of the three written by their own rule. */
  private fn(name: string, args: Json[]): Out {
    const arity = (n: number): void => {
      if (args.length !== n) no(`${name} with ${args.length} argument${args.length === 1 ? "" : "s"} is not translated`);
    };
    if (name === "ln" || name === "log10") {
      arity(1);
      const x = this.ser(args[0] as Json).s;
      return { s: `${this.use("log")}(${name === "ln" ? x : `${x}, 10`})`, p: 5, k: "sym" };
    }
    if (name === "surd") {
      arity(2);
      return this.root(args[0] as Json, args[1] as Json, true);
    }
    const f = FUNCTIONS.get(name);
    if (!f) return no(`${name} is not translated`);
    arity(f.args);
    // the angle tags are angles.ts's (G214 fix round 2): its first argument an angle in the one form [0, 1] the table
    // writes, any other form refused; its result an angle when emit.ts divides it by pasdeg
    const spec = angleInSpec(name);
    if (spec && (spec[0] !== 0 || spec[1] !== 1)) no(`${name} takes its angle in a form that is not translated`);
    const outs = args.map((a) => this.ser(a).s);
    if (spec) outs[0] = this.angleIn(outs[0] as string);
    const call = `${this.use(f.py)}(${outs.join(", ")})`;
    return { s: returnsAngle(name) && this.angle() === "deg" ? `${this.use("deg")}(${call})` : call, p: 5, k: "sym" };
  }

  /** An n-th root as N62 takes it (emit.ts Root): an odd whole index is the real root (sympy's real_root; its plain
   *  root where the radicand is a number literal not below 0, the same value); any other index the principal root,
   *  x^(1/n). surd is the real root and nothing else. */
  private root(x: Json, n: Json, surd: boolean): Out {
    // emit.ts's own rule decides surd against x^(1/n), so the two never disagree on which index is odd
    const odd = oddIndex(n);
    if (surd && !odd) return no("surd with an index that is not an odd whole number is not translated");
    const xs = this.ser(x).s;
    const plain = !odd || numText(x) !== undefined;
    return { s: `${this.use(plain ? "root" : "real_root")}(${xs}, ${this.ser(n).s})`, p: 5, k: "sym" };
  }

  /** A symbol: a fixed constant, or a name an earlier line of this file bound. */
  private name(n: string): Out {
    const fixed = CONST.get(n);
    if (fixed !== undefined) return { s: this.use(fixed), p: 5, k: "sym" };
    const own = this.defs.get(n);
    if (own) return { s: n, p: 5, k: own.k };
    try {
      return this.bound(n);
    } catch (err) {
      // G218: a sync file binds what the file does not hold to the value this row read, right before the row
      const d = err instanceof NotTranslated && this.t.withDefs ? this.def(n) : undefined;
      if (d) return d;
      throw err;
    }
  }

  /** A name an earlier line of this file bound, holding the value this row read. */
  private bound(n: string): Out {
    const b = this.t.names.get(n);
    if (b && "unknown" in b) return no(`uses line ${b.unknown}`);
    const py = this.t.pyName(n);
    if (!b) return no(this.t.allUnknown ? `uses line ${this.t.allUnknown}` : `${n} is not set in this file`);
    if (b.line < this.t.cut) return no(`lines missing before line ${this.t.cut}`);
    if (b.view !== this.t.view(this.i)) return no(`${n} is set in the other view`);
    if (this.t.allUnknown > b.line) return no(`uses line ${this.t.allUnknown}`);
    // G213f1: by value, never by position alone: a store in the other view or a deleted row in between changes it
    const reads = this.t.rows[this.i]?.reads;
    if (!Array.isArray(reads)) return no("this line does not keep the values it read");
    const kept = reads.find((d) => d.name === n);
    if (!kept || typeof kept.value !== "string") return no(`the value ${n} held when this line ran is not kept`);
    const held = b.def ? (b.def.exact === kept.exact ? b.def.value : undefined) : fullOf(this.t.rows[b.line - 1], kept);
    if (held !== kept.value) return no(`${n} held another value when this line ran`);
    return { s: py, p: 5, k: b.k };
  }

  /** A chip: Ans, a result chip, or a kind with no mapping. Never by the number in `\res{k}` (one run's row number). */
  private chip(a: Json): Out {
    const m = typeof a === "object" && !Array.isArray(a) && "str" in a ? /^\(pyc(\d+)\)$/.exec(a.str) : null;
    const key = m ? this.keys[Number(m[1])] : undefined;
    if (key === ANS_KEY) return this.ans();
    if (key?.startsWith("res:")) return this.result(key);
    if (key?.startsWith("const:")) return no("a constant is not translated");
    return no("a chip is not translated");
  }

  /** Ans: the last row of this view that finished with a result (session.svelte.ts lastChip), when it is in the file and
   *  holds the value Ans held at Enter (G213f1: a deleted row in between changes it); else that value itself. */
  private ans(): Out {
    const kept = this.t.rows[this.i]?.ans;
    if (!kept || typeof kept.value !== "string") return no("Ans: this line does not keep its value");
    const rows = this.t.rows;
    let j = this.i - 1;
    while (j >= 0 && !(rows[j]?.ok === true && this.t.view(j) === this.t.view(this.i))) j--;
    if (j < 0 || j + 1 < this.t.cut || fullOf(rows[j], kept) !== kept.value) return this.earlierValue(kept);
    const line = this.t.lines[j];
    if (!line || !this.t.holds(line, j)) return no(`uses line ${j + 1}`);
    return { s: line.name, p: 5, k: line.k };
  }

  /** A result chip: the name of an earlier row of this file whose full value is the chip's value, else that value. */
  private result(key: string): Out {
    const c = this.t.rows[this.i]?.chips?.[key];
    if (!c || typeof c.value !== "string") return no("an earlier result with no value kept");
    for (let j = this.i - 1; j >= 0; j--) {
      const r = this.t.rows[j] as PyRow;
      const line = this.t.lines[j];
      if (r.ok && fullOf(r, c) === c.value && line && this.t.holds(line, j)) return { s: line.name, p: 5, k: line.k };
    }
    return this.earlierValue(c);
  }

  /** A value N62 put in as it was (`# an earlier result`): a fraction or a decimal literal; any other text refuses. */
  private earlierValue(c: PyChip): Out {
    this.earlier = true;
    return this.valueOut(c.value) ?? no(`an earlier result ${c.value.trim()} is not translated`);
  }

  /** G218: stored name n bound to the value this row read, when that value is a number the file can write. */
  private def(n: string): Out | undefined {
    const reads = this.t.rows[this.i]?.reads;
    const kept = Array.isArray(reads) ? reads.find((d) => d.name === n) : undefined;
    if (!kept || typeof kept.value !== "string") return undefined;
    const py = this.t.pyName(n);
    const o = this.valueOut(kept.value);
    if (!o) return undefined;
    const exact = kept.exact === true;
    this.defs.set(n, { code: `${py} = ${o.s}  # N62: stored, ${exact ? "=" : "≈"} ${oneLine(kept.value)}`, k: o.k, value: { value: kept.value, exact } });
    return { s: py, p: 5, k: o.k };
  }

  /** A value N62 gave as text: a fraction or a decimal literal; undefined for any other text. */
  private valueOut(text: string): Out | undefined {
    const v = text.trim();
    const q = /^(-?)(\d+)\/(\d+)$/.exec(v);
    if (q) {
      const r: Out = { s: `${this.use("Rational")}(${q[2]}, ${q[3]})`, p: 5, k: "sym" };
      return q[1] ? { s: `-${r.s}`, p: 3, k: "sym" } : r;
    }
    return /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v) ? this.lit(v) : undefined;
  }
}

class Translator {
  readonly names = new Map<string, Binding>();
  readonly lines: (Line | undefined)[] = [];
  /** Lines were dropped before this line (G219 `gap`): nothing bound before it is read. */
  cut = 0;
  /** A row that may have stored to a name we cannot tell: no name bound before it is read after it. */
  allUnknown = 0;
  /** G218: `tag` ends each row's own name (`_3` + tag), so two runs in one file never bind one name; `withDefs` binds a
   *  stored name the file does not hold to the value the row read (Row.def). Copy as Python uses neither. */
  readonly rows: readonly PyRow[];
  readonly tag: string;
  readonly withDefs: boolean;
  constructor(rows: readonly PyRow[], tag = "", withDefs = false) {
    this.rows = rows;
    this.tag = tag;
    this.withDefs = withDefs;
  }

  view(i: number): string {
    return this.rows[i]?.view ?? "";
  }

  /** The Python name of an N62 name; a Python word or a sympy name is refused. */
  pyName(n: string): string {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) return no(`the name ${n} is not translated`);
    if (KEYWORDS.has(n) || SYMPY.has(n)) return no(`${n} is a Python word`);
    return n;
  }

  /** Row r's tree as the app read it (G214): `\operatorname{name}` is a stored value when the input read one (`defs`)
   *  or this file set it, so `\operatorname{name}(2)` multiplies it; any other name before a bracket is the call it was.
   *  A bare name nothing set does not parse so: read as a value, the translator then says where it is not set (G213). */
  private parse(r: PyRow, chips: Record<string, PyChip>): Json {
    const read = new Set([...(r.defs ?? []), ...(Array.isArray(r.reads) ? r.reads : [])].map((d) => d.name));
    const values = { has: (n: string) => read.has(n) || this.names.has(n) } as unknown as ReadonlySet<string>;
    try {
      return parseLatex(r.input, { chips, userValues: values });
    } catch {
      const loose = { has: (n: string) => values.has(n) || !PY_FUNCTIONS.has(n) } as unknown as ReadonlySet<string>;
      return parseLatex(r.input, { chips, userValues: loose });
    }
  }

  /** The name line j bound still holds line j's value. */
  holds(line: Line, j: number): boolean {
    if (line.name.startsWith("_")) return true;
    const b = this.names.get(line.name);
    return b !== undefined && "line" in b && b.def === undefined && b.line === j + 1 && this.allUnknown <= j + 1;
  }

  /** A row not translated binds nothing: the name it may have stored to is unknown from here on. */
  private forget(r: PyRow, line: number): void {
    let tree: Json;
    try {
      tree = parseLatex(r.input, { chips: markers(r).table, userValues: ANY });
    } catch {
      if (/\\blacktriangleright|:=/.test(r.input)) this.allUnknown = line;
      return;
    }
    // a store binds at any depth: in brackets, braces, a list or a chain (`(7▶a)+1`, `b:=7▶a`), as the parser builds it
    const walk = (e: Json): void => {
      if (!Array.isArray(e)) return;
      if (isHead(e, "Assign")) {
        const target = e[1] as Json;
        const n = typeof target === "string" ? target : isHead(target, "Call") && typeof target[1] === "string" ? target[1] : undefined;
        if (n === undefined) this.allUnknown = line;
        else this.names.set(n, { unknown: line });
      }
      for (const x of e.slice(1)) walk(x);
    };
    walk(tree);
  }

  /** One row: its code line, or its NOT TRANSLATED comment; then N62's answer. */
  row(i: number, uses: Set<string>): string {
    const r = this.rows[i] as PyRow;
    const line = i + 1;
    if ((r.gap ?? 0) > 0) this.cut = line;
    const answer = oneLine(r.ok ? `${r.mark ? `${r.mark} ` : ""}${(r.mark === "=" ? (r.exact ?? r.value) : (r.value ?? r.exact)) ?? ""}` : (r.error ?? "no result"));
    try {
      if (!r.ok) no("N62 gave no result");
      if (r.unit || r.dim || r.sigma) no("a unit result is not translated");
      const { table, keys } = markers(r);
      let tree: Json;
      try {
        tree = this.parse(r, table);
      } catch (err) {
        return no(`not read: ${err instanceof Error ? err.message : String(err)}`);
      }
      const t = new Row(this, i, keys);
      let name = `_${line}${this.tag}`;
      let body = tree;
      if (isHead(tree, "Assign")) {
        if (typeof tree[1] !== "string") no("a definition is not translated");
        name = this.pyName(tree[1] as string);
        body = tree[2] as Json;
      }
      const o = t.ser(body);
      for (const u of t.uses) uses.add(u);
      this.lines[i] = { name, k: o.k };
      for (const [n, d] of t.defs) this.names.set(n, { line, view: this.view(i), k: d.k, def: d.value });
      if (!name.startsWith("_")) this.names.set(name, { line, view: this.view(i), k: o.k });
      return `${[...t.defs.values()].map((d) => `${d.code}\n`).join("")}${name} = ${o.s}${t.earlier ? "  # an earlier result" : ""}  # N62: ${answer}`;
    } catch (err) {
      if (!(err instanceof NotTranslated)) throw err;
      this.forget(r, line);
      return `# N62 NOT TRANSLATED (${oneLine(err.reason)}): ${oneLine(r.input)}\n# N62: ${answer}`;
    }
  }
}

/** Every `\operatorname{name}` reads as a stored value (a store's target): whether this file set it is the translator's question. */
const ANY: ReadonlySet<string> = { has: () => true } as unknown as ReadonlySet<string>;

/** The row's chips as markers `pyc<n>` for the parser, so the tree says which chip stands where; Ans always has one. */
function markers(r: PyRow): { table: Record<string, PyChip>; keys: string[] } {
  const keys = [...Object.keys(r.chips ?? {}).filter((k) => k !== ANS_KEY), ANS_KEY];
  return { table: Object.fromEntries(keys.map((k, n) => [k, { value: `pyc${n}`, exact: true }])), keys };
}

const oneLine = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, " ");

/** G213's first line of a file, with the app's version. */
export const pyHead = (app: string): string => `# N62 ${oneLine(app)} · Copy as Python · preview: the form of this file can change`;

/** One row's code (or its NOT TRANSLATED comment) and the sympy names it uses. */
export interface PyCell {
  code: string;
  uses: readonly string[];
}

/** Each row's cell, in order; a row's cell depends on the rows before it only. G218's sync file: `tag` ends each row's
 *  own name, `defs` binds a stored name the file does not hold to the value the row read (both off for Copy). */
export function translateCells(rows: readonly PyRow[], o: { tag?: string; defs?: boolean } = {}): PyCell[] {
  const t = new Translator(rows, o.tag ?? "", o.defs === true);
  return rows.map((_, i) => {
    const uses = new Set<string>();
    return { code: t.row(i, uses), uses: [...uses] };
  });
}

/** The rows (a view's history in order, or one row) as a sympy script: the N62 line, the imports it needs, one line per row. */
export function translateRows(rows: readonly PyRow[], o: PyOptions): string {
  const cells = translateCells(rows);
  const uses = new Set(cells.flatMap((c) => c.uses));
  const imports = uses.size ? [`from sympy import ${[...uses].sort().join(", ")}`] : [];
  return `${[pyHead(o.app), ...imports, ...cells.map((c) => c.code)].join("\n")}\n`;
}
