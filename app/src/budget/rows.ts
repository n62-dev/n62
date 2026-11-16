// SPDX-License-Identifier: GPL-3.0-or-later
// R328 (the owner, 2026-11-15; mh-C1, variant A): the uncertainty sheet's rows under R327's head, each input's share of σ²
// as docs/mockups/uncertainty-sheet.html sections 2 to 4 draw them: the input as typed (or the chip, the constant), its uᵢ
// in the result's unit, its % of σ², then one signed "second order" row last; the lines under them (over 100 %, rounded,
// or why there are no shares). Every number is G272's (budget/model.ts budgetOf); this module only words and places
// them. A unit row reads G273's terms (UnitRow.unc), a Home row G274's uncTerms (first order: no second-order row). Pure:
// views/uncSheet.ts and UncHead.svelte draw it, in the sheet's chunk with the model.
import { entryText } from "../clipboard/plaintext.ts";
import { uncText } from "../i18n/enUnc.ts";
import { commaResult, type FmtMode } from "../state/displayMode.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { sigmaShown } from "../state/sigmaLine.ts";
import type { UncWhy } from "../units/types.ts";
import { parseDecimal } from "../units/uncertainty.ts";
import { budgetOf, type BudgetInput, type BudgetReason, type BudgetRow, type BudgetShare } from "./model.ts";

/** One row of the table: an input, or the second-order part (`second`). */
export interface ShareRow {
  id: string;
  /** The input as typed ("3.2 ± 0.1 m"), the chip's or constant's text, or "second order". */
  label: string;
  /** What the label stands for, under it: "result chip", "via μ₀, ε₀" (a basis leaf). */
  sub?: string;
  /** |∂f/∂xᵢ · uᵢ| at 2 significant digits in the result's unit; "" for the second-order row. */
  uy: string;
  /** "98.3 %", "< 0.1 %", "−4.2 %". */
  share: string;
  /** The bar under the share, its width in % of the cell: `over` ends it in a stripe (above 100 %), `neg` draws it from
   *  the right in the warn colour (a negative second order). */
  bar: { width: number; over?: true; neg?: true };
  /** The warn-coloured note of an input the model takes as independent (a result chip, a constant with no basis). */
  note?: string;
  second?: true;
}

export interface ShareTable {
  /** The column heads: Input, uᵢ, % of σ². */
  columns: readonly [string, string, string];
  rows: ShareRow[];
  /** The muted lines under the rows, or the one line that says why there are none. */
  lines: string[];
}

const LINE: Readonly<Record<BudgetReason, "unc.rows.jump" | "unc.rows.singular" | "unc.rows.firstOrderZero">> = {
  jump: "unc.rows.jump",
  singular: "unc.rows.singular",
  firstOrderZero: "unc.rows.firstOrderZero",
};

const isTerm = (x: unknown): x is { key?: string; t: string; uy: string } => {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o["t"] === "string" && typeof o["uy"] === "string" && (o["key"] === undefined || typeof o["key"] === "string");
};

/** What the model is made from: a unit row's terms and second-order part (G273), else a Home row's terms (G274). Both
 *  are read back unchecked from the history: a bad shape is no table. */
function inputOf(item: HistoryItem): (BudgetInput & { unit: string; home: boolean }) | null {
  const unc = item.units?.unc;
  const terms: unknown = unc ? unc.terms : (item.uncTerms ?? alone(item));
  if (!Array.isArray(terms) || !terms.length || !terms.every(isTerm)) return null;
  if (unc && unc.second !== undefined && typeof unc.second !== "string") return null;
  const why: UncWhy | undefined = unc?.why;
  // a constant with no basis (G81): its chip has σ and no basis; it is taken as independent of the other terms
  const noBasis = Object.entries(item.chips ?? {})
    .filter(([k, c]) => k.startsWith("const:") && c.unc !== undefined && c.basis === undefined)
    .map(([k]) => k.slice("const:".length));
  return {
    terms,
    ...(unc?.second !== undefined ? { second: unc.second } : {}),
    ...(why ? { why } : {}),
    noBasis,
    unit: unc ? (item.units?.unit ?? "") : "",
    home: !unc,
  };
}

