// SPDX-License-Identifier: GPL-3.0-or-later
// Vars and Memory (R4b, docs/04 3.4 and 5.1): Find on the user's variables and functions, the live items of the
// session's names (stored ones included once the engine has read its log). Vars lists them and inserts one; Shift +
// Math, Memory, lists the same and deletes one (Enter) or all (the last row, Enter twice). In Find's lazy chunk. No
// index is needed: the live items go through rank.ts's search over an empty index.
import type { MenuItem } from "../apps/types.ts";
import type { UserName } from "../engine/defs.ts";
import type { EntryController } from "../entry/controller.ts";
import { findText as t } from "../i18n/enFind.ts";
import { decimalFromString, ZERO_VALUE } from "../engine/format.ts";
import { LETTER_NAMES } from "../engine/standIns.ts";
import { homeResultToLatex, typedName } from "../render/home.ts";
import { markFor, markText, type DisplayContext, type NumericResult } from "../state/displayMode.ts";
import type { Session } from "../state/session.svelte.ts";
import { Sheet } from "../views/sheet.svelte.ts";
import { functionInsert, search } from "./rank.ts";
import type { FindItem } from "./types.ts";

const NO_INDEX = { items: [] };

/** What an item inserts: a variable as the name the keys would type, a function as a call with the cursor in its
 *  argument, as `\operatorname` whatever the name's length: the parser reads it as a call and the box model as a name
 *  that owns its pair (R117: a one-letter `p\left(#0\right)` was a letter and a plain pair, so ⌫ left p3, p·3). R258: a
 *  value is drawn as one letter when the keys type it so (`A`, `x_1`, `k_B`, a Greek letter, which home.ts draws with a
 *  command); any other name (`rate`, `g0`, `beam_w`) goes in as `\operatorname{rate}`, one name, never r·a·t·e. */
function insertOf(n: UserName): string {
  // R260f1: a function e_ or i_ (the letters' stand-ins, R67) goes in as the letter typed, `\operatorname{e}` as a
  // one-letter p; the parser reads it back as e_'s call while the session lists e_ as a function
  if (n.kind !== "var") return functionInsert(`fn:${Object.values(LETTER_NAMES).includes(n.name) ? typedName(n.name) : n.name}`);
  return nameLatex(n.name);
}

/** A variable's name as the line takes it (R258; the store sheet types it after ▶, R281). */
export function nameLatex(name: string): string {
  const drawn = homeResultToLatex(name);
  return /^[A-Za-z](_[A-Za-z0-9]*)?$/.test(name) || drawn.startsWith("\\") ? drawn : `\\operatorname{${name.replace(/_/g, "\\_")}}`;
}

/** A name as a Find live item (types.ts: kind `var` or `userfn`). Its value text is searched too (`desc`). R260: titled
 *  as typed (`beta_` β, render/home.ts typedName), found by both; the stored name stays first, which a pick reads. */
export function liveItem(n: UserName): FindItem {
  const desc = n.desc ?? n.preview;
  const typed = typedName(n.name);
  const names = typed === n.name ? [n.name] : [n.name, typed];
  return { id: `${n.kind === "fn" ? "userfn" : "var"}:${n.name}`, kind: n.kind === "fn" ? "userfn" : "var", names, title: typed, ...(desc ? { desc } : {}), tier: 0, insert: insertOf(n) };
}

/** A stored value's mark (S53f1): the one rule the history uses (displayMode.ts markFor), worked out for the text that is
 *  drawn: the preview was fixed when the value was stored, so the context is STD at the preview's own significant digits
 *  (Digits or FIX now do not change it). A name with facts (a float, an inexact value) gets its mark from them; a preview
 *  that is not one decimal (a list, a complex) has no value to read, so the facts alone say it is not exact (`approximate`:
 *  ≈ or ⚠, never `=`). A name without facts holds an exact value: the mark the engine noted when it was stored (`mark`);
 *  a name of a log stored before that shows none. */
function markOfName(n: UserName, ctx: DisplayContext): string {
  if (!n.facts) return n.mark ?? "";
  const re = decimalFromString(n.preview.toLowerCase());
  const own: DisplayContext = { ...ctx, format: "std", digits: re ? Math.max(1, re.digits.length) : ctx.digits };
  const r: NumericResult = { facts: n.facts, ...(re ? { value: { re, im: ZERO_VALUE } } : { approximate: true }) };
  const m = markFor(r, undefined, own);
  return m ? markText(m) : "";
}

/** The value of a variable with its mark, as the history draws a result (`≈ 0.333333333333`). */
export function valueOf(n: UserName, ctx: DisplayContext): string {
  const mark = markOfName(n, ctx);
  return mark ? `${mark} ${n.preview}` : n.preview;
}

/** Details under the list: `A = 5`, `A ≈ 0.333333333333`, or a function with its comment. */
export function previewOf(n: UserName, ctx: DisplayContext): string {
  const typed = typedName(n.name);
  return n.kind === "fn" ? `${typed}(…)${n.desc ? ` · ${n.desc}` : ""}` : `${typed} ${valueOf(n, ctx)}${n.desc ? ` · ${n.desc}` : ""}`;
}

