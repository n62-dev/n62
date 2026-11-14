// SPDX-License-Identifier: GPL-3.0-or-later
// G213: Copy as Python, the core. Exact expected code, no engine: the templates are the package's own (G213 block),
// the `# N62:` answers are the rows' own text as given here, never computed. Whether the code runs and agrees is G215.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { PY_FUNCTIONS, translateRows, type PyRow } from "./python.ts";

const HEAD = "# N62 0.1.0 · Copy as Python · preview: the form of this file can change";
const py = (rows: PyRow[]): string => translateRows(rows, { app: "0.1.0" });
/** A done Home row: its input, and its answer as the session line keeps it. */
const row = (input: string, o: Partial<PyRow> = {}): PyRow => ({ view: "home", input, ok: true, mark: "=", ...o });
const file = (...lines: string[]): string => `${[HEAD, ...lines].join("\n")}\n`;

describe("translateRows: the file", () => {
  it("starts with the N62 line and the version given", () => {
    expect(py([])).toBe(file());
    expect(translateRows([], { app: "0.2.0-dev" }).split("\n")[0]).toBe(
      "# N62 0.2.0-dev · Copy as Python · preview: the form of this file can change",
    );
  });
  it("imports only what its lines use, once", () => {
    expect(py([row("2^3", { exact: "8" })])).toBe(file("_1 = 2**3  # N62: = 8"));
    expect(py([row("\\frac{1}{3}", { exact: "1/3" }), row("\\sqrt{2}+\\pi", { exact: "sqrt(2)+pi" }), row("\\frac{1}{2}", { exact: "1/2" })])).toBe(
      file(
        "from sympy import Rational, pi, sqrt",
        "_1 = Rational(1, 3)  # N62: = 1/3",
        "_2 = sqrt(2) + pi  # N62: = sqrt(2)+pi",
        "_3 = Rational(1, 2)  # N62: = 1/2",
      ),
    );
  });
});

describe("translateRows: arithmetic to sympy", () => {
  const one = (input: string, code: string, imports?: string): void => {
    const out = py([row(input, { exact: "v" })]);
    expect(out).toBe(imports ? file(`from sympy import ${imports}`, `_1 = ${code}  # N62: = v`) : file(`_1 = ${code}  # N62: = v`));
  };
  it("the block's seven", () => {
    one("\\frac{1}{3}", "Rational(1, 3)", "Rational");
    one("2^3", "2**3");
    one("1.5", "Rational('1.5')", "Rational");
    one("\\pi", "pi", "pi");
    one("\\exponentialE", "E", "E");
    one("2+3\\imaginaryI", "2 + 3*I", "I");
    one("\\sqrt{2}", "sqrt(2)", "sqrt");
  });
  it("never divides two Python ints, nor raises one to a negative power (that would be a float)", () => {
    one("\\frac{2+1}{4}", "Rational(2 + 1, 4)", "Rational");
    one("2^{-1}", "Integer(2)**(-1)", "Integer");
    one("2^{3-5}", "Integer(2)**(3 - 5)", "Integer");
    one("\\frac{\\pi}{2}", "pi/2", "pi");
    one("50\\%", "Rational(50, 100)", "Rational");
  });
  it("brackets as Python reads them", () => {
    one("-2^2", "-(2**2)");
    one("\\left(-2\\right)^2", "(-2)**2");
    one("2\\times\\left(-3\\right)", "2*(-3)");
    one("1-\\left(2+3\\right)", "1 - (2 + 3)");
    one("1-2\\times3", "1 - 2*3");
    one("\\frac{1}{3}\\times\\frac{\\pi}{2}", "Rational(1, 3)*(pi/2)", "Rational, pi");
    one("1.5\\emark-3", "Rational('1.5e-3')", "Rational");
  });
});

