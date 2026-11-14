// SPDX-License-Identifier: GPL-3.0-or-later
// R188 (docs/04 5.3): a stored matrix in rows and columns, the level the matrix sheet (Shift + 4) opens on a stored
// matrix's row. The model: the matrix is read through the engine when the level opens (Home's path, so each element
// comes with its facts and is drawn by the Home formatter with Home's ≈ or ⚠; a matrix that holds a symbol through the
// bridge, engine/matrixRead.ts, its numbers drawn the same way; never parsed from a printed text); ▲ ▼ ◀ ▶ move the
// highlight and stop at the edges; Esc goes back to the list (views/sheet.svelte.ts). Its view, MatrixGrid.svelte, is a
// chunk of its own, loaded when a grid opens.
// R189 (docs/04 5.3): a key that types starts the highlighted cell's edit on the entry line (the line that was there is
// kept and comes back when the edit ends); Enter writes the line `M:=\begin{pmatrix}…\end{pmatrix}`, the typed cell as
// typed and every other element as LaTeX the line reads back (engine/matrixRead.ts ElementTex), and sends it through the
// session's normal path (one history row, which a recall evaluates the same; the definitions log keeps the store), then
// reads the grid again. Before that the worker checks the parser's store (matrixRead.ts checkStore): a matrix of the
// same size, no other store, every other element as it was. A refusal shows under the grid and sends nothing; Esc ends
// the edit and the old value stays.
// R190 (docs/04 5.3): ☰ opens the grid's menu (1 Add a row, 2 Add a column at the end, with zeros; 3 Delete the row, 4 the
// column under the highlight; a matrix keeps one cell at least), and a pick writes the matrix back as a cell does: its
// elements as LaTeX the line reads back, the store checked by the worker, one history row. `createMatrix` (the sheet's
// New) stores a 2 × 2 of zeros under the first free letter by the same path.
import type { Component } from "svelte";
import type { AppHost } from "../apps/types.ts";
import { engineFormat, type HomeOutcome } from "../calc/port.ts";
import type { EntryController } from "../entry/controller.ts";
import { t } from "../i18n/index.ts";
import { findText } from "../i18n/enFind.ts";
import type { ChipTable } from "../input/chips.ts";
import { parseFailText } from "../input/errors.ts";
import type { Key, Layer, Special } from "../keyboard/keyboard.ts";
import type { Session } from "../state/session.svelte.ts";
import { confirmedOptions, formatComplex, markOf, type ComplexValue, type FormatOptions } from "../engine/format.ts";
import type { ValueFacts } from "../engine/types.ts";
import type { HomeResult } from "../engine/homeEval.ts";
import type { ElementTex, MatrixCell, MatrixRead } from "../calc/matrices.ts";
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
/** R190: what the sheet's New needs (the session of CellLine less its keys). */
export type NewLine = Pick<Session, "userNames" | "submit">;
/** R189: the matrix through the bridge: `cells` true its elements, "typed" its elements as typed text and LaTeX, with
 *  `check` the grid's store checked too (engine/matrixRead.ts); null when the name holds no matrix. */
export type ReadElements = (cells: true | "typed", check?: string) => Promise<MatrixRead | null>;
/** The render/tidy.ts function that the elements Giac wrote as LaTeX go through (as a CAS result does). */
type Tidy = (raw: string) => string;
/** R190: the grid's menu rows, in the digits 1 to 4 they keep. */
const MENU: readonly MenuOp[] = ["addRow", "addCol", "delRow", "delCol"];
type MenuOp = "addRow" | "addCol" | "delRow" | "delCol";
/** One row of the grid's menu: `reason` when it cannot be picked now. */
export interface GridMenuRow {
  readonly op: MenuOp;
  readonly label: string;
  readonly reason?: string;
}
/** The keys that keep the grid's own job when no cell is edited: ▲ ▼ ◀ ▶ move, Esc goes back (⌫ and Enter do nothing). */
const GRID_KEYS: readonly string[] = ["up", "down", "left", "right", "enter", "esc", "bksp"];
/** While a cell is edited, the specials that act on the line; any other (a sheet, a place, Format, units) does nothing,
 *  so the edit is not lost under it. */
