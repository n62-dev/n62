// SPDX-License-Identifier: GPL-3.0-or-later
// R197: the Help key (Shift + Select, docs/06 section 1, milestone 6): the syntax and example of the function at the
// cursor, from the Find index. R196's functionAt names the function (entry/cursorFn.ts; the cursor's offset from
// entry/cursorAt.ts); its Find item gives the rows: the syntax with the description, G231's example drawn as LaTeX with
// its mark and result (an inverse function's result says its angle unit), and an Insert row that puts the example on
// the line at the cursor, as a Find pick puts an item. No function at the cursor, or one Find does not hold: the caller
// opens Find. Comes with Find's chunk (find/finder.ts re-exports it), so the start chunk has none of it.
import type { AppShell } from "../apps/shell.svelte.ts";
import type { MenuItem } from "../apps/types.ts";
import type { EntryController } from "../entry/controller.ts";
import { cursorLatex } from "../entry/cursorAt.ts";
import { functionAt } from "../entry/cursorFn.ts";
import type { FindItem } from "../find/types.ts";
import { findText as t } from "../i18n/enFind.ts";

/** The sheet's title: "Help: Sine". */
export const helpTitle = (it: FindItem): string => t("help.title", { name: it.title });

/** The result as Home shows it: the mark, the result, and the angle unit when the result depends on the angle mode. */
function resultText(it: FindItem): string {
  const angle = it.exampleAngle === "rad" ? t("help.rad") : it.exampleAngle === "deg" ? t("help.deg") : "";
  return [it.exampleMark ?? "", it.exampleResult ?? "", angle].filter(Boolean).join(" ");
}

/** The rows of the help sheet: the syntax (with the description under it), and with an example its row and Insert. The
 *  first two only inform (a pick keeps the sheet); Insert runs `insert` with the example's LaTeX. */
export function helpRows(it: FindItem, insert: (latex: string) => void): MenuItem[] {
  const name = it.names[0] ?? it.id.slice(it.id.indexOf(":") + 1);
  const syntax: MenuItem = { id: "syntax", label: it.syntax ?? `${name}(…)`, keep: true, ...(it.desc ? { hint: it.desc } : {}) };
  const example = it.example;
  if (example === undefined) return [syntax];
  return [
    syntax,
    { id: "example", label: t("help.example"), latex: example, value: resultText(it), keep: true },
    { id: "insert", label: t("help.insert"), run: () => insert(example) },
  ];
}

/** The Find item of the function at the line's cursor, or undefined (none there, or not in Find). */
export async function helpAt(entry: EntryController, byId: ReadonlyMap<string, FindItem>): Promise<FindItem | undefined> {
  const { latex, offset } = await cursorLatex(entry.field, entry.value);
  const id = functionAt(latex, offset);
  return id === null ? undefined : byId.get(id);
}

/** The help sheet of `it` over the view. */
export function showHelp(shell: AppShell, entry: EntryController, it: FindItem): void {
  shell.showMenu(helpTitle(it), helpRows(it, (latex) => entry.insert(latex)), { remember: false });
}
