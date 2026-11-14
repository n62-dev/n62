// SPDX-License-Identifier: GPL-3.0-or-later
// G213: Copy as Python, the core (docs/04 2.6). Rows of the session format (G210, state/sessionLine.ts) become a sympy
// script: each row is parsed by our own parser (the tree emit.ts reads, so this sees what the app sends, never
// MathLive's text) and written through a closed allow-list, head → template. Anything not listed is not translated,
// by construction: the row becomes `# N62 NOT TRANSLATED (<reason>): <input>` and binds nothing, and a later row that
// reads what it would have bound is comment-only too (owner, 2026-11-12). Every row ends with N62's own answer as a
// comment. Functions and the angle mode are G214, units G216, σ G217. Lazy: reached only through clipboard/impl.ts.
import { parseLatex } from "../input/parse.ts";
import type { Json } from "../input/emit.ts";
import { ANS_KEY } from "../input/chips.ts";

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
const SYMPY = new Set(["E", "I", "Integer", "Rational", "pi", "sqrt"]);

/** Python ints stay exact under + - * and ** n; a division or a negative power of two of them would be a float. */
type Kind = "int" | "sym";
/** Precedence as Python reads it: 1 + -, 2 * /, 3 unary minus, 4 **, 5 an atom. */
interface Out {
  s: string;
  p: number;
  k: Kind;
}

class NotTranslated extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}
const no = (reason: string): never => {
  throw new NotTranslated(reason);
};

/** What a Python name holds: the line that set it and its view, or that the line which would have set it is not here. */
type Binding = { line: number; view: string; k: Kind } | { unknown: number };
/** A translated row: the name it bound and what that holds. */
interface Line {
  name: string;
  k: Kind;
}

const wrap = (o: Out, min: number): string => (o.p < min ? `(${o.s})` : o.s);
const isHead = (e: Json, h: string): e is Json[] => Array.isArray(e) && e[0] === h;
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

/** The fixed symbols: MathJSON name → sympy name. */
const CONST: Record<string, string> = { Pi: "pi", ExponentialE: "E", ImaginaryUnit: "I" };

/** The translation of one row; it collects the sympy names it uses. */
class Row {
  readonly uses = new Set<string>();
  /** A chip went in as its own value (`# an earlier result`). */
  earlier = false;
  constructor(
    private readonly t: Translator,
    private readonly i: number,
    private readonly keys: readonly string[],
  ) {}

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
      default:
        return no(`${head} is not translated`);
    }
  }

  /** A symbol: a fixed constant, or a name an earlier line of this file bound. */
  private name(n: string): Out {
    if (n in CONST) return { s: this.use(CONST[n] as string), p: 5, k: "sym" };
    const b = this.t.names.get(n);
    if (b && "unknown" in b) return no(`uses line ${b.unknown}`);
    const py = this.t.pyName(n);
    if (!b) return no(this.t.allUnknown ? `uses line ${this.t.allUnknown}` : `${n} is not set in this file`);
    if (b.line < this.t.cut) return no(`lines missing before line ${this.t.cut}`);
    if (b.view !== this.t.view(this.i)) return no(`${n} is set in the other view`);
    if (this.t.allUnknown > b.line) return no(`uses line ${this.t.allUnknown}`);
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

  /** Ans: the last row of this view that finished with a result (session.svelte.ts lastChip), when it is in the file. */
  private ans(): Out {
    const rows = this.t.rows;
    let j = this.i - 1;
    while (j >= 0 && !(rows[j]?.ok === true && this.t.view(j) === this.t.view(this.i))) j--;
    if (j < 0) return no("Ans: its line is not in this file");
    if (j + 1 < this.t.cut) return no(`lines missing before line ${this.t.cut}`);
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
      const full = c.exact ? r.exact : r.exact ? undefined : r.value;
      const line = this.t.lines[j];
      if (r.ok && full === c.value && line && this.t.holds(line, j)) return { s: line.name, p: 5, k: line.k };
    }
    this.earlier = true;
    const v = c.value.trim();
    const q = /^(-?)(\d+)\/(\d+)$/.exec(v);
    if (q) {
      const r: Out = { s: `${this.use("Rational")}(${q[2]}, ${q[3]})`, p: 5, k: "sym" };
      return q[1] ? { s: `-${r.s}`, p: 3, k: "sym" } : r;
    }
    if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v)) return this.lit(v);
    return no(`an earlier result ${v} is not translated`);
  }
}