describe("translateRows: the answer comment", () => {
  it("ends each line with the row's mark and text", () => {
    expect(py([row("\\frac{1}{3}", { mark: "≈", exact: "1/3", value: "0.333333333333" })])).toBe(
      file("from sympy import Rational", "_1 = Rational(1, 3)  # N62: ≈ 0.333333333333"),
    );
    expect(py([row("\\frac{1}{3}", { mark: "=", exact: "1/3", value: "0.333333333333" })])).toBe(
      file("from sympy import Rational", "_1 = Rational(1, 3)  # N62: = 1/3"),
    );
  });
});

describe("translateRows: anything else is not translated, and binds nothing", () => {
  it("an unknown head, a chip kind with no mapping, a Sum, a function", () => {
    expect(py([row("\\operatorname{Zeta}\\left(2\\right)", { exact: "pi^2/6" })])).toBe(
      file("# N62 NOT TRANSLATED (Zeta is not translated): \\operatorname{Zeta}\\left(2\\right)", "# N62: = pi^2/6"),
    );
    expect(py([row("2\\const{c}{c}", { mark: "≈", value: "599584916", chips: { "const:c": { value: "299792458", exact: true } } })])).toBe(
      file("# N62 NOT TRANSLATED (a constant is not translated): 2\\const{c}{c}", "# N62: ≈ 599584916"),
    );
    expect(py([row("\\sum_{k=1}^{3}k", { exact: "6" })])).toBe(file("# N62 NOT TRANSLATED (Sum is not translated): \\sum_{k=1}^{3}k", "# N62: = 6"));
    expect(py([row("\\cot(1)", { mark: "≈", value: "0.642092615934", angle: "rad" })])).toBe(
      file("# N62 NOT TRANSLATED (Cot is not translated): \\cot(1)", "# N62: ≈ 0.642092615934"),
    );
  });
  it("a later row that reads its name, or Ans after it, is comment-only too", () => {
    const out = py([
      row("\\operatorname{Zeta}\\left(2\\right)\\blacktriangleright a", { exact: "pi^2/6" }),
      row("a+1", { exact: "pi^2/6+1", reads: [{ name: "a", value: "pi^2/6", exact: true }] }),
      row("\\ans\\times2", { exact: "pi^2/3+2", ans: { value: "pi^2/6+1", exact: true }, reads: [] }),
      row("2^3", { exact: "8" }),
      row("\\ans+1", { exact: "9", ans: { value: "8", exact: true }, reads: [] }),
    ]);
    expect(out).toBe(
      file(
        "# N62 NOT TRANSLATED (Zeta is not translated): \\operatorname{Zeta}\\left(2\\right)\\blacktriangleright a",
        "# N62: = pi^2/6",
        "# N62 NOT TRANSLATED (uses line 1): a+1",
        "# N62: = pi^2/6+1",
        "# N62 NOT TRANSLATED (uses line 2): \\ans\\times2",
        "# N62: = pi^2/3+2",
        "_4 = 2**3  # N62: = 8",
        "_5 = _4 + 1  # N62: = 9",
      ),
    );
  });
  it("a name no line of the file sets, or a Python word, is not guessed", () => {
    expect(py([row("x^2", { exact: "x^2" })])).toBe(file("# N62 NOT TRANSLATED (x is not set in this file): x^2", "# N62: = x^2"));
    expect(py([row("5\\blacktriangleright\\lambda", { exact: "5" }), row("\\lambda+1", { exact: "6" })])).toBe(
      file(
        "# N62 NOT TRANSLATED (lambda is a Python word): 5\\blacktriangleright\\lambda",
        "# N62: = 5",
        "# N62 NOT TRANSLATED (uses line 1): \\lambda+1",
        "# N62: = 6",
      ),
    );
  });
  it("a store that cannot be read leaves every earlier name unknown, for Ans and chips too", () => {
    const out = py([
      row("5\\blacktriangleright a", { exact: "5" }),
      { view: "home", input: "\\frac{1}{\\blacktriangleright a", ok: false, error: "Syntax" },
      row("\\ans+1", { exact: "6", ans: { value: "5", exact: true }, reads: [] }),
      row("\\res{1}{5}+a", { exact: "10", chips: { "res:1": { value: "5", exact: true } }, reads: [{ name: "a", value: "5", exact: true }] }),
    ]);
    expect(out).toBe(
      file(
        "a = 5  # N62: = 5",
        "# N62 NOT TRANSLATED (N62 gave no result): \\frac{1}{\\blacktriangleright a",
        "# N62: Syntax",
        "# N62 NOT TRANSLATED (uses line 1): \\ans+1",
        "# N62: = 6",
        "# N62 NOT TRANSLATED (uses line 2): \\res{1}{5}+a",
        "# N62: = 10",
      ),
    );
  });
  it("a row that ended in an error, and a unit row, are not translated", () => {
    expect(py([{ view: "home", input: "\\frac{1}{0}", ok: false, error: "Division by 0" }])).toBe(
      file("# N62 NOT TRANSLATED (N62 gave no result): \\frac{1}{0}", "# N62: Division by 0"),
    );
    expect(py([row("2\\times3", { exact: "6", unit: "m" })])).toBe(file("# N62 NOT TRANSLATED (a unit result is not translated): 2\\times3", "# N62: = 6"));
  });
  it("a store that ended in an error leaves its name unknown", () => {
    const out = py([row("5\\blacktriangleright a", { exact: "5" }), { view: "home", input: "\\frac{1}{0}\\blacktriangleright a", ok: false, error: "Division by 0" }, row("a+1", { exact: "6", reads: [{ name: "a", value: "5", exact: true }] })]);
    expect(out).toBe(
      file(
        "a = 5  # N62: = 5",
        "# N62 NOT TRANSLATED (N62 gave no result): \\frac{1}{0}\\blacktriangleright a",
        "# N62: Division by 0",
        "# N62 NOT TRANSLATED (uses line 2): a+1",
        "# N62: = 6",
      ),
    );
  });
  it("a store inside brackets, or in a chain, leaves its name unknown (G213 fix round 2)", () => {
    const inner = py([row("5\\blacktriangleright a", { exact: "5" }), row("\\left(7\\blacktriangleright a\\right)+1", { exact: "8" }), row("a+1", { exact: "8", reads: [{ name: "a", value: "7", exact: true }] })]);
    expect(inner).toBe(
      file(
        "a = 5  # N62: = 5",
        "# N62 NOT TRANSLATED (Assign is not translated): \\left(7\\blacktriangleright a\\right)+1",
        "# N62: = 8",
        "# N62 NOT TRANSLATED (uses line 2): a+1",
        "# N62: = 8",
      ),
    );
    const chain = py([row("5\\blacktriangleright a", { exact: "5" }), row("b:=7\\blacktriangleright a", { exact: "7" }), row("a+1", { exact: "8", reads: [{ name: "a", value: "7", exact: true }] })]);
    expect(chain).toBe(
      file(
        "a = 5  # N62: = 5",
        "# N62 NOT TRANSLATED (Assign is not translated): b:=7\\blacktriangleright a",
        "# N62: = 7",
        "# N62 NOT TRANSLATED (uses line 2): a+1",
        "# N62: = 8",
      ),
    );
  });
});

