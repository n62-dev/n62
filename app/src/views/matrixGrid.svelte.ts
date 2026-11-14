// SPDX-License-Identifier: GPL-3.0-or-later
// R188 (docs/04 5.3): a stored matrix in rows and columns, the level the matrix sheet (Shift + 4) opens on a stored
// matrix's row. The model: the matrix is read through the engine when the level opens (Home's path, so each element
// comes with its facts and is drawn by the Home formatter with Home's ≈ or ⚠; a matrix that holds a symbol through the
// bridge, engine/matrixRead.ts, its numbers drawn the same way; never parsed from a printed text); ▲ ▼ ◀ ▶ move the
// highlight and stop at the edges; Esc goes back to the list (views/sheet.svelte.ts). Its view, MatrixGrid.svelte, is a
// chunk of its own, loaded when a grid opens.
// R189 (docs/04 5.3): a key that types starts the highlighted cell's edit on the entry line (the line that was there is
// kept and comes back when the edit ends); Enter reads the typed cell through the parser and stores `M:=[[…]]` through
// the session's normal path (one history row; the definitions log keeps it), every other element as the log types a
// stored value (engine/matrixRead.ts typed), then reads the grid again. A refusal of the parser shows under the grid and
// sends nothing; Esc ends the edit and the old value stays.
import type { Component } from "svelte";
import type { AppHost } from "../apps/types.ts";
import { engineFormat, type HomeOutcome } from "../calc/port.ts";
import type { EntryController } from "../entry/controller.ts";
import { t } from "../i18n/index.ts";
import { findText } from "../i18n/enFind.ts";
import type { ChipTable } from "../input/chips.ts";
import { parseFailText } from "../input/errors.ts";
import { loadEntry } from "../input/parser.ts";
import { actionFor, OPENS_SHEET, type Key, type Layer, type Special } from "../keyboard/keyboard.ts";
import type { Session } from "../state/session.svelte.ts";
import { confirmedOptions, formatComplex, markOf, type ComplexValue, type FormatOptions } from "../engine/format.ts";
import type { ValueFacts } from "../engine/types.ts";
import type { HomeResult } from "../engine/homeEval.ts";
import type { MatrixCell, MatrixRead } from "../calc/matrices.ts";
import { groupMarked } from "../render/groupText.ts";
import { groupSepFor } from "../render/home.ts";
import { commaResult } from "../state/displayMode.ts";

/** A cell: an element as Home computed it, or (a matrix Home gives no elements for: one that holds a symbol) as the
 *  bridge read it (engine/matrixRead.ts): a number with its facts, or Giac's text of an element that is not one. */
export type GridCell = { readonly result: HomeResult } | MatrixCell;

type Settings = AppHost["settings"];

/** R189: what a cell's edit needs of the app (route.ts RouteCtx has both): the entry line, which types the cell, and the
 *  session, which stores the matrix (and holds the Shift and Alpha state and the user's names for the parser). */
export interface CellLine {
  readonly entry: Pick<EntryController, "value" | "chips" | "clear" | "set">;
  readonly session: Pick<Session, "shift" | "alpha" | "userNames" | "submit">;
}
/** The keys that keep the grid's own job when no cell is edited: ▲ ▼ ◀ ▶ move, Esc goes back (⌫ and Enter do nothing). */
const GRID_KEYS: readonly string[] = ["up", "down", "left", "right", "enter", "esc", "bksp"];
/** While a cell is edited, a key that would open a sheet or change place does nothing (the edit would be lost under it). */
const HELD: readonly Special[] = [...OPENS_SHEET, "home", "cas", "switch", "symb", "plot", "num", "units"];

export class MatrixGrid {
  readonly name: string;
  /** The cells row by row once read; null while the read runs; "failed" when the engine gave no matrix. */
  cells = $state.raw<readonly GridCell[] | null | "failed">(null);
  rows = $state(0);
  cols = $state(0);
  /** The highlighted cell (0-based). */
  row = $state(0);
  col = $state(0);
  /** The view, once its chunk is in. */
  C = $state.raw<Component<{ grid: MatrixGrid }> | null>(null);
  readonly settings: () => Settings;
  private readonly home: () => Promise<HomeOutcome>;
  private readonly elements: (cells: true | "typed") => Promise<MatrixRead | null>;
  private pending: Promise<void> | null = null;
  /** R189: the cell edited on the entry line, else null. */
  editing = $state.raw<{ readonly row: number; readonly col: number } | null>(null);
  /** R189: why the typed cell was not written (the parser's refusal), shown under the grid until the next key. */
  refusal = $state<string | null>(null);
  /** R189: the line that was on the entry line before the edit, put back when it ends. */
  private saved: { readonly line: CellLine; readonly latex: string; readonly chips: ChipTable } | null = null;