/** The chip keys of the line as the terms name them: `const:G` is G, `res:3` is pasr_3, `ans` is pasr_ans. */
const termKey = (chip: string): string | null =>
  chip.startsWith("const:") ? chip.slice("const:".length) : chip.startsWith("res:") ? `pasr_${chip.slice("res:".length)}` : chip === "ans" ? "pasr_ans" : null;

/** A Home row with σ from one input alone: G274 keeps no terms for it (one input says nothing σ does not), so its one
 *  term is σ itself, t = σ² and uy = σ, keyed by the line's one chip with σ; undefined for anything else. */
function alone(item: HistoryItem): { key: string; t: string; uy: string }[] | undefined {
  const sigma = item.facts?.uncSigma;
  const d = typeof sigma === "string" ? parseDecimal(sigma) : null;
  const withSigma = Object.entries(item.chips ?? {}).filter(([, c]) => c.unc !== undefined);
  const key = withSigma.length === 1 ? termKey(withSigma[0]![0]) : null;
  return d && key ? [{ key, t: `${d.m * d.m}E${2 * d.k}`, uy: sigma as string }] : undefined;
}

// ---- the labels: the inputs as the line holds them ----

type Tok = string;
/** LaTeX as tokens: a command (`\pm`, `\,`), a brace, or one character. */
const tokens = (latex: string): Tok[] => latex.match(/\\[A-Za-z]+|\\.|[\s\S]/g) ?? [];

/** The end of the braced group starting at `i` (its `{`), or `i` when there is none. */
function group(t: readonly Tok[], i: number): number {
  if (t[i] !== "{") return i;
  for (let d = 0, k = i; k < t.length; k++) {
    if (t[k] === "{") d++;
    else if (t[k] === "}" && --d === 0) return k + 1;
  }
  return t.length;
}

/** The chips' macros, whose groups hold drawn text (a chip's own ±), not typed input. */
const CHIP_ARGS: Readonly<Record<string, number>> = { "\\res": 2, "\\const": 2 };
/** Unit commands and how many groups follow each (units/slot.ts SlotModel.latex). */
const UNIT_ARGS: Readonly<Record<string, number>> = { "\\mathrm": 1, "\\text": 1, "\\sqrt": 1, "\\frac": 2, "\\class": 2, "\\htmlStyle": 2 };

const digit = (x: Tok | undefined): boolean => x !== undefined && /^[0-9.]$/.test(x);

/** The number that ends just before `j` (digits, a point, `{,}`, `ᴇ` with its sign): its first token. */
function numberBefore(t: readonly Tok[], j: number): number {
  let k = j;
  for (;;) {
    if (digit(t[k - 1])) k--;
    else if (t[k - 1] === "}" && t[k - 2] === "," && t[k - 3] === "{") k -= 3;
    else if ((t[k - 1] === "-" || t[k - 1] === "+") && t[k - 2] === "\\emark") k -= 2;
    else if (t[k - 1] === "\\emark") k--;
    else return k;
  }
}

/** The number that starts at `j`: the token after it. */
function numberAt(t: readonly Tok[], j: number): number {
  let k = j;
  for (;;) {
    if (digit(t[k])) k++;
    else if (t[k] === "{" && t[k + 1] === "," && t[k + 2] === "}") k += 3;
    else if (t[k] === "\\emark") k += t[k + 1] === "-" || t[k + 1] === "+" ? 2 : 1;
    else return k;
  }
}

/** The unit after a typed ± (`\,` then the slot's LaTeX): the token after it. */
function unitAt(t: readonly Tok[], j: number): number {
  if (t[j] !== "\\,") return j;
  let k = j + 1;
  for (;;) {
    const n = UNIT_ARGS[t[k] ?? ""];
    if (n !== undefined) {
      k++;
      for (let g = 0; g < n; g++) k = group(t, k);
    } else if (t[k] === "^" && t[k + 1] === "{") k = group(t, k + 1);
    else if (t[k] === "\\cdot" && UNIT_ARGS[t[k + 1] ?? ""] !== undefined) k++;
    else return k > j + 1 ? k : j;
  }
}