describe("translateRows: stores and Ans", () => {
  it("5▶a gives a = 5 and a later a+1 reads it; Ans reads the last translated line's name", () => {
    const out = py([
      row("5\\blacktriangleright a", { exact: "5", reads: [] }),
      row("a+1", { exact: "6", reads: [{ name: "a", value: "5", exact: true }] }),
      row("\\ans\\times2", { exact: "12", ans: { value: "6", exact: true }, reads: [] }),
      row("a:=\\ans-2", { exact: "10", ans: { value: "12", exact: true }, reads: [] }),
      row("\\ans+a", { exact: "20", ans: { value: "10", exact: true }, reads: [{ name: "a", value: "10", exact: true }] }),
    ]);
    expect(out).toBe(file("a = 5  # N62: = 5", "_2 = a + 1  # N62: = 6", "_3 = _2*2  # N62: = 12", "a = _3 - 2  # N62: = 10", "_5 = a + a  # N62: = 20"));
  });
  it("Ans reads its own view's last result, never an error row's", () => {
    const out = py([
      row("2", { exact: "2" }),
      { view: "cas", input: "3", ok: true, mark: "=", exact: "3" },
      { view: "home", input: "\\frac{1}{0}", ok: false, error: "Division by 0" },
      row("\\ans+1", { exact: "3", ans: { value: "2", exact: true }, reads: [] }),
    ]);
    expect(out.split("\n").slice(-2)[0]).toBe("_4 = _1 + 1  # N62: = 3");
  });
  it("Ans with no earlier row of its view in the file is the value it held at Enter (G213f1)", () => {
    expect(py([row("\\ans+1", { exact: "3", ans: { value: "2", exact: true }, reads: [] })])).toBe(file("_1 = 2 + 1  # an earlier result  # N62: = 3"));
  });
  it("a name Object.prototype holds (toString) is a stored name like any other (G213 fix round 3)", () => {
    const out = py([row("5\\blacktriangleright\\operatorname{toString}", { exact: "5" }), row("\\operatorname{toString}+1", { exact: "6", reads: [{ name: "toString", value: "5", exact: true }] })]);
    expect(out).toBe(file("toString = 5  # N62: = 5", "_2 = toString + 1  # N62: = 6"));
  });
  it("a name set in the other view is not read", () => {
    const out = py([{ view: "cas", input: "5\\blacktriangleright a", ok: true, mark: "=", exact: "5" }, row("a+1", { exact: "6", reads: [{ name: "a", value: "5", exact: true }] })]);
    expect(out).toBe(file("a = 5  # N62: = 5", "# N62 NOT TRANSLATED (a is set in the other view): a+1", "# N62: = 6"));
  });
  it("after a gap (lines dropped), names and Ans from before it are not read", () => {
    const out = py([
      row("5\\blacktriangleright a", { exact: "5" }),
      row("a+1", { exact: "6", gap: 2, reads: [{ name: "a", value: "5", exact: true }] }),
      row("\\ans", { exact: "6", ans: { value: "6", exact: true }, reads: [] }),
    ]);
    expect(out).toBe(
      file(
        "a = 5  # N62: = 5",
        "# N62 NOT TRANSLATED (lines missing before line 2): a+1",
        "# N62: = 6",
        "# N62 NOT TRANSLATED (uses line 2): \\ans",
        "# N62: = 6",
      ),
    );
  });
});

