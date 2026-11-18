// SPDX-License-Identifier: GPL-3.0-or-later
// The palettes as items for the grid sheet: Tmpl (R10; spec/keyboard.yaml `templates:`) and the Shift palettes (R18;
// `relations:`, `symbols:`). Each cell is drawn as its template with empty boxes, named through i18n
// (`<palette>.<id>`), and inserts its action (a key's template keeps that key's one-line form). A cell picked by the
// key at its place (Shift + 6) carries that key and its legend.
import type { MenuItem } from "../apps/types.ts";
import { legend } from "../i18n/index.ts";
import type { AppShell, PaletteId } from "../apps/shell.svelte.ts";
import type { EntryController } from "../entry/controller.ts";
import { keyboard, type ActionBody, type PaletteItem } from "../keyboard/keyboard.ts";
import type * as Palettes from "../keyboard/shiftPalettes.ts";
export { showBase } from "./baseSheet.ts"; // R193: the Base menu comes with the sheet's code
import { lazy, type RouteCtx } from "../keyboard/route.ts";

/** R327: Shift + 1's uncertainty sheet (uncSheet.ts, a chunk of its own) of `row`, else Home's or CAS's last row (as Fmt;
 *  an app has none). Imported from the sheet's code, which the press waited for ("uncertainty" opens a sheet), so the start
 *  chunk holds no import of it; keys pressed meanwhile wait (R8). */
export const showUncertainty = (c: RouteCtx, row = c.shell.app === null ? c.session.items.at(-1) : undefined): void =>
  lazy(c, import("./uncSheet.ts").then((m) => m.showUncertainty(c, row)));

/** The template drawn with an empty box for every slot (#? a placeholder, #@ and #0 what the cursor would take).
 *  A box, not \placeholder: MathLive's static renderer draws a placeholder as nothing. */
export function cellLatex(latex: string): string {
  return latex.replace(/#[?@0]/g, "\\square ");
}

/** What a cell inserts: its action, or the one-line form when the entry is linear and the cell has one. */
export function paletteAction(p: PaletteItem, oneLine: boolean): ActionBody {
  const a = p.action;
  return oneLine && a.line ? a.line : a;
}

/** The palette's cells, in reading order; `insert` runs the picked one. `name`: a cell's name by its id (the palettes'
 *  names are in i18n/enPalettes.ts, loaded with the palettes). */
export function paletteItems(
  cells: readonly PaletteItem[],
  insert: (p: PaletteItem) => void,
  name: (id: string) => string,
): MenuItem[] {
  return cells.map((p) => {
    const key = p.pick === undefined ? undefined : keyboard.byId.get(p.pick);
    return {
      id: p.id,
      label: name(p.id),
      latex: cellLatex(p.action.latex),
      ...(key ? { pick: { key: key.id, legend: legend(key.label.primary ?? "") } } : {}),
      run: () => insert(p),
    };
  });
}

/** What a palette needs of the app (App.svelte): the shell and the entry line, the session, the dead press, a notice, the pick to drop
 *  and whether the entry is one line. */
export interface PaletteHost {
  readonly shell: AppShell;
  readonly entry: EntryController;
  readonly session: { readonly settings: { readonly entry: string } };
  dead(): void;
  say(text: string): void;
  reset(): void;
}

/** Tmpl, Shift + 6, Shift + 9 and Shift + Vars: the palette `id` on the grid sheet (apps/shell.svelte.ts togglePalette); a pick
 *  inserts its cell. R725: a refused Chars cell types nothing on a maths line and the notice gives the parser's message (in a
 *  name prompt, which has shell.prompt, it types the character). */
export function openPalette(h: PaletteHost, id: PaletteId, m: typeof Palettes): void {
  const { shell, entry } = h;
  if (!shell.showsEntry) return h.dead();
  h.reset();
  const p = m.palettes[id];
  const insert = (c: PaletteItem): void => {
    const why = c.refused && !shell.prompt ? m.charsRefusal(c.id) : undefined;
    if (why === undefined) entry.run(paletteAction(c, h.session.settings.entry === "line"));
    else h.say(why);
  };
  shell.togglePalette(id, m.paletteText(`${id}.title`), () => paletteItems(p.items, insert, (cell) => m.paletteText(`${id}.${cell}`)), p.columns);
}
