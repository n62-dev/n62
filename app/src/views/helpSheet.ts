// SPDX-License-Identifier: GPL-3.0-or-later
// R197: the Help key (row 0, col 4 since R723; docs/06 section 1, milestone 6): the syntax and example of the function at the
// cursor, from the Find index. R196's functionAt names the function (entry/cursorFn.ts; the cursor's offset from
// entry/cursorAt.ts); its Find item gives the rows: the syntax with the description, G231's example drawn as LaTeX with
// its mark and result under it (an inverse function's result says its angle unit), and an Insert row that puts the example on
// the line in place of the call Help named, its name, bracket and arguments (R324: entry/callRange.ts finds its atoms;
// the line's Undo brings the call back); where its atoms are not found for sure, at the cursor. No function at the
// cursor, or one Find does not hold: the caller opens Find. A chunk of its own, loaded from Find's (find/finder.ts showHelpAt), so the start chunk has none of it.
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import type { EntryController } from "../entry/controller.ts";
import { cursorLatex } from "../entry/cursorAt.ts";
import { callAt, type FnWords } from "../entry/cursorFn.ts";
import type { FindItem } from "../find/types.ts";
import { helpText as t } from "../i18n/enHelp.ts";

/** The sheet's title: "Help: Sine". */
export const helpTitle = (it: FindItem): string => t("title", { name: it.title });

/** The result as Home shows it: the mark, the result, and the angle unit when the result depends on the angle mode. */
function resultText(it: FindItem): string {
  const angle = it.exampleAngle === "rad" ? t("rad") : it.exampleAngle === "deg" ? t("deg") : "";
  return [it.exampleMark ?? "", it.exampleResult ?? "", angle].filter(Boolean).join(" ");
}

/** R324: the call the Insert row replaces: its atoms on the line (a selection range) while the line is `line`. */
export interface CallAt {
  line: string;
  range: [number, number];
}

/** The rows of the help sheet: the syntax (with the description under it), and with an example its row and Insert. The
 *  first two only inform (a pick keeps the sheet); Insert runs `insert` with the example's LaTeX and `at`, the call it
 *  replaces (R324; none: at the cursor). */
export function helpRows(it: FindItem, insert: (latex: string, at: CallAt | undefined) => void, at?: CallAt): MenuItem[] {
  const name = it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1);
  const syntax: MenuItem = { id: "syntax", label: it.syntax ?? `${name}(…)`, keep: true, ...(it.desc ? { hint: it.desc } : {}) };
  const example = it.example;
  if (example === undefined) return [syntax];
  const result = resultText(it);
  return [
    syntax,
    { id: "example", label: t("example"), latex: example, keep: true, ...(result ? { hint: result } : {}) }, // (under it: beside it a long result cut the example at 360 px)
    { id: "insert", label: t("insert"), run: () => insert(example, at) },
  ];
}

/** What R196's scan and R324's range read, from the chunks that hold them: the parser's and the field's (no chunk of
 *  their own). */
async function tables(): Promise<{ words: FnWords } & Pick<typeof import("../entry/callRange.ts"), "callRange" | "bare">> {
  const [p, f] = await Promise.all([import("../input/parse.ts"), import("../entry/field.ts")]);
  return { words: { funcs: p.FUNCS, inverse: p.INVERSE, greek: p.GREEK, isInfixWord: f.isInfixWord }, callRange: f.callRange, bare: f.bare };
}

/** The Find item of the function at the line's cursor, or undefined (none there, or not in Find); with it the call's atoms
 *  on the line, when the range from the cursor has the call's LaTeX (R324). */
export async function helpAt(entry: EntryController, byId: ReadonlyMap<string, FindItem>): Promise<{ it: FindItem; at?: CallAt } | undefined> {
  const mf = entry.field;
  const [{ latex, offset }, w] = await Promise.all([cursorLatex(mf, entry.value), tables()]);
  const call = callAt(latex, offset, w.words);
  const it = call === null ? undefined : byId.get(call.id);
  if (!it || !call) return undefined;
  const line = mf?.value; // the line as the field holds it: the read one less the slot the mark took (callRange.ts bare)
  const range = mf && line !== undefined && w.bare(line) === w.bare(latex) ? w.callRange(mf, mf.position, latex.slice(call.start, call.end)) : undefined;
  return range && line !== undefined ? { it, at: { line, range } } : { it };
}

/** R324: the example over the call's atoms while the line is as Help read it, else at the cursor. MathLive's insert
 *  replaces a selection as one step of the line's own history, so Undo brings the call back. */
function put(entry: EntryController, latex: string, at: CallAt | undefined): void {
  const mf = entry.field;
  if (mf && at && mf.value === at.line) {
    entry.endSelect();
    mf.selection = { ranges: [at.range] };
  }
  entry.insert(latex);
}

/** The help sheet of the function at the cursor over the view; false (nothing opened) when there is none (R197: the
 *  caller opens Find). */
export async function showHelpAt(shell: AppShell, entry: EntryController, byId: ReadonlyMap<string, FindItem>): Promise<boolean> {
  const found = await helpAt(entry, byId);
  if (!found) return false;
  shell.showMenu(helpTitle(found.it), helpRows(found.it, (latex, at) => put(entry, latex, at), found.at), { remember: false });
  return true;
}