// G213f1: Ans and a stored name are read by the value the row kept at Enter (`ans`, `reads`), never by position alone.
describe("translateRows: Ans and names by the value the row read (G213f1)", () => {
  const a5 = row("5\\blacktriangleright a", { exact: "5", reads: [] });
  it("a store in the other view between a store and its read: the name is not translated (N62 read 7, not 5)", () => {
    // Home 5▶a, CAS 7▶a (one shared context), Home a+1 = 8: the Home view's file has the first and the last
    const out = py([a5, row("a+1", { exact: "8", reads: [{ name: "a", value: "7", exact: true }] })]);
    expect(out).toBe(file("a = 5  # N62: = 5", "# N62 NOT TRANSLATED (a held another value when this line ran): a+1", "# N62: = 8"));
  });
  it("a deleted row between a result and its Ans: Ans is the value it held, as an earlier result", () => {
    // Home 2, Home 3 (deleted since), Home Ans+1 = 4
    const out = py([row("2", { exact: "2" }), row("\\ans+1", { exact: "4", ans: { value: "3", exact: true }, reads: [] })]);
    expect(out).toBe(file("_1 = 2  # N62: = 2", "_2 = 3 + 1  # an earlier result  # N62: = 4"));
    const dec = py([row("2", { exact: "2" }), row("\\ans\\times2", { mark: "≈", value: "0.5", ans: { value: "0.25", exact: false }, reads: [] })]);
    expect(dec).toBe(file("from sympy import Rational", "_1 = 2  # N62: = 2", "_2 = Rational('0.25')*2  # an earlier result  # N62: ≈ 0.5"));
  });
  it("Ans that is not exact is read by the value of its line", () => {
    const out = py([row("0.25", { mark: "≈", value: "0.25" }), row("\\ans\\times2", { mark: "≈", value: "0.5", ans: { value: "0.25", exact: false }, reads: [] })]);
    expect(out).toBe(file("from sympy import Rational", "_1 = Rational('0.25')  # N62: ≈ 0.25", "_2 = _1*2  # N62: ≈ 0.5"));
  });
  it("a rebound name: read when its last line in the file holds the value read, else not translated", () => {
    const seen = py([a5, row("7\\blacktriangleright a", { exact: "7", reads: [] }), row("a+1", { exact: "8", reads: [{ name: "a", value: "7", exact: true }] })]);
    expect(seen).toBe(file("a = 5  # N62: = 5", "a = 7  # N62: = 7", "_3 = a + 1  # N62: = 8"));
    // 7▶a deleted since
    const gone = py([a5, row("a+1", { exact: "8", reads: [{ name: "a", value: "7", exact: true }] })]);
    expect(gone.split("\n")[2]).toBe("# N62 NOT TRANSLATED (a held another value when this line ran): a+1");
    // the same text, but kept exact against a line that has no exact text
    const kind = py([row("0.5\\blacktriangleright a", { mark: "≈", value: "0.5", reads: [] }), row("a+1", { exact: "3/2", reads: [{ name: "a", value: "0.5", exact: true }] })]);
    expect(kind.split("\n")[3]).toBe("# N62 NOT TRANSLATED (a held another value when this line ran): a+1");
    const same = py([row("0.5\\blacktriangleright a", { mark: "≈", value: "0.5", reads: [] }), row("a+1", { mark: "≈", value: "1.5", reads: [{ name: "a", value: "0.5", exact: false }] })]);
    expect(same.split("\n").slice(-2)[0]).toBe("_2 = a + 1  # N62: ≈ 1.5");
  });
  it("a name the row did not keep a value of (not a stored value then, or a value over 2 kB) is not read from the file", () => {
    const out = py([a5, row("a+1", { exact: "a+1", reads: [] })]);
    expect(out.split("\n")[2]).toBe("# N62 NOT TRANSLATED (the value a held when this line ran is not kept): a+1");
  });
  it("a line without the new fields (written before G213f1) refuses Ans and names", () => {
    const ans = py([row("2", { exact: "2" }), row("\\ans+1", { exact: "3" })]);
    expect(ans).toBe(file("_1 = 2  # N62: = 2", "# N62 NOT TRANSLATED (Ans: this line does not keep its value): \\ans+1", "# N62: = 3"));
    const name = py([a5, row("a+1", { exact: "6" })]);
    expect(name).toBe(file("a = 5  # N62: = 5", "# N62 NOT TRANSLATED (this line does not keep the values it read): a+1", "# N62: = 6"));
  });
});

