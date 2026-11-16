// SPDX-License-Identifier: GPL-3.0-or-later
// stage rpn (G302, mh-D1): an RPN sequence gives what its algebraic line gives. The stack adds no evaluation path: its
// operation is one ordinary row (entry/rpnCompose.ts), so the same text, mark, σ and `full` (Home), or the same value,
// unit, σ and refusal (the unit view), must come out of two fresh engines: the case's own line, and the steps `rpn`
// drives through the stack model (entry/rpn.ts) and the composer. A number step goes through its file's own path and the
// session's chip rule (goldenRun.ts runSteps; units/chip.ts quantityChip); a key through `applyOp`, with a port that runs
// the row as Session does (Home through homeLatexStep with its chips, the unit view through unitRequest, input/unitFormula.ts).
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { applyOp } from "../../src/entry/rpnCompose.ts";
import { arityOf, inputsOf, RpnStack, type RpnLevel } from "../../src/entry/rpn.ts";
import { EngineHost } from "../../src/engine/host.ts";
import { defaultHomeSettings, type HomeResult, type HomeSettings } from "../../src/engine/homeEval.ts";
import { sigmaLeaves } from "../../src/engine/constBasis.ts";
import { rewriteAngles } from "../../src/engine/angles.ts";
import { chipUnit } from "../../src/input/chipUnit.ts";
import { pruneChips, type Chip, type ChipTable } from "../../src/input/chips.ts";
import { slotFormula, unitRequest } from "../../src/input/unitFormula.ts";
import type { ActionBody, Layer } from "../../src/keyboard/keyboard.ts";
import { chipOf } from "../../src/state/results.ts";
import { chipFactsOf, homeItem } from "../../src/state/resultItem.ts";
import type { HistoryItem } from "../../src/state/session.svelte.ts";
import { quantityChip } from "../../src/units/chip.ts";
import { buildJob } from "../../src/units/build.ts";
import { factorTable, type FactorTable } from "../../src/units/factors.ts";
import { isUnitError, type Quantity, type UnitError } from "../../src/units/types.ts";
import { homeLatexStep, markText, runHomeCase, seqMark, type Case } from "../../src/goldenRun.ts";
import type { IndexItem } from "../../src/find/types.ts";
import { requestOf } from "../unit-case.ts";
import { unitGot, unitWant } from "./units.ts";
import { cases, freshHost, report, root } from "./lib.ts";

/** What the last row of a run gave: a Home result (with the "inexact input" mark of runSteps), or a unit result. */
type Raw = { home: HomeResult & { inexactInput?: boolean } } | { unit: Quantity | UnitError };

/** The key's action in a layer, read from spec/keyboard.yaml as keyboard.ts parseAction reads it (that module is a
 *  Vite import, not Node's): `type` or `insert`, the two forms the stack's keys have. */
const spec = parse(readFileSync(`${root}spec/keyboard.yaml`, "utf8")) as { keys: ({ id: string } & Partial<Record<Layer, { type?: string; insert?: string }>>)[] };
function actionOf(id: string, layer: Layer): ActionBody {
  const a = spec.keys.find((k) => k.id === id)?.[layer];
  if (a?.type !== undefined) return { kind: "type", text: a.type };
  if (a?.insert !== undefined) return { kind: "insert", latex: a.insert };
  throw new Error(`rpn: key ${id}.${layer} has no type or insert action`);
}

/** A step: dup, drop, swap, a key (`sq`, `sq:shift`), else a number (a line of the file's own form). */
type Step = { stack: "dup" | "drop" | "swap" } | { key: string; layer: Layer } | { number: string };
function stepOf(text: string): Step {
  if (text === "dup" || text === "drop" || text === "swap") return { stack: text };
  const m = /^([a-z][a-z0-9]*)(:shift)?$/.exec(text);
  if (m && spec.keys.some((k) => k.id === m[1])) {
    const layer: Layer = m[2] ? "shift" : "primary";
    if (arityOf(m[1] as string, layer) === 0) throw new Error(`rpn: ${text} takes no levels`);
    return { key: m[1] as string, layer };
  }
  return { number: text };
}

/** How a run evaluates a line and a number step: Home or the unit view, on its own engine. */
interface Evaluator {
  /** A number step: the row's raw result and the chip it pushes (undefined: refused). */
  number(text: string): { raw: Raw; chip: Chip | undefined; chips: ChipTable; latex: string };
  /** An operation's line, as Session.submit (Home) or the unit view's request (units) would run it. */
  line(latex: string, chips: ChipTable, units: boolean): { raw: Raw; chip: Chip | undefined };
}