class Translator {
  readonly names = new Map<string, Binding>();
  readonly lines: (Line | undefined)[] = [];
  /** Lines were dropped before this line (G219 `gap`): nothing bound before it is read. */
  cut = 0;
  /** A row that may have stored to a name we cannot tell: no name bound before it is read after it. */
  allUnknown = 0;
  constructor(readonly rows: readonly PyRow[]) {}

  view(i: number): string {
    return this.rows[i]?.view ?? "";
  }

  /** The Python name of an N62 name; a Python word or a sympy name is refused. */
  pyName(n: string): string {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) return no(`the name ${n} is not translated`);
    if (KEYWORDS.has(n) || SYMPY.has(n)) return no(`${n} is a Python word`);
    return n;
  }

  /** The name line j bound still holds line j's value. */
  holds(line: Line, j: number): boolean {
    if (line.name.startsWith("_")) return true;
    const b = this.names.get(line.name);
    return b !== undefined && "line" in b && b.line === j + 1 && this.allUnknown <= j + 1;
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
    if (!isHead(tree, "Assign")) return;
    const target = tree[1] as Json;
    const n = typeof target === "string" ? target : isHead(target, "Call") && typeof target[1] === "string" ? target[1] : undefined;
    if (n === undefined) this.allUnknown = line;
    else this.names.set(n, { unknown: line });
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
        tree = parseLatex(r.input, { chips: table, userValues: ANY });
      } catch (err) {
        return no(`not read: ${err instanceof Error ? err.message : String(err)}`);
      }
      const t = new Row(this, i, keys);
      let name = `_${line}`;
      let body = tree;
      if (isHead(tree, "Assign")) {
        if (typeof tree[1] !== "string") no("a definition is not translated");
        name = this.pyName(tree[1] as string);
        body = tree[2] as Json;
      }
      const o = t.ser(body);
      for (const u of t.uses) uses.add(u);
      this.lines[i] = { name, k: o.k };
      if (!name.startsWith("_")) this.names.set(name, { line, view: this.view(i), k: o.k });
      return `${name} = ${o.s}${t.earlier ? "  # an earlier result" : ""}  # N62: ${answer}`;
    } catch (err) {
      if (!(err instanceof NotTranslated)) throw err;
      this.forget(r, line);
      return `# N62 NOT TRANSLATED (${oneLine(err.reason)}): ${oneLine(r.input)}\n# N62: ${answer}`;
    }
  }
}

/** Every `\operatorname{name}` reads as a stored value: whether this file set it is the translator's question. */
const ANY: ReadonlySet<string> = { has: () => true } as unknown as ReadonlySet<string>;

/** The row's chips as markers `pyc<n>` for the parser, so the tree says which chip stands where; Ans always has one. */
function markers(r: PyRow): { table: Record<string, PyChip>; keys: string[] } {
  const keys = [...Object.keys(r.chips ?? {}).filter((k) => k !== ANS_KEY), ANS_KEY];
  return { table: Object.fromEntries(keys.map((k, n) => [k, { value: `pyc${n}`, exact: true }])), keys };
}

const oneLine = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, " ");

/** The rows (a view's history in order, or one row) as a sympy script: the N62 line, the imports it needs, one line per row. */
export function translateRows(rows: readonly PyRow[], o: PyOptions): string {
  const t = new Translator(rows);
  const uses = new Set<string>();
  const body = rows.map((_, i) => t.row(i, uses));
  const head = `# N62 ${oneLine(o.app)} · Copy as Python · preview: the form of this file can change`;
  const imports = uses.size ? [`from sympy import ${[...uses].sort().join(", ")}`] : [];
  return `${[head, ...imports, ...body].join("\n")}\n`;
}