describe("translateRows: a result chip, never by its number", () => {
  const third = row("\\frac{1}{3}", { exact: "1/3" });
  it("reads the row in the call whose full value it holds", () => {
    const out = py([third, row("\\res{1}{0.333333333333}\\times3", { exact: "1", chips: { "res:1": { value: "1/3", exact: true } } })]);
    expect(out).toBe(file("from sympy import Rational", "_1 = Rational(1, 3)  # N62: = 1/3", "_2 = _1*3  # N62: = 1"));
  });
  it("is its own value as a literal when its row is not in the call", () => {
    const out = py([row("\\res{7}{0.5}+1", { exact: "3/2", chips: { "res:7": { value: "1/2", exact: true } } })]);
    expect(out).toBe(file("from sympy import Rational", "_1 = Rational(1, 2) + 1  # an earlier result  # N62: = 3/2"));
    const dec = py([row("\\res{7}{0.25}\\times2", { mark: "≈", value: "0.5", chips: { "res:7": { value: "0.25", exact: false } } })]);
    expect(dec).toBe(file("from sympy import Rational", "_1 = Rational('0.25')*2  # an earlier result  # N62: ≈ 0.5"));
  });
  it("is its own value when the row with its number holds another value (the number used again after a restart)", () => {
    const out = py([third, row("\\res{1}{0.25}\\times2", { mark: "≈", value: "0.5", chips: { "res:1": { value: "0.25", exact: false } } })]);
    expect(out).toBe(file("from sympy import Rational", "_1 = Rational(1, 3)  # N62: = 1/3", "_2 = Rational('0.25')*2  # an earlier result  # N62: ≈ 0.5"));
  });
  it("is its own value when the name its row set was set again since", () => {
    const out = py([
      row("5\\blacktriangleright a", { exact: "5" }),
      row("7\\blacktriangleright a", { exact: "7" }),
      row("\\res{1}{5}+1", { exact: "6", chips: { "res:1": { value: "5", exact: true } } }),
    ]);
    expect(out).toBe(file("a = 5  # N62: = 5", "a = 7  # N62: = 7", "_3 = 5 + 1  # an earlier result  # N62: = 6"));
  });
  it("an exact text the literal cannot carry is not translated", () => {
    expect(py([row("\\res{4}{1.41421356237}^2", { exact: "2", chips: { "res:4": { value: "sqrt(2)", exact: true } } })])).toBe(
      file("# N62 NOT TRANSLATED (an earlier result sqrt(2) is not translated): \\res{4}{1.41421356237}^2", "# N62: = 2"),
    );
  });
});