  /** `home`: the name through Home's path; `elements`: its size and elements through the bridge (a matrix of symbols),
   *  null when it holds no matrix. */
  constructor(name: string, settings: () => Settings, home: () => Promise<HomeOutcome>, elements: (cells: true | "typed") => Promise<MatrixRead | null>) {
    this.name = name;
    this.settings = settings;
    this.home = home;
    this.elements = elements;
  }

  /** The level opened: read the matrix and load the view (once each; a failed view load is tried at the next open). */
  open(): void {
    if (!this.C) void import("./MatrixGrid.svelte").then((m) => (this.C = m.default as Component<{ grid: MatrixGrid }>), () => {});
    this.pending ??= this.read().finally(() => (this.pending = null));
  }

  /** The read while it runs (keys wait for it, route.ts rowsLoading), else null. */
  loading(): Promise<void> | null {
    return this.pending;
  }

  /** `keep`: the cells stay drawn while the matrix is read again (after a write, R189). */
  private async read(keep = false): Promise<void> {
    if (!keep) this.cells = null;
    const r = await this.home().catch(() => null);
    if (r?.ok && r.shape && r.items && r.items.length === r.shape[0] * r.shape[1] && r.shape[1] > 0) {
      return this.fill(r.shape[0], r.shape[1], r.items.map((result) => ({ result })));
    }
    const m = await this.elements(true).catch(() => null);
    if (!m?.cells || m.cells.length !== m.rows * m.cols || m.cols === 0) {
      this.cells = "failed";
      return;
    }
    this.fill(m.rows, m.cols, [...m.cells]);
  }

  private fill(rows: number, cols: number, cells: GridCell[]): void {
    this.rows = rows;
    this.cols = cols;
    this.row = Math.min(this.row, rows - 1);
    this.col = Math.min(this.col, cols - 1);
    this.cells = cells;
  }

  /** ▲ ▼ (`dr`) and ◀ ▶ (`dc`): the next cell; at an edge the highlight stays. */
  move(dr: number, dc: number): void {
    if (!Array.isArray(this.cells)) return;
    this.row = Math.max(0, Math.min(this.rows - 1, this.row + dr));
    this.col = Math.max(0, Math.min(this.cols - 1, this.col + dc));
  }

  /**
   * R189: a key while the grid is open (route.ts sheetPress asks first). `undefined`: the sheet's own job (no cell is
   * edited: ▲ ▼ ◀ ▶ move, Esc goes back, a control keeps its job); `false`: the key runs on the entry line, which edits
   * the highlighted cell (a key that types starts the edit); `true`: used here (Enter writes the cell, Esc ends the edit,
   * a key that would open a sheet or change place does nothing while a cell is edited).
   */
  key(line: CellLine, key: Key, layer: Layer | undefined): boolean | undefined {
    if (!Array.isArray(this.cells) || this.pending) return undefined;
    this.refusal = null;
    const s = line.session;
    const a = actionFor(key, layer === undefined ? s.shift : layer === "shift", layer === undefined ? s.alpha : layer === "alpha");
    const special = a?.kind === "special" ? a.name : undefined;
    if (!this.editing) {
      if (special !== undefined || GRID_KEYS.includes(key.id)) return undefined;
      this.saved = { line, latex: line.entry.value, chips: line.entry.chips };
      this.editing = { row: this.row, col: this.col };
      line.entry.clear();
      return false;
    }
    if (key.id === "enter") {
      const typed = line.entry.value;
      if (typed.trim() === "") this.end(); // nothing typed: the old value stays
      else this.pending = this.write(line, typed, line.entry.chips).finally(() => (this.pending = null)); // keys wait for it
      return true;
    }
    if (key.id === "esc") {
      this.end();
      return true;
    }
    return special !== undefined && HELD.includes(special);
  }

