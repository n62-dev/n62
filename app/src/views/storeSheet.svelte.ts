// SPDX-License-Identifier: GPL-3.0-or-later
// The store sheet (R281, sd-3 of docs/archive/store-design.md, design A): Store ▶ puts `value ▶` on the line and opens
// "Store in": the letters A–Z as a grid, a filled one with its value and mark, then the user's other names, newest
// first. A tap on a free letter types its name after the ▶ and presses Enter (the one store path: parser, engine, a
// history row); a tap on a filled name arms it (`5 · again?`) and a second tap stores; any other press disarms
// (route.ts). Letters typed filter, and Enter stores the typed name, a new one too; Esc leaves `value ▶` on the line.
// It takes letters, so it stays above the keypad (docs/05 3.1): Alpha and a letter key still type as on the G2.
// In the chunk of Vars' code (find/finder.ts re-exports it; App.svelte openStore).
import type { MenuItem } from "../apps/types.ts";
import type { UserName } from "../engine/defs.ts";
import { NAME_COLUMNS, NAME_LETTERS, nameItems, nameLatex, nameRow } from "../find/names.svelte.ts";
import { parseText } from "../i18n/enParser.ts";
import { storeText as t } from "../i18n/enStore.ts";
import { storeRefusal } from "../input/parseTables.ts";
import { typedName } from "../render/home.ts";
import { markText, noDigit } from "../state/displayMode.ts";
import type { HistoryItem, Session } from "../state/session.svelte.ts";
import { Sheet, type Level } from "./sheet.svelte.ts";

/** The store sheet's id (route.ts reads its keys by it). */
export const STORE_SHEET = "store";

const STORE_ARROW = "\\blacktriangleright";

/** What the sheet needs from App: the session's names, and the one store path (the name after ▶, then Enter). */
export interface StoreEnv {
  readonly shell: { sheet: Sheet | null };
  readonly session: Session;
  /** Types `latex` (a name) at the cursor, after the ▶, and presses Enter. */
  store(latex: string): void;
  /** R740: the keypad is folded: the sheet ends with New name…, which brings the keys up. */
  folded(): boolean;
  /** New name… was tapped: the keys come up (the sheet stays, its filter ready for the letters). */
  newName(): void;
}

/** What is stored, as the title shows it: a row's result with its mark (`≈ 0.333333333333`), else the line's text
 *  before the ▶ (`7`, not worked out yet: no mark), which comes with the clipboard's plain-text code (a chunk of its own:
 *  imported here, the unit view, which loads this chunk too, would name it). Empty: nothing to show. R301: a row whose
 *  chip went onto a line with text before it (`2+` then Store ▶ on the row of 5) stores the line, so the title reads it
 *  (`2+5`), not the row. */
export function storedText(session: Session, row: HistoryItem | undefined, line: string): string | Promise<string> {
  const at = line.lastIndexOf(STORE_ARROW);
  const before = at < 0 ? line : line.slice(0, at);
  if (row?.status === "done" && before.slice(0, Math.max(before.lastIndexOf("\\res{"), 0)).trim() === "") {
    const mark = session.mark(row);
    if (noDigit(mark)) return "⚠";
    const text = session.display(row).text;
    return mark ? `${markText(mark)} ${text}` : text;
  }
  return import("../clipboard/plaintext.ts").then((m) => m.entryText(before, session.decimalComma ? { decimalComma: true } : {}).trim(), () => "");
}

/** R804: the stored name that `typed` equals, as written or as the keys type it (`e_`), else undefined. The one rule for the line
 *  the store types (typedLatex) and for the question Enter asks (the sheet's `typed`). */
export function findHeld(typed: string, names: readonly UserName[]): UserName | undefined {
  return names.find((u) => u.name === typed || typedName(u.name) === typed);
}

/** The name the store types for `typed` (letters and digits from the filter, or a stored name as drawn): one letter as
 *  its key types it (e and i become e_ and i_ in the parser, as typed), a stored name as Vars inserts it, else one name
 *  (`rate`, `A1`). */