// G214: functions and the angle mode. The code expected is the block's own templates (sympy's `rad`, `deg`, `log(x, 10)`,
// `root`, `real_root`); the `# N62:` answers are the rows' text as given, worked out by hand where one is shown.
describe("translateRows: the angle mode (G214)", () => {
  const one = (input: string, angle: string | null | undefined, code: string, imports: string): void => {
    const r = row(input, { exact: "v", ...(angle === undefined ? {} : { angle }) });
    expect(py([r])).toBe(file(`from sympy import ${imports}`, `_1 = ${code}  # N62: = v`));
  };
  const refused = (input: string, angle: string | null | undefined, reason = "angle not known"): void => {
    const r = row(input, { exact: "v", ...(angle === undefined ? {} : { angle }) });
    expect(py([r])).toBe(file(`# N62 NOT TRANSLATED (${reason}): ${input}`, "# N62: = v"));
  };
  it("a trig function takes its argument in the row's mode", () => {
    one("\\sin(30)", "deg", "sin(rad(30))", "rad, sin");
    one("\\sin(30)", "rad", "sin(30)", "sin");
    one("\\cos\\left(60\\right)", "deg", "cos(rad(60))", "cos, rad");
    one("\\tan\\left(45\\right)", "deg", "tan(rad(45))", "rad, tan");
    one("\\operatorname{sin}\\left(30\\right)", "deg", "sin(rad(30))", "rad, sin");
    one("\\sin\\left(\\frac{\\pi}{6}\\right)", "rad", "sin(pi/6)", "pi, sin");
  });
  it("an inverse gives its result in the row's mode", () => {
    one("\\arcsin(1)", "deg", "deg(asin(1))", "asin, deg");
    one("\\arcsin(1)", "rad", "asin(1)", "asin");
    one("\\arccos\\left(0\\right)", "deg", "deg(acos(0))", "acos, deg");
    one("\\arctan\\left(1\\right)", "deg", "deg(atan(1))", "atan, deg");
    one("\\sin^{-1}\\left(1\\right)", "deg", "deg(asin(1))", "asin, deg");
    one("\\sin\\left(\\arcsin\\left(1\\right)\\right)", "deg", "sin(rad(deg(asin(1))))", "asin, deg, rad, sin");
  });
  it("u° is u degrees in either mode", () => {
    one("\\sin\\left(30\\degree\\right)", "deg", "sin(rad(30))", "rad, sin");
    one("\\sin\\left(30\\degree\\right)", "rad", "sin(rad(30))", "rad, sin");
    one("30\\degree", "rad", "rad(30)", "rad");
  });
  it("without the row's angle mode, trig, an inverse, ° and the polar form are not translated", () => {
    refused("\\sin(30)", null);
    refused("\\sin(30)", undefined);
    refused("\\sin(30)", "grad");
    refused("\\arcsin(1)", null);
    refused("30\\degree", null);
    refused("2\\measuredangle30", null);
  });
  it("the hyperbolic functions take no angle", () => {
    one("\\sinh\\left(1\\right)", null, "sinh(1)", "sinh");
    one("\\cosh\\left(1\\right)", null, "cosh(1)", "cosh");
    one("\\tanh\\left(1\\right)", null, "tanh(1)", "tanh");
  });
  it("the polar form r∡θ", () => {
    one("2\\measuredangle30", "deg", "2*(cos(rad(30)) + I*sin(rad(30)))", "I, cos, rad, sin");
    one("2\\measuredangle30", "rad", "2*(cos(30) + I*sin(30))", "I, cos, sin");
  });
});

