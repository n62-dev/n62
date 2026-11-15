// SPDX-License-Identifier: GPL-3.0-or-later
// G105: the one reader of Giac text. Prints are Giac's own (probe 2026-10-25, the gsl engine): `"a\"b"` typed prints
// `"a""b"`, and `g(x):="q,(\\"` prints ` (x)->"q,(\"` (a backslash is itself in a print).
import { describe, expect, it } from "vitest";
import {
  afterStore,
  arithmeticOf,
  balanced,
  callsOf,
  closing,
  definedName,
  firstNameIn,
  functionsIn,
  integerLiteral,
  mapNumbers,
  namesIn,
  negated,
  noneOpen,
  opening,
  outerGroups,
  powersIn,
  programParams,
  renameCalls,
  replaceLiteral,
  splitList,
  typedFromPrinted,
  stringEnd,
  topLevelArgs,
  trailingName,
  UNCLOSED,
  walk,
  wholeCall,
  withoutStrings,
} from "./giacPrint.ts";

describe("strings", () => {
  it("typed: a backslash escapes the quote (text-9)", () => {
    expect(stringEnd('"a\\"b:=1";x', 0, "typed")).toBe(8);
    expect(withoutStrings('s:="a\\"b:=1"; x', '""', "typed")).toBe('s:=""; x');
  });
  it("printed: a doubled quote reads as two strings, a backslash is itself", () => {
    expect(stringEnd('"q,(\\"', 0, "printed")).toBe(5);
    expect(withoutStrings('s:="a""b";1', "", "printed")).toBe("s:=;1");
    expect(topLevelArgs('"q,(\\",2', "printed")).toEqual(['"q,(\\"', "2"]);
  });
  it("an unclosed string runs to the end", () => {
    expect(withoutStrings('a+"b,c', '""', "typed")).toBe('a+""');
    expect(walk('f("x', 0, () => false, "typed")).toBe(UNCLOSED);
  });
});

describe("brackets", () => {
  it("closing and opening match ( [ { and skip strings", () => {
    expect(closing('f(a,"(",[b])+1', 1, "typed")).toBe(11);
    expect(closing("f(a", 1, "typed")).toBe(-1);
    expect(opening("x+(a*[b])", 8)).toBe(2);
  });
  it("topLevelArgs splits at depth 0 only", () => {
    expect(topLevelArgs("x^2,x,0,[1,2]", "typed")).toEqual(["x^2", "x", "0", "[1,2]"]);
  });
  it("balanced and noneOpen", () => {
    expect(balanced("f(x)+[1]", "typed")).toBe(true);
    expect(balanced("f(x))(", "typed")).toBe(false);
    expect(balanced('f(")")', "typed")).toBe(true);
    expect(noneOpen("x)", "typed")).toBe(true);
    expect(noneOpen("f(x", "typed")).toBe(false);
  });
  it("G377: outerGroups gives the outer brackets with the name that calls each, skips strings, stops at an unclosed one", () => {
    expect(outerGroups('piecewise(x==1,2,3)+[a,(b)]-"(" + {c}', "typed")).toEqual([
      { open: 9, close: 18, caller: "piecewise" },
      { open: 20, close: 26, caller: "" },
      { open: 34, close: 36, caller: "" },
    ]);
    expect(outerGroups("f(a)+g(b", "typed")).toEqual([{ open: 1, close: 3, caller: "f" }]);
    expect(outerGroups("x+1", "typed")).toEqual([]);
  });
  it("G377: trailingName is the name a text ends with, or empty", () => {
    expect(trailingName("1 and")).toBe("and");
    expect(trailingName("a_2")).toBe("a_2");
    expect(trailingName("f(x) ")).toBe("");
    expect(trailingName("")).toBe("");
  });
  it("splitList reads a printed list, list[…] too, and nothing else", () => {
    expect(splitList("[1,[2,3],f(4,5)]")).toEqual(["1", "[2,3]", "f(4,5)"]);
    expect(splitList("list[1,2]")).toEqual(["1", "2"]);
    expect(splitList('["a,b",1]')).toEqual(['"a,b"', "1"]);
    expect(splitList("[]")).toEqual([]);
    expect(splitList("[1,2")).toBeNull();
    expect(splitList("[1]+[2]")).toBeNull();
    expect(splitList("x")).toBeNull();
  });
});

describe("names", () => {
  it("functionsIn and namesIn skip strings and the exponent of a number", () => {
    expect(functionsIn('romberg(exp(-x^2),x,0,1)+"f(y)"', "typed")).toEqual(["romberg", "exp"]);
    expect(namesIn("B*2e5+f(x)", "typed")).toEqual(["B", "x"]);
  });
  it("callsOf gives each call with its brackets; wholeCall the arguments of a text that is one call", () => {
    expect(callsOf("1+round(x,2)*myround(y)", ["round"], "typed")).toEqual([{ name: "round", at: 2, open: 7, close: 11 }]);
    expect(wholeCall(" purge(a, b) ", "purge", "typed")).toEqual(["a", "b"]);
    expect(wholeCall("purge(a)+1", "purge", "typed")).toBeNull();
  });
  it("renames calls only, and finds a name of a set", () => {
    expect(renameCalls("erf(x)+erf+xerf(1)", { erf: "paserfv" }, "typed")).toBe("paserfv(x)+erf+xerf(1)");
    expect(firstNameIn('"Digits" + Digits', new Set(["Digits"]), "typed")).toBe("Digits");
    expect(firstNameIn('"Digits"', new Set(["Digits"]), "typed")).toBeNull();
  });
  it("reads a store's name and value, and a printed program's parameters", () => {
    expect(afterStore(" B := 2*x", "B")).toBe(" 2*x");
    expect(afterStore("Bc:=2", "B")).toBeNull();
    expect(definedName("f(x):=x")).toBe("f");
    expect(definedName("f+1")).toBeNull();
    expect(programParams(" (x,y)->x+y")).toEqual(["x", "y"]);
    expect(programParams("x->x")).toBeNull();
    expect(programParams("x->x", true)).toEqual(["x"]);
  });
});