export function typedLatex(typed: string, names: readonly UserName[]): string {
  if (/^\p{L}$/u.test(typed)) return typed;
  const n = findHeld(typed, names);
  return n ? nameLatex(n.name) : `\\operatorname{${typed}}`;
}

/** Opens "Store in" for `stored` (storedText; a text still to come is put in the title when it comes). */
export function showStore(env: StoreEnv, stored: string | Promise<string>): void {
  const { session } = env;
  /** The title's value (a state: a text that comes later is in the question of a filled name too). */
  const shown = $state({ value: typeof stored === "string" ? stored : "" });
  const ctx = () => session.displayContext();
  const store = (latex: string): MenuItem => ({ id: "typed", label: "", run: () => env.store(latex) });
  /** A stored name: its value with its mark (Vars' look, nameRow), and the question before it is replaced. */
  const filled = (n: UserName, cell: boolean): MenuItem => {
    const name = typedName(n.name);
    const row = nameRow(n, ctx(), `name:${n.name}`, cell);
    // the value as the cell shows it, its mark kept (principle 3: an ≈ value never reads as exact in the question)
    const held = row.value ?? "";
    /** What it holds, as Vars' line under the list writes it: `A = 5`, `A ≈ 0.333333333333`, `f(…)`. */
    const what = n.kind === "fn" ? `${name}(…)` : `${name} ${held}`;
    return {
      ...row,
      // R804: the line says Enter only when this name is the one typed (Enter runs the typed name, whatever was tapped), else Tap
      confirm: { cell: t("store.again", { value: held }), note: findHeld(env.shell.sheet?.level.filter ?? "", [n]) ? (shown.value ? t("store.holdsTypedWith", { what, with: shown.value }) : t("store.holdsTyped", { what })) : shown.value ? t("store.holdsWith", { name, what, with: shown.value }) : t("store.holds", { name, what }) },
      run: () => env.store(typedLatex(name, [n])),
    };
  };
  const free = (letter: string): MenuItem => ({ id: `name:${letter}`, label: letter, cell: true, preview: t("store.free", { name: letter }), run: () => env.store(letter) });
  /** R740: folded, a last row that brings the keys up for a longer name (the grid has no room for it); unfolded the keys are there. */
  const fresh: MenuItem = { id: "new", label: t("store.new"), keep: true, run: () => env.newName() };
  const heldBy = (typed: string): UserName | undefined => findHeld(typed, session.userNames);
  const items = (): MenuItem[] => [...nameItems(session.userNames, filled, free), ...(env.folded() ? [fresh] : [])];
  const firstFree = NAME_LETTERS.find((l) => !session.userNames.some((n) => n.name === l));
  const sheet = new Sheet(STORE_SHEET, shown.value ? t("store.title", { value: shown.value }) : t("store.titleBare"), items, {
    cells: NAME_COLUMNS,
    filterable: true,
    remember: false,
    at: `name:${firstFree ?? "A"}`,
    // R804: a typed name that is stored is that name's own item, so Enter asks as a tap does (Sheet.enter); a free one stores at once
    typed: (name) => {
      const n = heldBy(name);
      return n ? filled(n, NAME_LETTERS.includes(n.name)) : store(typedLatex(name, session.userNames));
    },
    note: () => {
      const f = env.shell.sheet?.level.filter ?? "";
      if (f === "") return undefined;
      // R804f1: a name the parser refuses at Enter shows its reason now (the same words), not "is free"
      const refused = storeRefusal(f);
      if (refused) return parseText(...refused);
      if (heldBy(f)) return t("store.typedHeld", { name: f });
      return shown.value ? t("store.typedFreeWith", { name: f, with: shown.value }) : t("store.typedFree", { name: f });
    },
  });
  env.shell.sheet = sheet;
  if (typeof stored !== "string")
    void stored.then((v) => {
      shown.value = v;
      if (v) (sheet.levels[0] as Level).title = t("store.title", { value: v });
    });
}