describe("translateRows: logarithms and roots (G214)", () => {
  const one = (input: string, code: string, imports: string): void => {
    expect(py([row(input, { exact: "v" })])).toBe(file(`from sympy import ${imports}`, `_1 = ${code}  # N62: = v`));
  };
  it("ln is sympy's log; log is base 10 (plain sympy has no log10)", () => {
    one("\\ln(2)", "log(2)", "log");
    one("\\log(100)", "log(100, 10)", "log");
    one("\\lg\\left(100\\right)", "log(100, 10)", "log");
    one("\\log_{2}\\left(8\\right)", "log(8, 2)", "log");
    one("\\operatorname{ln}\\left(2\\right)", "log(2)", "log");
    one("\\operatorname{log10}\\left(1000\\right)", "log(1000, 10)", "log");
    one("\\exp\\left(1\\right)", "exp(1)", "exp");
  });
  it("an odd whole index is the real root, as N62 takes it", () => {
    one("\\sqrt[3]{8}", "root(8, 3)", "root");
    one("\\sqrt[3]{-8}", "real_root(-8, 3)", "real_root");
    one("\\sqrt[5]{\\frac{1}{32}}", "real_root(Rational(1, 32), 5)", "Rational, real_root");
    one("\\operatorname{surd}\\left(-32,5\\right)", "real_root(-32, 5)", "real_root");
    one("\\operatorname{surd}\\left(8,3\\right)", "root(8, 3)", "root");
  });
  it("any other index is the principal root", () => {
    one("\\sqrt[4]{16}", "root(16, 4)", "root");
    one("\\sqrt[4]{-16}", "root(-16, 4)", "root");
    one("\\operatorname{sqrt}\\left(2\\right)", "sqrt(2)", "sqrt");
  });
  it("surd with an index that is not an odd whole number is not translated", () => {
    expect(py([row("\\operatorname{surd}\\left(16,4\\right)", { exact: "2" })])).toBe(
      file("# N62 NOT TRANSLATED (surd with an index that is not an odd whole number is not translated): \\operatorname{surd}\\left(16,4\\right)", "# N62: = 2"),
    );
  });
});