describe("numbers", () => {
  it("mapNumbers sees literals, not names or strings", () => {
    const seen: string[] = [];
    mapNumbers('x1+2.5e-3*0x1F+"7.5"+.5', (m, e) => (seen.push(m + (e ?? "")), null), "typed");
    expect(seen).toEqual(["2.5e-3", "0", ".5"]);
  });
  it("replaceLiteral replaces whole literals only", () => {
    expect(replaceLiteral("5/10^12+15/10^12*x", "5/10^12", "5e-12")).toBe("5e-12+15/10^12*x");
  });
  it("G105f2: typedFromPrinted writes a printed backslash as a join with char(92); a doubled quote stays", () => {
    expect(typedFromPrinted('["C:\\",1]')).toBe('[("C:"+char(92)),1]');
    expect(typedFromPrinted('"a""b"+"x\\y\\"')).toBe('"a""b"+("x"+char(92)+"y"+char(92))');
    expect(typedFromPrinted('"q""\\"')).toBe('("q"""+char(92))');
    expect(typedFromPrinted("[1,2]")).toBe("[1,2]");
  });
});

describe("arithmeticOf and integerLiteral (G363 fix round 2)", () => {
  const show = (t: string): string => {
    const a = arithmeticOf(t, "typed");
    const w = (n: NonNullable<typeof a>): string =>
      n.op === "num" ? n.text : n.op === "name" ? n.name : n.op === "call" ? `${n.name}[${w(n.arg)}]` : n.op === "neg" ? `~${w(n.a)}` : `{${w(n.a)}${n.op}${w(n.b)}}`;
    return a ? w(a) : "null";
  };
  it("reads numbers, names, calls, brackets, signs and the five operations with their precedence", () => {
    expect(show(" 2 * exp( 1 ) - 1.5e1 ")).toBe("{{2*exp[1]}-1.5e1}");
    expect(show("(1+sin(1)^5000)^(sin(1)^-5000)")).toBe("{{1+{sin[1]^5000}}^{sin[1]^~5000}}");
    expect(show("-2^2")).toBe("~{2^2}");
    expect(show("2^3^2")).toBe("{2^{3^2}}");
    expect(show("1/2/3")).toBe("{{1/2}/3}");
    expect(show("((pi))")).toBe("pi");
  });
  it("gives null for any other text: a string, a comma, a list, a factorial, an unclosed bracket, two operands", () => {
    for (const t of ['"1"+2', "sin(1,2)", "[1]", "2!", "(1", "1)", "", "2 pi", "f(1)(2)", "sin[1]"]) expect(show(t), t).toBe("null");
  });
  it("integerLiteral: a literal with a sign, in brackets or not, and where its digits start", () => {
    expect(integerLiteral(arithmeticOf(" ( -200 ) ", "typed"))).toEqual({ n: -200, at: 4 });
    expect(integerLiteral(arithmeticOf("5000", "typed"))).toEqual({ n: 5000, at: 0 });
    expect(integerLiteral(arithmeticOf(`1${"0".repeat(309)}`, "typed"))).toEqual({ n: Infinity, at: 0 });
    for (const t of ["5000.5", "2e3", "(5000)^2", "x", "--2"]) expect(integerLiteral(arithmeticOf(t, "typed")), t).toBeNull();
  });
});

describe("powersIn and negated (G348)", () => {
  const exps = (s: string): string[] => powersIn(s, "typed").map((p) => s.slice(...p.exponent));
  it("reads each power's base and exponent, a call and a right-associative chain included", () => {
    expect(powersIn("(-1)^(pi^2206)", "typed").map((p) => p.base)).toEqual(["(-1)", "pi"]);
    expect(exps("(-1)^(pi^2206)")).toEqual(["(pi^2206)", "2206"]);
    expect(exps("(-1)^pi^2206*2")).toEqual(["pi^2206", "2206"]);
    expect(powersIn("sqrt(2)^x+i^ 2.5", "typed").map((p) => p.base)).toEqual(["sqrt(2)", "i"]);
    expect(exps("a^-f(x)+1")).toEqual(["-f(x)"]);
    expect(exps("(-1)^pi*pi^3000")).toEqual(["pi", "3000"]);
  });
  it("skips a caret in a string", () => {
    expect(powersIn('"2^3"+x', "typed")).toEqual([]);
    expect(powersIn('"a"""+x^2', "printed")).toEqual([{ base: "x", exponent: [8, 9] }]);
  });
  it("negated: a minus first inside the brackets that hold the whole operand", () => {
    expect(negated("(-1)", "typed")).toBe(true);
    expect(negated("((-2))", "typed")).toBe(true);
    expect(negated("-x", "typed")).toBe(true);
    expect(negated("(1-2)", "typed")).toBe(false);
    expect(negated("(-1)*(2)", "typed")).toBe(false);
    expect(negated("pi", "typed")).toBe(false);
  });
});
