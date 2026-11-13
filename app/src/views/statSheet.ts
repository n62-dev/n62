// SPDX-License-Identifier: GPL-3.0-or-later
// R184: the labelled result sheet of `linreg` and `stats1` (docs/05 3.1, 3.5). Their answer is a list of three or six
// numbers whose order the reader would have to remember, so the second tap on such a row's result (the step that
// inserts), and ☰ 1 Insert, ask which value to insert: the sheet's rows are Slope, Intercept, r², or n, Mean, …, each with
// its value, and a pick puts that value on the line as a chip, through the one result-chip route (entry.insertResult).
// A lazy chunk (App.svelte loads it with the sheet's code): no start-chunk code but the one-line test in insertResult.
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import { splitList } from "../engine/giacPrint.ts";
import { dataText, type DataKey } from "../i18n/enData.ts";
import type { Chip } from "../input/chips.ts";
import { chipOf } from "../state/results.ts";
import type { EntryController } from "../entry/controller.ts";
import type { HistoryItem, Session } from "../state/session.svelte.ts";

export type StatCall = "linreg" | "stats1";

/** The rows of each call, in the order its list holds the values (stats.ts), as i18n keys. */
const ROWS: Readonly<Record<StatCall, readonly DataKey[]>> = {
  linreg: ["stat.slope", "stat.intercept", "stat.r2"],
  stats1: ["stat.n", "stat.mean", "stat.sample", "stat.population", "stat.min", "stat.max"],
};

/** The call an entry's top call is: `linreg(…)` or `stats1(…)` whose closing bracket ends the entry (not
 *  `linreg(…)+1`, whose answer is no such list). `latex` is the row's entry as MathLive writes it. */
export function statCall(latex: string): StatCall | null {
  const m = /^\s*(?:\\operatorname\{(linreg|stats1)\}|(linreg|stats1))\s*(?:\\left)?\(/.exec(latex);
  const name = (m?.[1] ?? m?.[2]) as StatCall | undefined;
  if (!m || !name) return null;
  let depth = 0;
  const rest = latex.slice(m[0].length - 1);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "(") depth++;
    else if (rest[i] === ")" && --depth === 0) return rest.slice(i + 1).trim() === "" ? name : null;
  }
  return null;
}

/** The drawn elements of a list's text (`{1.94, 0.15, 0.9957}`; a decimal comma separates with `;`), or null. */
function shownParts(text: string): string[] | null {
  const t = text.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return null;
  const inner = t.slice(1, -1);
  return inner.split(inner.includes(";") ? ";" : ",").map((s) => s.trim());
}

/** An element's text as LaTeX for the line: a fraction stacked, a minus sign plain. */
function latexOf(shown: string): string {
  const s = shown.replace(/−/g, "-");
  const f = /^(-?)(\d+)\/(\d+)$/.exec(s);
  return f ? `${f[1]}\\frac{${f[2]}}{${f[3]}}` : s;
}

/** The sheet's rows for the finished row `item` (`text`: its list as drawn), or null when its answer is not the list
 *  of that call (an inexact one keeps no exact text: it goes in whole, as every list does). `insert` puts a value on
 *  the line as a chip. */
export function statItems(item: HistoryItem, text: string, insert: (shown: string, chip: Chip) => void): MenuItem[] | null {
  const call = statCall(item.latex);
  if (!call || item.status !== "done" || item.full === undefined) return null;
  const values = splitList(item.full);
  const keys = ROWS[call];
  if (!values || values.length !== keys.length) return null;
  const drawn = shownParts(text);
  return keys.flatMap((key, i): MenuItem[] => {
    const full = values[i] as string;
    const chip = chipOf({ status: "done", full, ...(item.fullExact === undefined ? {} : { fullExact: item.fullExact }), ...(item.facts ? { facts: item.facts } : {}) });
    if (!chip) return [];
    const shown = drawn?.length === keys.length ? (drawn[i] as string) : full;
    return [{ id: key, label: dataText(key), value: shown, run: () => insert(latexOf(shown), chip) }];
  });
}

/** Open the sheet of `item` over the view (`session` draws its list, `entry` takes the pick); false when it has none (the caller inserts the result whole). */
export function showStats(shell: AppShell, session: Session, item: HistoryItem, entry: EntryController): boolean {
  const call = statCall(item.latex);
  const rows = call ? statItems(item, session.display(item).text, (shown, chip) => entry.insertResult(shown, chip)) : null;
  if (!call || !rows || rows.length !== ROWS[call].length) return false;
  shell.showMenu(dataText(call === "linreg" ? "stat.linreg" : "stat.stats1"), rows, { remember: false });
  return true;
}
