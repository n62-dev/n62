// SPDX-License-Identifier: GPL-3.0-or-later
// R188 (docs/04 5.3): a stored matrix in rows and columns, the level the matrix sheet (Shift + 4) opens on a stored
// matrix's row. The model: the matrix is read through the engine when the level opens (Home's path, so each element
// comes with its facts and is drawn by the Home formatter with Home's ≈ or ⚠; a matrix that holds a symbol through the
// bridge, engine/matrixRead.ts, its numbers drawn the same way; never parsed from a printed text); ▲ ▼ ◀ ▶ move the
// highlight and stop at the edges; Esc goes back to the list (views/sheet.svelte.ts). Its view, MatrixGrid.svelte, is a
// chunk of its own, loaded when a grid opens. Editing a cell is R189's.
import type { Component } from "svelte";
import type { AppHost } from "../apps/types.ts";
import { engineFormat, type HomeOutcome } from "../calc/port.ts";
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
  private readonly elements: () => Promise<MatrixRead | null>;
  private pending: Promise<void> | null = null;

  /** `home`: the name through Home's path; `elements`: its size and elements through the bridge (a matrix of symbols),
   *  null when it holds no matrix. */
  constructor(name: string, settings: () => Settings, home: () => Promise<HomeOutcome>, elements: () => Promise<MatrixRead | null>) {
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

  private async read(): Promise<void> {
    this.cells = null;
    const r = await this.home().catch(() => null);
    if (r?.ok && r.shape && r.items && r.items.length === r.shape[0] * r.shape[1] && r.shape[1] > 0) {
      return this.fill(r.shape[0], r.shape[1], r.items.map((result) => ({ result })));
    }
    const m = await this.elements().catch(() => null);
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
