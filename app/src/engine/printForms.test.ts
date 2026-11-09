// SPDX-License-Identifier: GPL-3.0-or-later
// G173 (F108, F127, F93's `when`): Giac's print forms never reach the text. A sequence of no element is refused, one or more
// follow G119's Home rule in CAS too; a matrix type inside a list reads as plain rows; `?:` reads as when(c,a,b). Values
// derived by hand: idn(2) is the 2×2 identity, x²−2x+1 = (x−1)² has its minimum at x = 1.
import { beforeAll, describe, expect, it } from "vitest";
import type { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { holdsMatrixType, onlyMatrixType, soleMatrix, whenCalls } from "./giacPrint.ts";
import { casItem, homeItem } from "../state/resultItem.ts";
import { copyFull } from "../clipboard/text.ts";
import { giacOfEntry } from "../input/entry.ts";

describe("whenCalls", () => {
  it("writes Giac's ?: as when(c,a,b), nested and inside larger answers", () => {
    expect(whenCalls("((x>0)? x+1 : x-1)")).toBe("when(x>0,x+1,x-1)");
    expect(whenCalls("((x>0)? ((1>x)? 1 : 2) : 3)")).toBe("when(x>0,when(1>x,1,2),3)");
    expect(whenCalls("((((y>0)? 1 : 0)>0)? 1 : 2)")).toBe("when(when(y>0,1,0)>0,1,2)");
    expect(whenCalls("[((x>1)? 1 : 2),2*((x>2)? 1 : 2)]+1")).toBe("[when(x>1,1,2),2*when(x>2,1,2)]+1");
    expect(whenCalls(" (x)->((x>0)? 1 : 2)")).toBe(" (x)->when(x>0,1,2)");
  });

  it("leaves strings and anything else alone", () => {
    expect(whenCalls('((x>0)? "a : b" : "c")')).toBe('when(x>0,"a : b","c")');
    expect(whenCalls('"((x>0)? 1 : 2)"')).toBe('"((x>0)? 1 : 2)"');
    expect(whenCalls("(a+b)*(c)")).toBe("(a+b)*(c)");
    expect(whenCalls("((x>0)? 1")).toBe("((x>0)? 1");
  });
});

describe("holdsMatrixType", () => {
  it("finds Giac's matrix print at any depth, outside strings and names", () => {
    expect(holdsMatrixType("matrix[[1]]")).toBe(true);
    expect(holdsMatrixType("[matrix[[1,0],[0,1]],1]")).toBe(true);
    expect(holdsMatrixType("list[matrix[[1]]]")).toBe(true);
    expect(holdsMatrixType("mymatrix[1]")).toBe(false);
    expect(holdsMatrixType('["matrix[1]",2]')).toBe(false);
    expect(holdsMatrixType("[[1,0],[0,1]]")).toBe(false);
  });
});

describe("soleMatrix and onlyMatrixType", () => {
  it("reads the one matrix a list or vector holds, and which of the two it is", () => {
    expect(soleMatrix("list[[[1,0],[0,1]]]")).toEqual({ matrix: "[[1,0],[0,1]]", list: true });
    expect(soleMatrix("[[[1,0],[0,1]]]")).toEqual({ matrix: "[[1,0],[0,1]]", list: false });
    expect(soleMatrix("[list[[[1]]]]")).toEqual({ matrix: "list[[[1]]]", list: false });
  });

  it("is null for a matrix, a vector of numbers, or more than one element", () => {
    expect(soleMatrix("[[1,0],[0,1]]")).toBeNull();
    expect(soleMatrix("[[1,2]]")).toBeNull();
    expect(soleMatrix("list[[[1,0],[0,1]],1]")).toBeNull();
    expect(soleMatrix("list[1,2]")).toBeNull();
    expect(soleMatrix("x")).toBeNull();
  });

  it("says when the only matrix type is the whole print", () => {
    expect(onlyMatrixType("matrix[[1,0],[0,1]]")).toBe(true);
    expect(onlyMatrixType("matrix[matrix[[1]],[2]]")).toBe(false);
    expect(onlyMatrixType("[matrix[[1]],1]")).toBe(false);
    expect(onlyMatrixType("matrix[[1]]*x")).toBe(false);
  });
});

describe.skipIf(!giacAvailable())("G173 on the real engine", () => {
  let host: EngineHost;
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  beforeAll(async () => {
    host = await nodeHost();
  });
  const copyHome = (input: string) => {
    const { exact: _e, ...r } = home(input);
    return copyFull({ latex: "", status: "done", text: r.display, ...homeItem(r, false) });
  };
  const copyCas = (input: string) => {
    const r = cas(input);
    return copyFull({ latex: "", status: "done", text: r.text, ...casItem(r, false) });
  };

  it("refuses a sequence of no element in Home and CAS", () => {
    expect(home("op([])")).toMatchObject({ ok: false, error: "noValue", display: "No value found" });
    expect(cas("op([])")).toMatchObject({ ok: false, error: "noValue", text: "No value found" });
  });

  it("stores nothing for a refused empty sequence", () => {
    expect(cas("E:=op([])")).toMatchObject({ ok: false, error: "noValue" });
    expect(cas("E")).toMatchObject({ ok: true, text: "E" });
    expect(home("E:=op([])")).toMatchObject({ ok: false, error: "noValue" });
    expect(home("E")).toMatchObject({ ok: true, display: "E" });
  });

  it("gives CAS G119's Home rule: one element is its value, several a list", () => {
    const one = cas("fMin(x^2-2*x+1,x)");
    expect(one).toMatchObject({ ok: true, text: "1", latex: "1" });
    expect(copyCas("fMin(x^2-2*x+1,x)")).toBe("1");
    expect(cas("op([1,-1])")).toMatchObject({ ok: true, text: "{1,-1}", full: "list[1,-1]" });
    expect(cas("B:=op([1,2])")).toMatchObject({ ok: true, text: "{1,2}" });
    // a stored sequence is the list too, so B+1 adds elementwise (Giac adds a sequence's elements into one sum)
    expect(cas("B+1")).toMatchObject({ ok: true, text: "{2,3}" });
  });

  it("shows a matrix inside a list as plain rows, in Home and CAS", () => {
    expect(home("[idn(2),1]")).toMatchObject({ ok: true, display: "[[[1,0],[0,1]],1]" });
    expect(cas("[idn(2),1]")).toMatchObject({ ok: true, text: "[[[1,0],[0,1]],1]" });
    expect(home("[idn(2),idn(2)]")).toMatchObject({ ok: true, display: "[[[1,0],[0,1]],[[1,0],[0,1]]]" });
    expect(home("list[idn(2)]")).toMatchObject({ ok: true, display: "{[[1,0],[0,1]]}", full: "list[[[1,0],[0,1]]]" });
    expect(cas("list[idn(2)]")).toMatchObject({ ok: true, text: "{[[1,0],[0,1]]}" });
    expect(copyHome("list[idn(2)]")).toBe("{[[1,0],[0,1]]}");
  });

  it("keeps the other elements as they are", () => {
    expect(home("[list[1,2],idn(2)]")).toMatchObject({ ok: true, display: "[{1,2},[[1,0],[0,1]]]" });
    expect(cas("[list[1,2],idn(2)]")).toMatchObject({ ok: true, text: "[{1,2},[[1,0],[0,1]]]" });
    expect(home("[idn(2),x]")).toMatchObject({ ok: true, display: "[[[1,0],[0,1]],x]" });
  });

  it("draws a list holding one matrix as that, in CAS", () => {
    const { latex } = cas("list[idn(2)]");
    expect(latex).toContain("\\{");
    expect(latex).toContain("\\begin{array}{cc}\n1 & 0 \\\\\n0 & 1\n\\end{array}");
    expect(latex).not.toContain("[1,0]");
  });

  // fix round 1: in DEG the drawing comes from the degree text; pasdeg is the factor our parser puts in every angle
  it("draws a list holding one matrix as that, in CAS DEG too", () => {
    const deg = { ...defaultCasSettings, angle: "deg" as const };
    const r = host.cas("list[[[sin(pasdeg*x),1],[1,cos(pasdeg*x)]]]", deg).result;
    expect(r).toMatchObject({ ok: true, text: "{[[sin(x),1],[1,cos(x)]]}" });
    expect(r.latex).toContain("\\{");
    expect(r.latex).toContain("\\begin{array}{cc}");
    expect(r.latex).not.toContain("[1,");
    expect(r.latex).not.toContain("pi");
  });

  it("still reads a stored list of a matrix (guard: passes on phase-1 too)", () => {
    expect(home("A:=[idn(2),1]")).toMatchObject({ ok: true });
    expect(home("A[0]*2")).toMatchObject({ ok: true, display: "[[2,0],[0,2]]" });
  });

  it("shows when(…) as the call, and that text gives the same answer typed back", () => {
    const want = "when(x>0,x+1,x-1)";
    expect(home(want)).toMatchObject({ ok: true, display: want, full: "((x>0)? x+1 : x-1)" });
    expect(cas(want)).toMatchObject({ ok: true, text: want, full: "((x>0)? x+1 : x-1)" });
    expect(copyHome(want)).toBe(want);
    expect(copyCas(want)).toBe(want);
    // the copied text on the entry line, as our parser reads it (home: \operatorname{when} is the typed call)
    const typed = giacOfEntry("\\operatorname{when}\\left(x>0,x+1,x-1\\right)", "home").giac;
    expect(home(typed).display).toBe(want);
    expect(cas(giacOfEntry("\\operatorname{when}\\left(x>0,x+1,x-1\\right)", "cas").giac).text).toBe(want);
  });

  it("keeps Giac's value for Ans", () => {
    home("when(x>0,x+1,x-1)");
    expect(home("pasans")).toMatchObject({ ok: true, display: "when(x>0,x+1,x-1)" });
  });
});
