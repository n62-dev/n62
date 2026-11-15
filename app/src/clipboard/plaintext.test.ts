// SPDX-License-Identifier: GPL-3.0-or-later
// R134: what people paste is plain text. Every cell of the Symbols palette, every constant chip and every unit slot's
// LaTeX (plain and rare) read through entryText leaves no backslash and no brace. The constants and units are the Find
// index's (npm run index; FIND_INDEX=required fails instead of skipping when it is missing).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { constChip } from "../entry/macros.ts";
import type { IndexItem } from "../find/types.ts";
import { SlotModel, slotCatalogue } from "../units/slot.ts";
import { entryText, PLAIN_COMMANDS } from "./plaintext.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const index: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = index.some((it) => it.kind === "unit" && it.si !== undefined);
const needIndex = (): boolean => {
  if (hasIndex) return true;
  if (process.env["FIND_INDEX"] === "required") expect.fail("app/src/find/_gen/find-index.json is missing or holds functions only; run npm run index");
  return false;
};

interface Action {
  insert?: string;
  sample?: [string, string];
  line?: Action;
}
interface Key {
  id: string;
  primary?: Action;
  shift?: Action;
}
interface TemplateItem extends Action {
  id: string;
  key?: string;
  layer?: "primary" | "shift";
}
const kb = parse(readFileSync(join(here, "../../../spec/keyboard.yaml"), "utf8")) as {
  symbols: { items: { id: string; insert: string; desc: string }[] };
  keys: Key[];
  templates: { items: TemplateItem[] };
};
const PALETTE = kb.symbols.items;
const clean = (s: string): boolean => !/[\\{}]/.test(s);

