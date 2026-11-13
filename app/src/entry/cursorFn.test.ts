// SPDX-License-Identifier: GPL-3.0-or-later
// R196: which function the cursor is in, on the entry's LaTeX alone. `|` marks the cursor in each case.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { FUNCS, GREEK } from "../input/parseTables.ts";
import { isInfixWord } from "./boxes.ts";
import { functionAt as scanAt } from "./cursorFn.ts";
import { CHIP_MACROS } from "./macros.ts";

/** R197: the words the scan reads, from their source (cursorFn.ts FnWords). */
const functionAt = (latex: string, offset: number): string | null => scanAt(latex, offset, { funcs: FUNCS, greek: GREEK, isInfixWord });

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const yaml = <T>(f: string): T => parse(readFileSync(join(root, f), "utf8")) as T;
/** find/where.yaml: the key templates of Find's functions (id → the insert, `#0` and `#?` its slots). */
const links = yaml<{ links: Record<string, string> }>("find/where.yaml").links;
/** find/functions.yaml: the curated functions; no `insert` means `\operatorname{<giac>}\left(#0\right)`. */
const curated = yaml<{ functions: { id: string; giac: string; insert?: string }[] }>("find/functions.yaml").functions;
/** Templates the cursor is never inside, each with its reason. */
const NOT_A_TEMPLATE: Readonly<Record<string, string>> = {
  "fn:factorial": "! is a postfix mark with no box: its operand is what stands before it, on the line",
};