/** The letter grid's columns (Vars and the store sheet, R282): 26 letters in four rows (the mockup's six columns take five,
 *  which do not fit above the keypad at 360 × 740 with the title and the line under the grid; fit.spec.ts). */
export const NAME_COLUMNS = 7;
/** The letters the grid holds, in order: a stored name of one of them is a cell, any other name a row after the grid. */
export const NAME_LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** The row or cell of a stored name as Vars and the store sheet draw it (R282, one look): the name as typed, its value
 *  with its mark, the details line; `cell`: a cell of the grid. Each sheet adds what a tap does. */
export function nameRow(n: UserName, ctx: DisplayContext, id: string, cell: boolean): MenuItem {
  return { id, label: typedName(n.name), value: n.kind === "fn" ? t("memory.fn") : valueOf(n, ctx), preview: previewOf(n, ctx), ...(cell ? { cell: true as const } : {}), run: () => {} };
}

/** The names as a sheet's items (R282): the letters A–Z as the grid, a stored one drawn by `row` (with its value and mark),
 *  a free one by `free`; then the other names, newest first. */
export function nameItems(names: readonly UserName[], row: (n: UserName, cell: boolean) => MenuItem, free: (letter: string) => MenuItem): MenuItem[] {
  const byName = new Map(names.map((n) => [n.name, n]));
  const cells = NAME_LETTERS.map((l) => {
    const n = byName.get(l);
    return n ? row(n, true) : free(l);
  });
  const rest = names.filter((n) => !NAME_LETTERS.includes(n.name)).sort((a, b) => b.time - a.time);
  return [...cells, ...rest.map((n) => row(n, false))];
}

/** Whether the clear-all row was pressed once (it clears on the second Enter). Reactive, so the row redraws. */
const ui = $state({ armed: false });

/** Vars (`memory` false) or Memory (true) as a sheet above the keypad, its keys those of Find (route.ts, sheetKeys.ts). */
export function showNames(shell: { sheet: Sheet | null }, entry: EntryController, session: Session, memory: boolean): void {
  ui.armed = false;
  const names = (): readonly UserName[] => session.userNames;
  /** After a deletion: the hits are read again and the highlight stays on a row. */
  const settle = (): void => {
    const level = shell.sheet?.level;
    if (!level) return;
    level.refresh();
    level.highlight = Math.min(level.highlight, level.items.length - 1);
  };
  const run = (n: UserName): void => {
    if (memory) {
      ui.armed = false;
      void session.forget([n.name]);
      settle();
    } else entry.run({ kind: "insert", latex: insertOf(n) });
  };
  const row = (n: UserName, cell = false): MenuItem => ({
    ...nameRow(n, session.displayContext(), liveItem(n).id, cell),
    ...(memory ? { keep: true } : {}),
    run: () => run(n),
  });
  /** Vars' grid (R282): a free letter is not a name, but a tap on it puts the letter on the line, as typing it would. */
  const free = (letter: string): MenuItem => ({
    id: `name:${letter}`,
    label: letter,
    cell: true,
    preview: t("vars.free", { name: letter }),
    run: () => entry.run({ kind: "insert", latex: letter }),
  });
  /** Vars: the grid of letters with their values, then the other names; Memory: every name newest first, then Clear all. */
  const listed = (): MenuItem[] => (memory ? all() : nameItems(names(), row, free));
  const newest = (): string | undefined => {
    const last = [...names()].sort((a, b) => b.time - a.time)[0];
    return last && liveItem(last).id;
  };
  const clearAll: MenuItem = {
    id: "clearall",
    get label() {
      return ui.armed ? t("memory.sure", { n: String(names().length) }) : t("memory.clear");
    },
    keep: true,
    run: () => {
      if (!ui.armed) ui.armed = true;
      else {
        ui.armed = false;
        void session.forget(names().map((n) => n.name));
        settle();
      }
    },
  };
  /** Newest definition first (the empty query shows what was just stored). */
  const all = (): MenuItem[] => [...names()].sort((a, b) => b.time - a.time).map((n) => row(n));
  const found = (q: string): MenuItem[] => {
    const by = new Map(names().map((n) => [n.name, n]));
    return search(NO_INDEX, q, { live: names().map(liveItem) }).flatMap((h) => {
      const n = by.get(h.item.names[0] ?? "");
      return n ? [row(n)] : [];
    });
  };
  // Vars opens on the newest name, as before; its filter is Find's search over the names (the hits are rows, the grid is for the empty query)
  shell.sheet = new Sheet("find", t(memory ? "memory.title" : "vars.title"), () => (memory && names().length ? [...all(), clearAll] : listed()), {
    search: found,
    remember: false,
    ...(memory ? {} : { cells: NAME_COLUMNS, ...(newest() ? { at: newest() as string } : {}) }),
  });
}
