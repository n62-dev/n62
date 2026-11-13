// SPDX-License-Identifier: GPL-3.0-or-later
// R188 (docs/04 5.3): a stored matrix in rows and columns, the level the matrix sheet (Shift + 4) opens on a stored
// matrix's row. The model: the matrix is read through the engine when the level opens (Home's path, so each element
// comes with its facts and is drawn by the Home formatter; never parsed from the log's preview); ▲ ▼ ◀ ▶ move the
// highlight and stop at the edges; Esc goes back to the list (views/sheet.svelte.ts). Its view, MatrixGrid.svelte, is a
// chunk of its own, loaded when a grid opens. Editing a cell is R189's.
import type { Component } from "svelte";
import type { AppHost } from "../apps/types.ts";
import type { HomeOutcome } from "../calc/port.ts";
import { confirmedText, isWarned } from "../calc/shown.ts";
import type { HomeResult } from "../engine/homeEval.ts";
import { commaResult } from "../state/displayMode.ts";

/** A cell: an element as Home computed it, or (a matrix Home gives no elements for: one that holds a symbol) the
 *  engine's text of it. */
export type GridCell = { readonly result: HomeResult } | { readonly text: string };

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
  private readonly texts: () => Promise<string>;
  private pending: Promise<void> | null = null;

  /** `home`: the name through Home's path; `texts`: each element's Giac text, `[["a","1"],…]` (a matrix of symbols). */
  constructor(name: string, settings: () => Settings, home: () => Promise<HomeOutcome>, texts: () => Promise<string>) {
    this.name = name;
    this.settings = settings;
    this.home = home;
    this.texts = texts;
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
    const rows = readTexts(await this.texts().catch(() => ""));
    const cols = rows?.[0]?.length ?? 0;
    if (!rows || cols === 0 || rows.some((x) => x.length !== cols)) {
      this.cells = "failed";
      return;
    }
    this.fill(rows.length, cols, rows.flat().map((text) => ({ text })));
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

  /** A cell's text as Home shows it: the confirmed digits in the current format, with the decimal comma when that is the
   *  mark (the cells' data-text; the view draws it in digit groups). */
  text(c: GridCell): string {
    const s = this.settings();
    const plain = "text" in c ? c.text : c.result.ok ? (confirmedText(c.result, s) ?? c.result.display) : c.result.display;
    return s.decimalMark === "comma" ? commaResult(plain, false) : plain;
  }

  /** ⚠: the cell shows more digits than the engine confirmed (as the Num table's cells). */
  warned(c: GridCell): boolean {
    return "result" in c && c.result.ok && isWarned(c.result, this.settings());
  }
}

/** The engine's text answer `[["a","1"],["2","b"]]` as rows of texts; null when it is not one. */
export function readTexts(answer: string): string[][] | null {
  try {
    const v: unknown = JSON.parse(answer);
    return Array.isArray(v) && v.every((r) => Array.isArray(r) && r.every((x) => typeof x === "string")) ? (v as string[][]) : null;
  } catch {
    return null;
  }
}

/** The Giac input whose answer readTexts reads: each element of `name` as its text. */
export const textsQuery = (name: string): string => `map(${name},r->map(r,x->string(x)))`;