const SUPER: Readonly<Record<string, string>> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };

/** A piece of the line as plain text, as the head writes numbers: ± spaced, `ᴇ`, a unit's powers raised. */
function plain(latex: string, comma: boolean): string {
  const s = entryText(latex, { decimalComma: comma })
    .replace(/(\d)E/g, "$1ᴇ")
    .replace(/\^\(?(-?\d+)\)?/g, (_, p: string) => [...p].map((c) => SUPER[c] ?? c).join(""));
  return s.replace(/\s*±\s*/g, " ± ");
}

/** Each typed ± of `latex` (a unit row's request as drawn, or the line), in order, outside the chips: the value ± σ with
 *  the unit after it, without the brackets around them ("(2.000 ± 0.005) m" reads "2.000 ± 0.005 m"). */
export function typedInputs(latex: string, comma: boolean): string[] {
  const t = tokens(latex);
  const out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const chip = CHIP_ARGS[t[i] ?? ""];
    if (chip !== undefined) {
      let k = i + 1;
      for (let g = 0; g < chip; g++) k = group(t, k);
      i = k - 1;
      continue;
    }
    if (t[i] !== "\\pm") continue;
    const from = numberBefore(t, i);
    // σ typed, or a result chip as σ (R271)
    let to = t[i + 1] === "\\res" ? group(t, group(t, i + 2)) : numberAt(t, i + 1);
    const piece = t.slice(from, to).join("");
    // (a ± b) unit: the unit is after the bracket
    if (t[from - 1] === "(" && t[from - 2] === "\\left" && t[to] === "\\right" && t[to + 1] === ")") to += 2;
    const end = unitAt(t, to);
    out.push(plain(piece + (end > to ? t.slice(to, end).join("") : ""), comma));
    i = Math.max(i, end - 1);
  }
  return out;
}

/** The text of the chip `macro{k}{…}` in the line (a result chip `\res`, a constant `\const`), or null. */
function chipText(latex: string, macro: string, k: string, comma: boolean): string | null {
  const t = tokens(latex);
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== macro) continue;
    const a = group(t, i + 1);
    const name = t.slice(i + 2, a - 1).join("");
    const b = group(t, a);
    if (name === k) return plain(t.slice(i, b).join(""), comma);
  }
  return null;
}

/** The result chips with σ in the line (`\\res{k}{…}`, `\\ans`), each once, in the order they first appear: the order
 *  of their inputs (units/build.ts uncertainValues, the parser writes the line left to right). */
function resultChips(item: HistoryItem, comma: boolean): string[] {
  const t = tokens(item.latex);
  const chips = item.chips ?? {};
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < t.length; i++) {
    const res = t[i] === "\\res";
    if (!res && t[i] !== "\\ans") continue;
    const a = res ? group(t, i + 1) : i + 1;
    const key = res ? `res:${t.slice(i + 2, a - 1).join("")}` : "ans";
    const b = res ? group(t, a) : a;
    if (chips[key]?.unc !== undefined && !seen.has(key)) {
      seen.add(key);
      out.push(plain(t.slice(i, b).join(""), comma));
    }
    i = b - 1;
  }
  return out;
}

/** The label of each term: a typed ± by its place among the typed ones, a result chip by its place among the line's
 *  chips with σ (a `pasr_` key's number is its run's, never read: decisions.md pass 199), a constant by its text in the
 *  line, a basis leaf by its name with the constants that share it. */
