// SPDX-License-Identifier: GPL-3.0-or-later
// G213: Copy as Python, the core. Exact expected code, no engine: the templates are the package's own (G213 block),
// the `# N62:` answers are the rows' own text as given here, never computed. Whether the code runs and agrees is G215.
import { describe, expect, it } from "vitest";
import { translateRows, type PyRow } from "./python.ts";

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
    expect(py([row("3!", { exact: "6" })])).toBe(file("# N62 NOT TRANSLATED (Factorial is not translated): 3!", "# N62: = 6"));
    expect(py([row("2\\const{c}{c}", { mark: "≈", value: "599584916", chips: { "const:c": { value: "299792458", exact: true } } })])).toBe(
      file("# N62 NOT TRANSLATED (a constant is not translated): 2\\const{c}{c}", "# N62: ≈ 599584916"),
    );
    expect(py([row("\\sum_{k=1}^{3}k", { exact: "6" })])).toBe(file("# N62 NOT TRANSLATED (Sum is not translated): \\sum_{k=1}^{3}k", "# N62: = 6"));
    expect(py([row("\\sin(1)", { mark: "≈", value: "0.841470984808" })])).toBe(
      file("# N62 NOT TRANSLATED (Sin is not translated): \\sin(1)", "# N62: ≈ 0.841470984808"),
    );
  });
  it("a later row that reads its name, or Ans after it, is comment-only too", () => {
    const out = py([
      row("3!\\blacktriangleright a", { exact: "6" }),
      row("a+1", { exact: "7" }),
      row("\\ans\\times2", { exact: "14" }),
      row("2^3", { exact: "8" }),
      row("\\ans+1", { exact: "9" }),
    ]);
    expect(out).toBe(
      file(
        "# N62 NOT TRANSLATED (Factorial is not translated): 3!\\blacktriangleright a",
        "# N62: = 6",
        "# N62 NOT TRANSLATED (uses line 1): a+1",
        "# N62: = 7",
        "# N62 NOT TRANSLATED (uses line 2): \\ans\\times2",
        "# N62: = 14",
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
      row("\\ans+1", { exact: "6" }),
      row("\\res{1}{5}+a", { exact: "10", chips: { "res:1": { value: "5", exact: true } } }),
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
    const out = py([row("5\\blacktriangleright a", { exact: "5" }), { view: "home", input: "\\frac{1}{0}\\blacktriangleright a", ok: false, error: "Division by 0" }, row("a+1", { exact: "6" })]);
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
    const inner = py([row("5\\blacktriangleright a", { exact: "5" }), row("\\left(7\\blacktriangleright a\\right)+1", { exact: "8" }), row("a+1", { exact: "8" })]);
    expect(inner).toBe(
      file(
        "a = 5  # N62: = 5",
        "# N62 NOT TRANSLATED (Assign is not translated): \\left(7\\blacktriangleright a\\right)+1",
        "# N62: = 8",
        "# N62 NOT TRANSLATED (uses line 2): a+1",
        "# N62: = 8",
      ),
    );
    const chain = py([row("5\\blacktriangleright a", { exact: "5" }), row("b:=7\\blacktriangleright a", { exact: "7" }), row("a+1", { exact: "8" })]);
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
    const out = py([row("5\\blacktriangleright a", { exact: "5" }), row("a+1", { exact: "6" }), row("\\ans\\times2", { exact: "12" }), row("a:=\\ans-2", { exact: "10" }), row("\\ans+a", { exact: "20" })]);
    expect(out).toBe(file("a = 5  # N62: = 5", "_2 = a + 1  # N62: = 6", "_3 = _2*2  # N62: = 12", "a = _3 - 2  # N62: = 10", "_5 = a + a  # N62: = 20"));
  });
  it("Ans reads its own view's last result, never an error row's", () => {
    const out = py([
      row("2", { exact: "2" }),
      { view: "cas", input: "3", ok: true, mark: "=", exact: "3" },
      { view: "home", input: "\\frac{1}{0}", ok: false, error: "Division by 0" },
      row("\\ans+1", { exact: "3" }),
    ]);
    expect(out.split("\n").slice(-2)[0]).toBe("_4 = _1 + 1  # N62: = 3");
  });
  it("Ans with no earlier row of its view in the file is not translated", () => {
    expect(py([row("\\ans+1", { exact: "3" })])).toBe(file("# N62 NOT TRANSLATED (Ans: its line is not in this file): \\ans+1", "# N62: = 3"));
  });
  it("a name Object.prototype holds (toString) is a stored name like any other (G213 fix round 3)", () => {
    const out = py([row("5\\blacktriangleright\\operatorname{toString}", { exact: "5" }), row("\\operatorname{toString}+1", { exact: "6" })]);
    expect(out).toBe(file("toString = 5  # N62: = 5", "_2 = toString + 1  # N62: = 6"));
  });
  it("a name set in the other view is not read", () => {
    const out = py([{ view: "cas", input: "5\\blacktriangleright a", ok: true, mark: "=", exact: "5" }, row("a+1", { exact: "6" })]);
    expect(out).toBe(file("a = 5  # N62: = 5", "# N62 NOT TRANSLATED (a is set in the other view): a+1", "# N62: = 6"));
  });
  it("after a gap (lines dropped), names and Ans from before it are not read", () => {
    const out = py([row("5\\blacktriangleright a", { exact: "5" }), row("a+1", { exact: "6", gap: 2 }), row("\\ans", { exact: "6" })]);
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
