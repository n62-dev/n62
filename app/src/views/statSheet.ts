// SPDX-License-Identifier: GPL-3.0-or-later
// R184: the labelled result sheet of `linreg` and `stats1` (docs/05 3.1, 3.5). Their answer is a list of three or six
// numbers whose order the reader would have to remember, so the second tap on such a row's result (the step that
// inserts), and ☰ 1 Insert, ask which value to insert: the sheet's rows are Slope, Intercept, r², or n, Mean, …, each with
// its value, and a pick puts that value on the line as a chip, through the one result-chip route (entry.insertResult).
// A lazy chunk (clipboard/actions loads it): the start chunk holds only the one-line test in insertResult. The top call is read by the parser (input/parse.ts), each value drawn by the row's own route (session.display, as insertResult draws).
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import { splitList } from "../engine/giacPrint.ts";
import { dataText, type DataKey } from "../i18n/enData.ts";
import type { ValueFacts } from "../engine/types.ts";
import type { Chip, ChipTable } from "../input/chips.ts";
import { parseLatex } from "../input/parse.ts";
import type { Json } from "../input/emit.ts";
import { homeResultToLatex } from "../render/home.ts";
import { noDigit } from "../state/displayMode.ts";
import { chipOf, rationalOf } from "../state/results.ts";
import type { EntryController } from "../entry/controller.ts";
import type { HistoryItem, Session } from "../state/session.svelte.ts";

export type StatCall = "linreg" | "stats1";

/** The rows of each call, in the order its list holds the values (stats.ts), as i18n keys. */
const ROWS: Readonly<Record<StatCall, readonly DataKey[]>> = {
  linreg: ["stat.slope", "stat.intercept", "stat.r2"],
  stats1: ["stat.n", "stat.mean", "stat.sample", "stat.population", "stat.min", "stat.max"],
};

/** The call an entry's top call is: `linreg(…)` or `stats1(…)` that is all of the entry (not `linreg(…)+1`, whose answer is
 *  no such list), read by the parser (input/parse.ts, which owns the brackets and the names). `latex` is the row's entry as
 *  MathLive writes it, `chips` its chip table. */
export function statCall(latex: string, chips?: ChipTable): StatCall | null {
  let json: Json;
  try {
    json = parseLatex(latex, { chipNames: true, ...(chips ? { chips } : {}) });
  } catch {
    return null; // an entry that does not parse has no such answer
  }
  const name = Array.isArray(json) && json[0] === "Call" ? json[1] : undefined;
  return name === "linreg" || name === "stats1" ? name : null;
}

/** How a value is drawn: the row's own route (session.display, as insertResult draws a result), or null for no digit. */
export type Draw = (el: HistoryItem) => { text: string; latex: string };

/** The i-th element of the row's list as a row of its own, so it is drawn as the list's elements are: with its own value
 *  and facts, in the row's format. Undefined: the engine kept no number for it (an exact text, as CAS prints it). */
function element(item: HistoryItem, i: number, full: string): HistoryItem | undefined {
  const el = item.facts?.items?.[i];
  if (!el?.value) return undefined;
  const { units: _u, rational: _r, polar: _p, ...rest } = item;
  const rational = rationalOf(full);
  const { items: _i, braces: _b, value, ...facts } = el;
  return { ...rest, value, facts, ...(rational ? { rational } : {}), full } as HistoryItem;
}

/** An exact element as the line draws it (no number kept for it): a plain fraction stacked, else as the engine prints it. */
function exactLatex(full: string): string {
  const r = rationalOf(full);
  return r && r.d !== "1" ? `${r.n.startsWith("-") ? "-" : ""}\\frac{${r.n.replace("-", "")}}{${r.d}}` : homeResultToLatex(full);
}

/** The sheet's rows for the finished row `item` (`draw`: how a value is drawn), or null when its answer is not the list
 *  of that call (an inexact one keeps no exact text: it goes in whole, as every list does). `insert` puts a value on
 *  the line as a chip. */
export function statItems(item: HistoryItem, draw: Draw, insert: (shown: string, chip: Chip) => void): MenuItem[] | null {
  const call = statCall(item.latex, item.chips);
  if (!call || item.status !== "done" || item.full === undefined) return null;
  const values = splitList(item.full);
  const keys = ROWS[call];
  if (!values || values.length !== keys.length) return null;
  return keys.flatMap((key, i): MenuItem[] => {
    const full = values[i] as string;
    // the chip carries this element's facts (digits and warning), not the list's
    const { items: _i, braces: _b, value: _v, ...own } = item.facts?.items?.[i] ?? {};
    const chip = chipOf({ status: "done", full, ...(item.fullExact === undefined ? {} : { fullExact: item.fullExact }), ...(item.facts?.items?.[i] ? { facts: own as ValueFacts } : {}) });
    if (!chip) return [];
    const el = element(item, i, full);
    const drawn = el ? draw(el) : { text: full, latex: exactLatex(full) };
    return [{ id: key, label: dataText(key), value: drawn.text, run: () => insert(drawn.latex, chip) }];
  });
}

/** Open the sheet of `item` over the view (`session` draws its list, `entry` takes the pick); false when it has none (the caller inserts the result whole). */
export function showStats(shell: AppShell, session: Session, item: HistoryItem, entry: EntryController): boolean {
  const call = statCall(item.latex, item.chips);
  const draw: Draw = (el) => (noDigit(session.mark(el)) ? { text: "⚠", latex: "⚠" } : session.display(el));
  const rows = call ? statItems(item, draw, (shown, chip) => entry.insertResult(shown, chip)) : null;
  if (!call || !rows || rows.length !== ROWS[call].length) return false;
  shell.showMenu(dataText(call === "linreg" ? "stat.linreg" : "stat.stats1"), rows, { remember: false });
  return true;
}