/** Each slot of `template` filled as a key leaves it (□ for `#?`, nothing for `#0`), with the offset of that slot. */
function slots(template: string): { latex: string; offset: number }[] {
  const parts = template.split(/(#0|#\?)/);
  const fill = (k: number): { latex: string; offset: number } => {
    let latex = "";
    let offset = -1;
    parts.forEach((p, i) => {
      if (i === k) offset = latex.length;
      latex += p === "#?" ? (i === k ? "" : "\\placeholder{}") : p === "#0" ? "" : p;
    });
    return { latex, offset };
  };
  return parts.flatMap((p, i) => (p === "#0" || p === "#?" ? [fill(i)] : []));
}

/** The Find id at the `|` of `marked` (the bar is taken out first). */
const at = (marked: string): string | null => {
  const o = marked.indexOf("|");
  if (o < 0 || marked.indexOf("|", o + 1) >= 0) throw new Error(`one | please: ${marked}`);
  return functionAt(marked.slice(0, o) + marked.slice(o + 1), o);
};

describe("functionAt (R196)", () => {
  it("finds the function whose bracket holds the cursor", () => {
    expect(at("\\sin\\left(1+|\\right)")).toBe("fn:sin");
    expect(at("2\\cdot\\sin\\left(|1\\right)+3")).toBe("fn:sin");
    expect(at("\\sin\\left(1|\\right)")).toBe("fn:sin");
  });

  it("takes the innermost function", () => {
    expect(at("\\sin\\left(\\cos\\left(|\\right)\\right)")).toBe("fn:cos");
    expect(at("\\sin\\left(1+|\\cos\\left(2\\right)\\right)")).toBe("fn:sin");
    expect(at("\\sin\\left(\\cos\\left(2\\right)|\\right)")).toBe("fn:sin");
    // a plain pair inside a function is no function of its own
    expect(at("\\ln\\left(\\left(1+|2\\right)\\cdot3\\right)")).toBe("fn:ln");
    // nor is a fraction
    expect(at("\\exp\\left(\\frac{1}{|2}\\right)")).toBe("fn:exp");
  });

  it("finds the function on its name", () => {
    expect(at("\\si|n\\left(1\\right)")).toBe("fn:sin");
    expect(at("\\sin|\\left(1\\right)")).toBe("fn:sin");
    expect(at("\\operatorname{std|dev}\\left(1\\right)")).toBe("fn:stddev");
  });

  it("is null outside any function", () => {
    expect(at("|")).toBeNull();
    expect(at("1+|2")).toBeNull();
    expect(at("|\\sin\\left(1\\right)")).toBeNull();
    expect(at("\\sin\\left(1\\right)|")).toBeNull();
    expect(at("\\sin\\left(1\\right)+|2")).toBeNull();
    expect(at("\\left(1+|2\\right)")).toBeNull();
    expect(at("\\frac{1}{|2}")).toBeNull();
  });

  it("reads a function written with \\operatorname", () => {
    expect(at("\\operatorname{stddev}\\left(|\\right)")).toBe("fn:stddev");
    expect(at("\\operatorname{\\mathrm{stddev}}\\left(|\\right)")).toBe("fn:stddev");
    expect(at("\\operatorname{NOT}\\left(x>|0\\right)")).toBe("fn:not");
    expect(at("\\operatorname{Gamma}\\left(|\\right)")).toBe("fn:Gamma");
    // AND, OR and XOR stand between their operands: no call, and the bracket after one is a plain pair
    expect(at("x>0\\operatorname{AND}\\left(x<|1\\right)")).toBeNull();
  });

  it("gives Find's id where it differs from the command", () => {
    expect(at("\\arcsin\\left(|\\right)")).toBe("fn:asin");
    expect(at("\\log\\left(|\\right)")).toBe("fn:log10");
    expect(at("\\log_{2}\\left(|\\right)")).toBe("fn:logb");
    expect(at("\\log_{|2}\\left(8\\right)")).toBe("fn:logb");
    expect(at("\\lim_{x\\to0}\\left(|\\right)")).toBe("fn:limit");
    expect(at("\\sum_{i=1}^{n}\\left(|i\\right)")).toBe("fn:sum");
    expect(at("\\prod_{i=|1}^{n}\\left(i\\right)")).toBe("fn:product");
    expect(at("\\sqrt{|2}")).toBe("fn:sqrt");
    expect(at("\\sqrt[3]{|2}")).toBe("tmpl:cbrt");
    expect(at("\\sqrt[4]{|2}")).toBe("fn:surd");
    // |x| draws its own bars: the cursor goes by offset here, after the −
    expect(functionAt("\\left|-2\\right|", 7)).toBe("fn:abs");
    expect(functionAt("1+\\left|-2\\right|", 2)).toBeNull();
  });

  it("is null on a chip, and never reads what a chip shows", () => {
    expect(at("\\res{1}{2}|")).toBeNull();
    expect(at("\\res{1}{\\sin\\left(|1\\right)}")).toBeNull();
    expect(at("\\const{c}{|c}")).toBeNull();
    expect(at("\\sin\\left(\\res{1}{\\cos\\left(1\\right)}|\\right)")).toBe("fn:sin");
    expect(at("\\sin\\left(\\ans|\\right)")).toBe("fn:sin");
  });

  it.each(Object.entries(links))("finds %s in each slot of its key's template (find/where.yaml)", (id, template) => {
    const all = slots(template);
    if (NOT_A_TEMPLATE[id] !== undefined) return expect(all).toEqual([]);
    expect(all.length).toBeGreaterThan(0);
    for (const { latex, offset } of all) expect(functionAt(latex, offset), `${latex} at ${offset}`).toBe(id);
  });

  it("lists no exception that where.yaml does not hold", () => {
    for (const id of Object.keys(NOT_A_TEMPLATE)) expect(links[id], id).toBeDefined();
  });

  it.each(curated.map((f) => [f.id, f] as const))("finds %s at #0 of its Find insert (find/functions.yaml)", (id, f) => {
    const insert = f.insert ?? `\\operatorname{${f.giac.replace(/_/g, "\\_")}}\\left(#0\\right)`;
    for (const { latex, offset } of slots(insert)) expect(functionAt(latex, offset), `${latex} at ${offset}`).toBe(id);
  });

  it("finds the templates inside other content", () => {
    // ∫ with a ∫ in its integrand: the inner one takes the first d
    const outer = "\\int_{0}^{1}\\int_{0}^{2}y\\,\\mathrm{d}y\\,\\mathrm{d}x";
    expect(functionAt(outer, outer.length)).toBe("fn:int");
    expect(functionAt(`${outer}+1`, outer.length)).toBe("fn:int");
    expect(at("\\int_{0}^{1}x\\,\\mathrm{d}\\theta|")).toBe("fn:int");
    expect(functionAt(outer, outer.indexOf("y\\,"))).toBe("fn:int");
    expect(functionAt(`${outer}+1`, outer.length + 1)).toBeNull();
    expect(at("\\int_{0}^{1}\\sin\\left(|x\\right)\\,\\mathrm{d}x")).toBe("fn:sin");
    expect(at("\\exponentialE^{|2}")).toBe("fn:exp");
    expect(at("\\exponentialE^{2}+|1")).toBeNull();
    expect(at("\\exponentialE+|1")).toBeNull();
    expect(at("\\frac{\\partial\\sin\\left(|x\\right)}{\\partial x}")).toBe("fn:sin");
    expect(at("\\frac{\\partial x^2}{\\partial |x}")).toBe("fn:diff");
    expect(at("\\operatorname{normald\\_cdf}\\left(|\\right)")).toBe("fn:normald_cdf");
  });

  it.each(Object.entries(CHIP_MACROS))("never reads what the \\%s chip shows (entry/macros.ts)", (name, m) => {
    const chip = `\\${name}${"{\\sin\\left(1\\right)}".repeat(m.args)}`;
    for (let o = 1; o < chip.length; o++) expect(functionAt(chip, o), `${chip} at ${o}`).toBeNull();
  });

  it("is null for an offset off the line", () => {
    expect(functionAt("\\sin\\left(1\\right)", -1)).toBeNull();
    expect(functionAt("\\sin\\left(1\\right)", 99)).toBeNull();
    expect(functionAt("\\sin\\left(1\\right)", 1.5)).toBeNull();
  });
});