function labels(item: HistoryItem, terms: readonly { key?: string }[], comma: boolean): { label: string; sub?: string }[] {
  const line = item.latex;
  const typed = typedInputs(item.units?.input || line, comma);
  const results = resultChips(item, comma);
  let n = 0;
  let r = 0;
  return terms.map(({ key }) => {
    if (key === undefined) {
      n++;
      return { label: typed[n - 1] ?? uncText("unc.rows.typed", { n: String(n) }) };
    }
    if (key.startsWith("pasr_")) return { label: results[r++] ?? uncText("unc.rows.chip"), sub: uncText("unc.rows.chip") };
    if (key.startsWith("pasl_")) {
      const leaf = key.slice("pasl_".length);
      const via = Object.entries(item.chips ?? {})
        .filter(([c, x]) => c.startsWith("const:") && x.basisLeaves !== undefined && leaf in x.basisLeaves)
        .map(([c]) => chipText(line, "\\const", c.slice("const:".length), comma) ?? c.slice("const:".length));
      return { label: leaf.replace(/_/g, " "), ...(via.length ? { sub: uncText("unc.rows.via", { names: via.join(", ") }) } : {}) };
    }
    return { label: chipText(line, "\\const", key, comma) ?? key };
  });
}

// ---- the shares ----

/** A share's tenths of a per cent as a number (small ones count as 0, as the model sums them). */
const tenths = (s: BudgetShare): number => (s.small ? 0 : Math.round(Number(s.share) * 10));

function shareText(s: BudgetShare, comma: boolean): string {
  const num = (x: string): string => (comma ? x.replace(".", ",") : x).replace("-", "−");
  if (s.small) return uncText(s.share.startsWith("-") ? "unc.rows.smallNeg" : "unc.rows.small", { p: num(s.share) });
  return uncText("unc.sheet.percent", { p: num(s.share) });
}

function bar(s: BudgetShare): ShareRow["bar"] {
  const v = tenths(s) / 10;
  if (v > 100) return { width: 100, over: true };
  if (v < 0) return { width: Math.min(-v, 100), neg: true };
  return { width: v };
}

const columns = (): ShareTable["columns"] => [uncText("unc.rows.input"), uncText("unc.rows.uy"), uncText("unc.rows.share")];

/** The rows of `item`'s sheet; null where the model gives no budget (no terms, σ 0, a term that is not a decimal). */
export function uncRows(item: HistoryItem, comma: boolean, mode: FmtMode = "std"): ShareTable | null {
  const input = inputOf(item);
  if (!input) return null;
  // the model sorts its rows and keeps each one's key: a typed ± (no key) gets its place as a key of ours, `#<i>`, which
  // is no chip and no constant, so the model's `independent` is the same as without it
  const at = (i: number): string => `#${i}`;
  const b = budgetOf({ ...input, terms: input.terms.map((x, i) => (x.key === undefined ? { ...x, key: at(i) } : x)) });
  if (b === null) return null;
  if ("reason" in b) return { columns: columns(), rows: [], lines: [uncText(LINE[b.reason])] };
  const names = labels(item, input.terms, comma);
  const nameOf = (r: BudgetRow): { label: string; sub?: string } => {
    const i = input.terms.findIndex((x, k) => (x.key ?? at(k)) === r.key);
    return names[i] ?? { label: r.key ?? "" };
  };
  const uy = (u: string): string => {
    const s = input.home ? (sigmaShown(u, mode, comma) ?? u) : comma ? commaResult(u, false) : u;
    return s.replace("E", "ᴇ") + (input.unit ? ` ${input.unit}` : "");
  };
  const rows: ShareRow[] = b.rows.map((r, i) => ({
    id: `in${i + 1}`,
    ...nameOf(r),
    uy: uy(r.uy),
    share: shareText(r, comma),
    bar: bar(r),
    ...(r.independent ? { note: uncText("unc.rows.independent") } : {}),
  }));
  if (b.second) rows.push({ id: "second", label: uncText("unc.rows.second"), uy: "", share: shareText(b.second, comma), bar: bar(b.second), second: true });
  const lines: string[] = [];
  if (b.over100) lines.push(uncText("unc.rows.over100"));
  if (b.rounded) {
    const sum = [...b.rows, ...(b.second ? [b.second] : [])].reduce((s, x) => s + tenths(x), 0);
    const p = `${sum < 0 ? "-" : ""}${Math.trunc(Math.abs(sum) / 10)}.${Math.abs(sum) % 10}`;
    lines.push(uncText("unc.rows.rounded", { p: (comma ? p.replace(".", ",") : p).replace("-", "−") }));
  }
  return { columns: columns(), rows, lines };
}
