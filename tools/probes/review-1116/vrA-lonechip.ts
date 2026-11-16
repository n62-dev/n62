// SPDX-License-Identifier: GPL-3.0-or-later
// vrA-1 probe (night review 2026-11-16): the uncertainty sheet's rows (R328, budget/rows.ts) for a row whose σ comes from
// ONE input only. Expected (derived): with one input there is no other term to share an input with, so the
// "treated as independent" caveat cannot apply. Prints the rows and their notes.
// Run: env -C <review worktree>/app npx tsx <this file>
import { uncRows } from "../../../app/src/budget/rows.ts";
import { decimalFromString, type DecimalValue } from "../../../app/src/engine/format.ts";
import type { HistoryItem } from "../../../app/src/state/session.svelte.ts";

const dec = (s: string): DecimalValue => decimalFromString(s) as DecimalValue;
const base = (x: Partial<HistoryItem>): HistoryItem => ({
  id: 2, view: "home", latex: "", status: "done", resultLatex: "6.4", text: "6.4", approximate: true,
  value: { re: dec("6.4"), im: dec("0") }, facts: { exact: false, reliableDigits: null, inexact: true }, startedAt: 0, ...x,
}) as HistoryItem;

// Home: a result chip with σ (a unit row's 3.2 ± 0.1) times 2; G274 keeps no terms (one input), so alone() keys it pasr_1
const home = base({
  latex: "\\res{1}{3.2\\pm0.1}\\times2",
  chips: { "res:1": { value: "3.2", unc: "0.1", exact: false, inexact: true } } as HistoryItem["chips"],
  facts: { exact: false, reliableDigits: null, inexact: true, uncSigma: "0.2", uncDigits: 2 },
});
const t1 = uncRows(home, false);
console.log("home lone chip:", JSON.stringify(t1?.rows.map((r) => [r.label, r.uy, r.share, r.note ?? "-"])));

// unit view: the same, one pasr_ term (G273's terms keep the chip's key)
const unit = base({
  latex: "\\res{1}{3.2\\pm0.1}\\times2",
  chips: { "res:1": { value: "3.2", unc: "0.1", exact: false, inexact: true } } as HistoryItem["chips"],
  units: { slots: {}, unit: "m", dim: null, dimText: null, unc: { text: "0.20", shown: "6.40 ± 0.20", terms: [{ key: "pasr_1", t: "0.04", uy: "0.2" }] }, latex: "", text: "", input: "\\res{1}{3.2\\pm0.1}\\times2" } as unknown as HistoryItem["units"],
});
const t2 = uncRows(unit, false);
console.log("unit lone chip:", JSON.stringify(t2?.rows.map((r) => [r.label, r.uy, r.share, r.note ?? "-"])));