/** A Home line as the session sends it (goldenRun.ts runSteps): the parser with the chips, named chips and constants with
 *  their facts; the item and chip by results.ts's rule. */
function homeLine(host: EngineHost, s: HomeSettings, latex: string, chips: ChipTable): { raw: Raw; chip: Chip | undefined } {
  const p = homeLatexStep(latex, chips);
  const r = (p.named || p.consts ? host.home(p.giac, s, p.consts, p.named && chipFactsOf(p.named)) : host.home(p.giac, s)).result;
  const home = p.inexact ? { ...r, inexactInput: true } : r;
  return { raw: { home }, chip: r.ok ? chipOf({ status: "done", ...homeItem(r, p.inexact) }) : undefined };
}

/** A unit line from its LaTeX with chips, as units/view.ts builds it: a slot after each chip, filled with the chip's unit. */
function unitLine(host: EngineHost, s: HomeSettings, table: FactorTable, latex: string, chips: ChipTable): { raw: Raw; chip: Chip | undefined } {
  const f = slotFormula(latex);
  let q: Quantity | UnitError;
  try {
    const req = unitRequest(f, (id) => (f.chips?.[id] !== undefined ? chipUnit(chips[f.chips[id] as string])?.slot : undefined), chips);
    const job = buildJob(req, table);
    q = isUnitError(job) ? job : host.units(job, s);
  } catch (e) {
    q = { error: "engine", detail: `parser: ${(e as Error).message}` };
  }
  return { raw: { unit: q }, chip: quantityChip(q) };
}

/** The stack run of a case's steps on one fresh engine: the last row's raw result, or the reason it could not run. */
async function runStack(c: Case, ev: Evaluator, sigmas: (chips: ChipTable, latex: string) => ChipTable): Promise<Raw> {
  const stack = new RpnStack();
  const rows: HistoryItem[] = [];
  const chipOfRow = new Map<HistoryItem, Chip | undefined>();
  let last: Raw | undefined;
  const addRow = (latex: string, chips: ChipTable, raw: Raw, chip: Chip | undefined): void => {
    last = raw;
    const id = rows.length + 1;
    const row: HistoryItem = { id, uid: `row-${id}`, view: "home", latex, status: chip ? "done" : "error", resultLatex: chip?.value ?? "", text: "", approximate: false, chips, startedAt: 0 };
    rows.push(row);
    chipOfRow.set(row, chip);
  };
  const port = {
    submit: (latex: string, _giac?: string, chips: ChipTable = {}) => {
      const r = ev.line(latex, chips, false);
      addRow(latex, chips, r.raw, r.chip);
      return Promise.resolve();
    },
    submitUnits: (latex: string, chips: ChipTable) => {
      const r = ev.line(latex, chips, true);
      addRow(latex, chips, r.raw, r.chip);
      return Promise.resolve();
    },
    newest: () => rows[rows.length - 1],
    chipFor: (item: HistoryItem) => chipOfRow.get(item),
    shownOf: (item: HistoryItem) => `\\text{${item.resultLatex}}`,
  };
  for (const text of c.rpn ?? []) {
    const st = stepOf(text);
    if ("stack" in st) {
      if (!stack[st.stack]()) throw new Error(`${c.id}: ${text} on a stack of ${stack.levels.length}`);
    } else if ("key" in st) {
      const a = await applyOp(stack, port, st.key, st.layer, actionOf(st.key, st.layer));
      if (a !== "done" && a !== "error") throw new Error(`${c.id}: ${text} ended ${a}`);
      if (a === "error") return last!; // a refusal is the row's own result: the stack stays
    } else {
      const n = ev.number(st.number);
      addRow(n.latex, n.chips, n.raw, n.chip);
      if (!n.chip) throw new Error(`${c.id}: step ${st.number} gives no chip`);
      const row = rows[rows.length - 1] as HistoryItem;
      const level: RpnLevel = { uid: row.uid as string, chip: n.chip, shown: `\\text{${n.chip.value}}`, inputs: inputsOf(sigmas(n.chips, n.latex), row.uid as string, n.chip.unc !== undefined, sigmaLeaves) };
      stack.push(level);
    }
  }
  return last as Raw;
}