describe("plain text of what is shared (R134)", () => {
  it("every insert of the Symbols palette has its text, and the command table holds no name the palette lacks for a letter", () => {
    for (const c of PALETTE) {
      const t = entryText(`2${c.insert}`);
      expect(clean(t), `${c.id}: ${t}`).toBe(true);
      const name = /^\\([A-Za-z]+)$/.exec(c.insert)?.[1];
      if (name !== undefined && !["rightarrow"].includes(name)) expect(PLAIN_COMMANDS, c.id).toContain(name);
    }
    expect(entryText("\\alpha")).toBe("α");
    expect(entryText("\\varepsilon")).toBe("ε");
    expect(entryText("\\varphi")).toBe("φ");
    expect(entryText("\\Delta")).toBe("Δ");
    expect(entryText("\\Omega")).toBe("Ω");
  });

  it("every constant chip (symbol with braces, Greek, \\mathrm) is plain", () => {
    if (!needIndex()) return;
    const consts = index.filter((it) => it.kind === "const");
    expect(consts.length).toBeGreaterThan(40);
    for (const it of consts) {
      const m = /^\\const\{([^{}]*)\}\{(.*)\}$/.exec(it.insert ?? "");
      const t = entryText(`${constChip(m?.[1] ?? "", m?.[2] ?? "")}\\times2`);
      expect(clean(t), `${it.id}: ${t}`).toBe(true);
    }
  });

  it("every unit slot's LaTeX, plain and rare, is plain", () => {
    if (!needIndex()) return;
    const cat = slotCatalogue(index);
    const ids = [...cat.units.keys()];
    expect(ids.length).toBeGreaterThan(300);
    const lines: string[] = [];
    for (const id of ids) {
      const plain = new SlotModel(cat);
      plain.apply({ do: "unit", id });
      lines.push(plain.latex);
      const rare = new SlotModel(cat);
      rare.apply({ do: "pair", prefix: "M", id });
      rare.apply({ do: "power", n: 2 });
      rare.apply({ do: "per" });
      rare.apply({ do: "unit", id: "s" });
      lines.push(rare.latex);
      const root = new SlotModel(cat);
      root.apply({ do: "sqrt" });
      root.apply({ do: "pair", prefix: "k", id });
      lines.push(root.latex);
    }
    expect(lines.some((l) => l.includes("\\class{pas-rare}"))).toBe(true);
    for (const l of lines) {
      const t = entryText(`5\\,${l}\\to\\,${l}`);
      expect(clean(t), `${l} → ${t}`).toBe(true);
    }
  });
  it("templates, functions, relations and the mixed number read as people write them (R199, F180)", () => {
    const cases: [string, string][] = [
      ["\\sum_{k=1}^{10}k", "sum(k=1..10) k"],
      ["\\prod_{k=1}^{3}k", "prod(k=1..3) k"],
      ["\\sqrt[3]{8}", "root(3, 8)"],
      ["\\lim_{x\\to0}x", "lim(x→0) x"],
      ["\\sin\\left(x\\right)", "sin(x)"],
      ["2\\mathbin{\\measuredangle}30", "2∡30"],
      ["a\\leq b", "a ≤ b"],
      ["a\\rightarrow b", "a → b"],
      ["\\leq", "≤"],
      ["2\\tfrac12", "2 1/2"],
      ["2\\tfrac{11}{13}", "2 11/13"],
      ["\\frac12", "1/2"],
      ["1.5\\emark-3", "1.5E-3"],
      ["\\log_{16}\\left(256\\right)", "log_16(256)"],
      ["\\sum_{k=1}^{n+1}\\left(k^{2}\\right)", "sum(k=1..(n+1)) (k^2)"],
      ["\\sqrt[3]{x+1}+\\sqrt{4}", "root(3, x+1)+sqrt(4)"],
    ];
    for (const [latex, text] of cases) expect(entryText(latex), latex).toBe(text);
  });

  it("a list, a matrix, cases and an integral read as people write them, with no backslash (R306)", () => {
    const cases: [string, string][] = [
      ["\\left\\{1,2,3\\right\\}", "{1,2,3}"],
      ["\\left\\{\\right\\}", "{}"],
      ["\\operatorname{stats1}\\left(\\left\\{1,2,3,4\\right\\}\\right)", "stats1({1,2,3,4})"],
      ["\\operatorname{linreg}\\left(\\left\\{1,2,3\\right\\},\\left\\{2,4,7\\right\\}\\right)", "linreg({1,2,3},{2,4,7})"],
      ["M:=\\begin{pmatrix}1&2\\\\9&4\\end{pmatrix}", "M:=[[1,2],[9,4]]"],
      ["\\begin{pmatrix}1 & 2\\\\ 3 & 4\\end{pmatrix}", "[[1,2],[3,4]]"],
      ["\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}", "[[1,2],[3,4]]"],
      ["\\begin{pmatrix}5\\end{pmatrix}", "[[5]]"],
      ["\\begin{pmatrix}1 & 2\\end{pmatrix}", "[[1,2]]"],
      ["\\begin{pmatrix}1\\\\ 2\\end{pmatrix}", "[[1],[2]]"],
      ["\\begin{pmatrix}\\frac{1}{2} & x^{2}\\\\ \\sqrt{2} & \\pi\\end{pmatrix}", "[[1/2,x^2],[sqrt(2),π]]"],
      ["\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}", "{x if x=0; 1 if x=1}"],
      ["\\int_{-1}^{10}x^2\\,\\mathrm{d}x", "int(-1..10) x^2 dx"],
      ["\\int_{0}^{\\pi}\\sin\\left(x\\right)\\,\\mathrm{d}x", "int(0..π) sin(x) dx"],
      ["\\int_{a+1}^{2b}t\\,\\mathrm{d}t", "int((a+1)..2b) t dt"],
      ["\\frac{\\partial x^2}{\\partial x}", "∂/∂x (x^2)"],
      ["\\left.x^2\\right|_{x=3}", "(x^2 | x=3)"],
      ["\\left.\\frac{1}{x}\\right|_{x=2}+1", "(1/x | x=2)+1"],
    ];
    for (const [latex, text] of cases) {
      expect(entryText(latex), latex).toBe(text);
      expect(entryText(latex), latex).not.toContain("\\");
    }
  });

  it("the decimal comma setting, not the entry, picks `;` between elements: a whole-number matrix too (R306 fix 2, R100)", () => {
    const comma = { decimalComma: true };
    const cases: [string, string][] = [
      ["\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}", "[[1;2];[3;4]]"],
      ["\\begin{pmatrix}1{,}5 & 2\\\\ 3 & 4\\end{pmatrix}", "[[1,5;2];[3;4]]"],
      ["\\left\\{1{,}5;2\\right\\}", "{1,5;2}"],
    ];
    for (const [latex, text] of cases) expect(entryText(latex, comma), latex).toBe(text);
    // without the setting a point is the mark, and the comma separates
    expect(entryText("\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}")).toBe("[[1,2],[3,4]]");
  });

  it("a fraction part is bare only as a call of a known function; an implied product keeps its brackets (R306 fix 1)", () => {
    const cases: [string, string][] = [
      ["\\frac{1}{x\\left(x+1\\right)}", "1/(x(x+1))"],
      ["\\frac{a}{b\\left(c\\right)}", "a/(b(c))"],
      ["\\frac{\\operatorname{f}\\left(x\\right)}{2}", "(f(x))/2"],
      ["\\frac{\\sin\\left(x\\right)}{\\cos\\left(x\\right)}", "sin(x)/cos(x)"],
      ["\\frac{1}{\\ln\\left(2\\right)}", "1/ln(2)"],
    ];
    for (const [latex, text] of cases) expect(entryText(latex), latex).toBe(text);
  });

  it("every template of the Tmpl palette and the list and matrix keys read with no backslash and no brace group (R306)", () => {
    const keys = new Map(kb.keys.map((k) => [k.id, k]));
    const samples: [string, string][] = [];
    for (const it of kb.templates.items) {
      const a = it.key !== undefined ? keys.get(it.key)?.[it.layer ?? "primary"] : it;
      expect(a?.sample, it.id).toBeDefined();
      samples.push([it.id, a!.sample![0]]);
      if (a?.line?.sample) samples.push([`${it.id} (one-line)`, a.line.sample[0]]);
    }
    for (const id of ["d8", "d5"]) {
      const a = keys.get(id)?.shift;
      expect(a?.sample, id).toBeDefined();
      samples.push([id, a!.sample![0]]);
    }
    expect(samples.length).toBeGreaterThan(18);
    for (const [id, latex] of samples) {
      const t = entryText(latex);
      expect(t, `${id}: ${latex} → ${t}`).not.toMatch(/\\/);
      // braces only as a list or a piecewise, never a LaTeX group left over
      if (!/\\left\\{|\\begin\{cases\}/.test(latex)) expect(t, `${id}: ${latex} → ${t}`).not.toMatch(/[{}]/);
    }
    const read = (latex: string): string => entryText(latex);
    expect(read("\\sum_{k=1}^{10}\\left(k^2\\right)")).toBe("sum(k=1..10) (k^2)");
    expect(read("\\prod_{k=1}^{10}\\left(k\\right)")).toBe("prod(k=1..10) (k)");
    expect(read("\\lim_{x\\to0}\\left(\\frac{\\sin\\left(x\\right)}{x}\\right)")).toBe("lim(x→0) (sin(x)/x)");
    expect(read("\\left|-3\\right|")).toBe("|-3|");
    expect(read("30\\degree15\\prime36\\doubleprime")).toBe("30°15′36″");
  });
});