describe("translateRows: the function table (G214)", () => {
  const one = (input: string, code: string, imports: string): void => {
    expect(py([row(input, { exact: "v" })])).toBe(file(`from sympy import ${imports}`, `_1 = ${code}  # N62: = v`));
  };
  const refused = (input: string, reason: string): void => {
    expect(py([row(input, { exact: "v" })])).toBe(file(`# N62 NOT TRANSLATED (${reason}): ${input}`, "# N62: = v"));
  };
  it("one row per function, each to its sympy name", () => {
    one("\\operatorname{abs}\\left(-3\\right)", "Abs(-3)", "Abs");
    one("\\left|-3\\right|", "Abs(-3)", "Abs");
    one("\\operatorname{floor}\\left(-2.5\\right)", "floor(-Rational('2.5'))", "Rational, floor");
    one("\\operatorname{ceil}\\left(2.1\\right)", "ceiling(Rational('2.1'))", "Rational, ceiling");
    one("\\operatorname{gcd}\\left(12,18\\right)", "gcd(12, 18)", "gcd");
    one("\\operatorname{lcm}\\left(4,6\\right)", "lcm(4, 6)", "lcm");
    one("\\operatorname{factorial}\\left(5\\right)", "factorial(5)", "factorial");
    one("3!", "factorial(3)", "factorial");
    one("\\operatorname{comb}\\left(5,2\\right)", "binomial(5, 2)", "binomial");
    one("\\binom{5}{2}", "binomial(5, 2)", "binomial");
    one("\\operatorname{Gamma}\\left(5\\right)", "gamma(5)", "gamma");
    one("\\operatorname{erf}\\left(0.5\\right)", "erf(Rational('0.5'))", "Rational, erf");
    one("2\\times\\operatorname{gcd}\\left(12,18\\right)^2", "2*gcd(12, 18)**2", "gcd");
  });
  it("a function's result is sympy's, so a division by it stays exact", () => {
    one("\\frac{1}{\\operatorname{factorial}\\left(3\\right)}", "1/factorial(3)", "factorial");
  });
  it("the wrong number of arguments is not translated", () => {
    refused("\\operatorname{gcd}\\left(12,18,30\\right)", "gcd with 3 arguments is not translated");
    refused("\\operatorname{Gamma}\\left(1,2\\right)", "Gamma with 2 arguments is not translated");
  });
  it("Giac's and N62's own conventions are not translated", () => {
    // pasmedian is N62's name, so the parser refuses it as typed; median is N62's (the mean of the two middle values)
    expect(py([row("\\operatorname{pasmedian}\\left(1\\right)", { exact: "1" })])[0]).toBe("#");
    expect(py([row("\\operatorname{pasmedian}\\left(1\\right)", { exact: "1" })])).toContain("# N62 NOT TRANSLATED (not read: ");
    refused("\\operatorname{median}\\left(1\\right)", "median is not translated");
    // dot conjugates its first argument; stddevp is the sample one; irem is never negative
    refused("\\operatorname{dot}\\left(1,2\\right)", "dot is not translated");
    refused("\\operatorname{stddevp}\\left(1\\right)", "stddevp is not translated");
    refused("\\operatorname{irem}\\left(-7,3\\right)", "irem is not translated");
    refused("\\operatorname{frac}\\left(2.75\\right)", "frac is not translated");
    refused("\\operatorname{percentile}\\left(1,2\\right)", "percentile is not translated");
  });
  it("a name the input read as a stored value is that value, never the function", () => {
    const r = row("\\operatorname{erf}\\left(2\\right)", { exact: "v", defs: [{ name: "erf" }] });
    expect(py([r])).toBe(file("# N62 NOT TRANSLATED (erf is a Python word): \\operatorname{erf}\\left(2\\right)", "# N62: = v"));
  });
  it("a user name equal to a sympy name the table writes is not bound", () => {
    expect(py([row("5\\blacktriangleright\\operatorname{rad}", { exact: "5" })])).toBe(
      file("# N62 NOT TRANSLATED (rad is a Python word): 5\\blacktriangleright\\operatorname{rad}", "# N62: = 5"),
    );
  });
  it("every function of the table is a tier-0 Find function (find/functions.yaml)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const yaml = parse(readFileSync(join(here, "../../../find/functions.yaml"), "utf8")) as { functions: { id: string }[] };
    const tier0 = new Set(yaml.functions.map((f) => f.id.replace(/^fn:/, "")));
    expect([...PY_FUNCTIONS].filter((n) => !tier0.has(n))).toEqual([]);
  });
  const indexFile = join(dirname(fileURLToPath(import.meta.url)), "../find/_gen/find-index.json");
  const index = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as { id: string; kind: string; tier: number }[]) : [];
  it.skipIf(!index.some((i) => i.tier === 1) && process.env.FIND_INDEX !== "required")("every Find tier-1 function is not translated", () => {
    const names = index.filter((i) => i.kind === "fn" && i.tier === 1).map((i) => i.id.replace(/^fn:/, ""));
    expect(names.length).toBeGreaterThan(100);
    const out = py(names.map((n) => row(`\\operatorname{${n}}\\left(1\\right)`, { exact: "v", angle: "rad" })));
    const code = out.split("\n").filter((l) => l !== "" && !l.startsWith("#"));
    expect(code).toEqual([]);
  });
});