  /** R189: the edit ends (Esc, the write, the grid closing): the line that was there comes back. */
  end(): void {
    const s = this.saved;
    this.saved = null;
    this.editing = null;
    this.refusal = null;
    if (!s) return;
    if (s.latex === "") s.line.entry.clear();
    else s.line.entry.set(s.latex, s.chips);
  }

  /** R189: the typed cell into the matrix: parsed as CAS reads it (a chip as its value: the store keeps no chip table),
   *  written with the other elements as the log types them, stored through the session, and the grid read again. */
  private async write(line: CellLine, latex: string, chips: ChipTable): Promise<void> {
    const at = this.editing;
    if (!at) return;
    let giac: string;
    try {
      const entry = await loadEntry();
      giac = entry.giacOfEntry(latex, "cas", { chips, names: line.session.userNames }).giac;
    } catch (e) {
      this.refusal = parseFailText(e);
      return;
    }
    if (spreads(giac)) return void (this.refusal = findText("matrix.oneValue"));
    const m = await this.elements("typed").catch(() => null);
    const texts = m?.typed ? [...m.typed] : [];
    if (!m || texts.length !== this.rows * this.cols || m.cols !== this.cols) return void (this.refusal = findText("matrix.unread"));
    texts[at.row * m.cols + at.col] = giac;
    const store = `${this.name}:=[${Array.from({ length: m.rows }, (_, r) => `[${texts.slice(r * m.cols, (r + 1) * m.cols).join(",")}]`).join(",")}]`;
    const job = line.session.submit(store, store);
    if (!job) return void (this.refusal = t("status.busy")); // a job runs: the edit stays, Enter again later
    this.end();
    await job;
    await this.read(true);
  }

  /** A cell's text as Home draws a number (the formatter of engine/format.ts with the confirmed digits only, in the
   *  current format and digits, as calc/shown.ts confirmedText; that module is not imported: it would split a chunk shared
   *  with the apps, whose preload lists are in the start chunk), with the decimal comma when that is the mark: the cells'
   *  data-text, as Copy would take it. */
  text(c: GridCell): string {
    const s = this.settings();
    const n = numberOf(c);
    const plain = n ? formatComplex(n.value, confirmedOptions(n.value, n.facts.reliableDigits, this.options())).text : "text" in c ? c.text : "result" in c ? c.result.display : "";
    return s.decimalMark === "comma" ? commaResult(plain, false) : plain;
  }

  /** The text as drawn on screen: in digit groups, as Home's row and the Num table draw them (R125). */
  drawn(text: string): string {
    const s = this.settings();
    const comma = s.decimalMark === "comma";
    return groupMarked(text, groupSepFor(s.groupSep, comma), comma);
  }

  /** The cell's mark as Home's (markOf): ≈ a value shown rounded, ⚠ fewer confirmed digits than shown or a float nobody
   *  checked (a float element of a matrix that holds a symbol, as Home marks the whole of it, G27); null for an exact
   *  value shown in full (no = in every cell) and for a text with no float. */
  mark(c: GridCell): "≈" | "⚠" | null {
    const n = numberOf(c);
    const m = n ? markOf({ ...n.facts, value: n.value }, this.options())?.mark : "text" in c && c.unchecked ? "⚠" : null;
    return m === "≈" || m === "⚠" ? m : null;
  }

  private options(): FormatOptions {
    const s = this.settings();
    return { format: engineFormat(s.format), digits: s.digits };
  }
}

/** A cell's number and its facts: Home's element when it gave a value, or the bridge's number. */
function numberOf(c: GridCell): { value: ComplexValue; facts: ValueFacts } | null {
  if ("result" in c) return c.result.ok && c.result.value ? { value: c.result.value, facts: c.result.facts } : null;
  return "value" in c ? c : null;
}

/** R189: the parser's text is a sequence, more than one value, which Giac would spread over the row (`(1,2)` in a list
 *  is two elements): a comma or semicolon outside brackets, or inside bare parentheses only (not a call's arguments). */
function spreads(giac: string): boolean {
  const bare: boolean[] = []; // per open bracket: a parenthesis that is no call's
  let prev = "";
  for (const ch of giac) {
    if (ch === "(") bare.push(!/[\w)\]]/.test(prev));
    else if (ch === "[" || ch === "{") bare.push(false);
    else if (ch === ")" || ch === "]" || ch === "}") bare.pop();
    else if ((ch === "," || ch === ";") && bare.every((b) => b)) return true;
    if (ch !== " ") prev = ch;
  }
  return false;
}