/** A Home result as text to compare: the mark (the sequence's rule), the display, the copy text and σ. */
function homeText(r: HomeResult & { inexactInput?: boolean }, digits: number): { text: string; full: string } {
  return { text: `${markText(seqMark(r, digits)) ?? "-"} ${r.display} σ ${r.facts?.uncSigma ?? "none"} uncDigits ${r.facts?.uncDigits ?? "-"}`, full: r.full ?? "-" };
}

export async function stageRpn(): Promise<void> {
  const homeCases = cases("home.yaml").filter((c) => c.rpn);
  const unitCases = cases("units.yaml").filter((c) => c.rpn);
  const items = existsSync(`${root}app/src/find/_gen/find-index.json`) ? (JSON.parse(readFileSync(`${root}app/src/find/_gen/find-index.json`, "utf8")) as IndexItem[]) : undefined;
  if (unitCases.length && !items) {
    report("rpn", false, "no Find index: run npm run index (N62_QALC_DL_DIR=<main checkout>/engine/qalc/_downloads in a worktree)");
    return;
  }
  const table = items ? factorTable(items) : undefined;
  let pass = 0;
  let pending = 0;
  for (const c of homeCases) {
    const digits = c.settings?.digits ?? 12;
    const s: HomeSettings = { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad", digits };
    const line = homeText(await runHomeCase(c, await freshHost(), freshHost), digits);
    const host = await freshHost();
    const chips = c.chips ?? {};
    const ev: Evaluator = {
      number: (t) => ({ ...homeLine(host, s, t, chips), chips, latex: t }),
      line: (latex, ch) => homeLine(host, s, latex, ch),
    };
    const raw = await runStack(c, ev, (ch, latex) => pruneChips(ch, latex));
    const got = "home" in raw ? homeText(raw.home, digits) : { text: "unit result in a Home case", full: "-" };
    const shown = "home" in raw ? raw.home.display : "";
    const same = got.text === line.text && shown === String(c.expect) && (c.mark === undefined || got.text.startsWith(c.mark));
    // `full` apart: a case `status: pending` is a known difference of the copy text (listed, never fails; the other fields must still agree)
    const fullSame = got.full === line.full;
    if (same && fullSame) {
      pass++;
      if (c.status === "pending") console.log(`  rpn ${c.id}: NOW PASSING (remove its status)`);
    } else if (same && c.status === "pending") {
      pass++;
      pending++;
      console.log(`  rpn ${c.id}: pending, copy text differs: stack ${got.full}, line ${line.full}`);
    } else console.log(`  rpn ${c.id}: stack ${got.text} full ${got.full}, line ${line.text} full ${line.full}, expect ${c.mark ?? ""} ${String(c.expect)}`);
  }
  for (const c of unitCases) {
    const s: HomeSettings = { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad" };
    const t = table as FactorTable;
    const algebraic = unitOf(c, await freshHost(), s, t);
    const host = await freshHost();
    const ev: Evaluator = {
      number: (text) => {
        const job = buildJob(requestOf(rewriteAngles(text, "typed"), undefined, t), t);
        const q = isUnitError(job) ? job : host.units(job, s);
        return { raw: { unit: q }, chip: quantityChip(q), chips: {}, latex: text };
      },
      line: (latex, ch, units) => (units ? unitLine(host, s, t, latex, ch) : homeLine(host, s, latex, ch)),
    };
    const raw = await runStack(c, ev, () => ({}));
    const got = "unit" in raw ? unitGot(raw.unit, c) : "a Home result in a unit case";
    const ok = got === algebraic && got === unitWant(c);
    if (ok) pass++;
    else console.log(`  rpn ${c.id}: stack ${got}, line ${algebraic}, expect ${unitWant(c)}`);
  }
  const total = homeCases.length + unitCases.length;
  report("rpn", total > 0 && pass === total, `${pass}/${total} sequences give their line's mark, text, σ, unit and copy text (${homeCases.length} Home, ${unitCases.length} unit view${pending ? `; ${pending} pending on the copy text` : ""})`);
}

/** A units case's own line on `host`, as the units stage runs it. */
function unitOf(c: Case, host: EngineHost, s: HomeSettings, table: FactorTable): string {
  const job = buildJob(requestOf(c.input as string, c.to, table), table);
  return unitGot(isUnitError(job) ? job : host.units(job, s), c);
}