const ON_LINE: readonly Special[] = ["clear", "selectGrow", "selectShrink"];

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
  private readonly elements: ReadElements;
  private pending: Promise<void> | null = null;
  /** R189: the cell edited on the entry line, else null. */
  editing = $state.raw<{ readonly row: number; readonly col: number } | null>(null);
  /** R189: why the typed cell was not written (the parser's refusal), shown under the grid until the next key. */
  refusal = $state<string | null>(null);
  /** R190: the highlighted row of the grid's menu while it is open, else null. */
  menu = $state<number | null>(null);
  /** R190: the line the menu was opened from (a tap on a row writes through it). */
  private menuLine: CellLine | null = null;
  /** R189: the line that was on the entry line before the edit, put back when it ends. */
  private saved: { readonly line: CellLine; readonly latex: string; readonly chips: ChipTable } | null = null;

  /** `home`: the name through Home's path; `elements`: its size and elements through the bridge (a matrix of symbols),
   *  null when it holds no matrix. */
  constructor(name: string, settings: () => Settings, home: () => Promise<HomeOutcome>, elements: ReadElements) {
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
    // the key's action in its layer, as keyboard.ts layerAction picks it (only whether it is special matters here; not
    // imported: the start chunk would export it for this chunk)
    const k = key.actions;
    const a = (layer === undefined ? s.alpha : layer === "alpha") ? (k.alpha ?? k.primary) : (layer === undefined ? s.shift : layer === "shift") ? k.shift : k.primary;
    const special = a?.kind === "special" ? a.name : undefined;
    if (this.menu !== null) return this.menuKey(key, special);
    if (!this.editing) {
      if (special === "menu") {
        this.menuLine = line; // R190: ☰ opens the grid's menu
        this.menu = 0;
        return true;
      }
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
    return special !== undefined && !ON_LINE.includes(special);
  }

  /** R189: the edit ends (Esc, the write, the grid closing): the line that was there comes back. */
  end(): void {
    const s = this.saved;
    this.saved = null;
    this.editing = null;
    this.refusal = null;
    this.menu = null;
    if (!s) return;
    if (s.latex === "") s.line.entry.clear();
    else s.line.entry.set(s.latex, s.chips);
  }

  /** R189: the typed cell into the matrix: refused when the parser refuses it; else the line of the whole store (each
   *  other element as LaTeX the line reads back), checked by the worker (refused when it is not a matrix of this size, as
   *  a cell of more than one value makes it, stores or purges another name, or changes another element), sent through
   *  the session's normal path, and the grid read again. */
  private async write(line: CellLine, latex: string, chips: ChipTable): Promise<void> {
    const at = this.editing;
    if (!at) return;
    try {
      const entry = await import("../input/entry.ts"); // (input/parser.ts loadEntry's module; not that loader: the start chunk would export it for this chunk)
      entry.giacOfEntry(latex, "cas", { chips, names: line.session.userNames }); // the parser's refusal of the cell itself, shown as Home shows it
    } catch (e) {
      this.refusal = parseFailText(e);
      return;
    }
    const m = await this.readTyped();
    if (typeof m === "string") return void (this.refusal = m);
    const k = at.row * m.cols + at.col;
    const cells = m.latex.map((e, i) => (i === k ? latex : cellTex(e, m.tidy)));
    // every element but the typed one is as it was
    await this.commit(line, chips, m, cells, m.rows, m.cols, (i) => (i === k ? -1 : i));
  }

  /** R190: a pick of the grid's menu (the digit, Enter, a tap): a row that cannot be picked says why; else the matrix is
   *  written back with the row or column added at the end (zeros) or the one under the highlight left out. */
  choose(i: number): void {
    const row = this.menuRows()[i];
    const line = this.menuLine;
    this.menu = null;
    if (!row || !line || this.editing || !Array.isArray(this.cells) || this.pending) return;
    if (row.reason) {
      this.refusal = row.reason;
      return;
    }
    this.pending = this.resize(line, row.op).finally(() => (this.pending = null)); // keys wait for it
  }

  /** R190: the menu's rows: the delete rows are out of reach when the matrix has one row or one column left. */
  menuRows(): GridMenuRow[] {
    const keep = findText("matrix.keepsCell");
    return [
      { op: "addRow", label: findText("matrix.addRow") },
      { op: "addCol", label: findText("matrix.addCol") },
      { op: "delRow", label: findText("matrix.delRow", { n: String(this.row + 1) }), ...(this.rows <= 1 ? { reason: keep } : {}) },
      { op: "delCol", label: findText("matrix.delCol", { n: String(this.col + 1) }), ...(this.cols <= 1 ? { reason: keep } : {}) },
    ];
  }

  /** R190: a key while the menu is open: ▲ ▼ move, Enter and the digits 1 to 4 pick, Esc and ☰ close it; any other key
   *  does nothing (it is used up here). */
  private menuKey(key: Key, special: Special | undefined): boolean {
    const at = this.menu ?? 0;
    const digit = /^d([1-4])$/.exec(key.id);
    if (key.id === "up" || key.id === "down") this.menu = Math.max(0, Math.min(MENU.length - 1, at + (key.id === "up" ? -1 : 1)));
    else if (key.id === "enter") this.choose(at);
    else if (digit) this.choose(Number(digit[1]) - 1);
    else if (key.id === "esc" || special === "menu") this.menu = null;
    return true;
  }

  /** R190: the matrix with a row or column added at the end (zeros) or the one under the highlight left out. */
  private async resize(line: CellLine, op: MenuOp): Promise<void> {
    const m = await this.readTyped();
    if (typeof m === "string") return void (this.refusal = m);
    const { rows: R, cols: C } = m;
    const rows = op === "addRow" ? R + 1 : op === "delRow" ? R - 1 : R;
    const cols = op === "addCol" ? C + 1 : op === "delCol" ? C - 1 : C;
    if (rows < 1 || cols < 1) return void (this.refusal = findText("matrix.keepsCell"));
    const src = (r: number, c: number): number => {
      const sr = op === "delRow" && r >= this.row ? r + 1 : r;
      const sc = op === "delCol" && c >= this.col ? c + 1 : c;
      return sr < R && sc < C ? sr * C + sc : -1; // (past the old size: a new zero)
    };
    const from = Array.from({ length: rows * cols }, (_, i) => src(Math.floor(i / cols), i % cols));
    await this.commit(line, line.entry.chips, m, from.map((f) => (f < 0 ? "0" : cellTex(m.latex[f] as ElementTex, m.tidy))), rows, cols, (i) => from[i] as number);
  }

  /** R189: the matrix's elements as typed text and as LaTeX the line reads back, with the tidy path its Giac elements go
   *  through; or the refusal when they cannot be read, or the matrix is not the size on the grid. */
  private async readTyped(): Promise<(MatrixRead & { readonly latex: readonly ElementTex[]; readonly tidy: Tidy | undefined }) | string> {
    const m = await this.elements("typed").catch(() => null);
    const tidy = m?.latex?.some((e) => e.giac) ? await import("../render/tidy.ts").then((x) => x.tidyGiacLatex, () => null) : undefined;
    if (!m?.latex || m.rows !== this.rows || m.cols !== this.cols || tidy === null) return findText("matrix.unread");
    return { ...m, latex: m.latex, tidy };
  }

  /** The matrix of `rows` × `cols` elements `tex` (each as LaTeX the line reads back): refused when the parser refuses
   *  it; else the line of the whole store, checked by the worker (refused when it is not a matrix of that size, as a cell
   *  of more than one value makes it, stores or purges another name, or changes an element that `from` keeps: the old
   *  index of the new element i, or -1 for one that is new or typed), sent through the session's normal path, and the
   *  grid read again. */
  private async commit(line: CellLine, chips: ChipTable, m: MatrixRead, tex: readonly string[], rows: number, cols: number, from: (i: number) => number): Promise<void> {
    const names = line.session.userNames;
    let entry: typeof import("../input/entry.ts");
    try {
      entry = await import("../input/entry.ts");
    } catch {
      return void (this.refusal = findText("matrix.unread"));
    }
    const lines = Array.from({ length: rows }, (_, r) => tex.slice(r * cols, (r + 1) * cols).join("&"));
    const row = `${nameTex(this.name)}:=\\begin{pmatrix}${lines.join("\\\\")}\\end{pmatrix}`;
    let store: string;
    try {
      store = entry.giacOfEntry(row, "cas", { chips, names }).giac;
    } catch {
      return void (this.refusal = findText("matrix.notKept"));
    }
    if (!store.startsWith(`${this.name}:=`)) return void (this.refusal = findText("matrix.notKept"));
    const c = await this.elements("typed", store).catch(() => null);
    if (!c?.candidate || !c.typed) return void (this.refusal = findText("matrix.unread"));
    if (!c.candidate.ok) return void (this.refusal = findText(c.candidate.why === "store" ? "matrix.noStore" : "matrix.oneValue"));
    if (c.candidate.rows !== rows || c.candidate.cols !== cols) return void (this.refusal = findText("matrix.oneValue"));
    const was = c.typed;
    if (c.candidate.typed.some((t, i) => from(i) >= 0 && t !== was[from(i)])) return void (this.refusal = findText("matrix.notKept"));
    const job = line.session.submit(row, undefined, chips);
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

/** R189: an element as the line types it: Giac's LaTeX through the tidy path, a float in approx() (a typed decimal is
 *  read exactly, so the float stays a float). */
function cellTex(e: ElementTex, tidy: Tidy | undefined): string {
  const tex = e.giac && tidy ? tidy(e.tex) : e.tex;
  return e.float ? `\\operatorname{approx}\\left(${tex}\\right)` : tex;
}

/** R189: the name as the line types it: one letter as it is, a longer name as the store sheet writes it (R281). */
function nameTex(name: string): string {
  return name.length === 1 ? name : `\\operatorname{${name}}`;
}

/** A cell's number and its facts: Home's element when it gave a value, or the bridge's number. */
function numberOf(c: GridCell): { value: ComplexValue; facts: ValueFacts } | null {
  if ("result" in c) return c.result.ok && c.result.value ? { value: c.result.value, facts: c.result.facts } : null;
  return "value" in c ? c : null;
}

/** R190: the sheet's New: the first letter A to Z (but I) that no name of the user's holds (and the parser takes as a name) gets a
 *  2 × 2 of zeros, stored through the session's normal path as a cell write is (one history row). The name, or null when
 *  every letter is taken, or a job runs (the press does nothing). */
export async function createMatrix(line: NewLine): Promise<string | null> {
  const used = new Set(line.userNames.map((n) => n.name));
  const entry = await import("../input/entry.ts");
  for (const name of "ABCDEFGHJKLMNOPQRSTUVWXYZ") { // (not I: the imaginary unit, which Giac cannot store into)
    if (used.has(name)) continue;
    const row = `${name}:=\\begin{pmatrix}0&0\\\\0&0\\end{pmatrix}`;
    try {
      if (!entry.giacOfEntry(row, "cas", { chips: {}, names: line.userNames }).giac.startsWith(`${name}:=`)) continue; // (a name the parser reads as something else)
    } catch {
      continue; // (a name it refuses: i, e, …)
    }
    const job = line.submit(row, undefined, {});
    if (!job) return null;
    await job;
    return name;
  }
  return null;
}
