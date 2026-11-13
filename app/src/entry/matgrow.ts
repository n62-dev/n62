// SPDX-License-Identifier: GPL-3.0-or-later
// R185 (docs/04 5.3): the matrix Shift + 5 inserts grows as you type. A tapped ▶ (or a hardware →) at the end of a filled
// cell in its last column adds a column, a tapped ▼ (or ↓) in a filled cell of its last row adds a row (MathLive's
// addColumnAfter, addRowAfter); ▶ on a last column that is all empty (one just added) takes it back and puts the cursor
// after the matrix, and ▼ on an all-empty last row likewise (R186's rule, mirrored). A drag step on the pad never grows
// (docs/03 rules 6 and 8), and the Tmpl palette's matrices keep the size their cell gave them: both kinds are `pmatrix`
// on the line, so the line remembers which matrices Shift + 5 made (`Grown`), by the atoms before and after each one,
// and finds each again after every edit. A line set from outside (a recalled row, the kept line) has none (the default).
// Loaded with MathLive, outside the start chunk. Public MathLive API only; offsets and depths as in boxes.ts.
import type { MathfieldElement } from "mathlive";
import { PLACEHOLDER, atomStart, depthAt, latexAt } from "./boxes.ts";

type Field = Pick<MathfieldElement, "getElementInfo" | "lastOffset" | "position" | "selection" | "selectionIsCollapsed" | "executeCommand" | "getValue">;

/** Shift + 5's insert (spec/keyboard.yaml, d5): a 1×1 matrix, the selection or a □ in its cell. */
export const GROW_MATRIX = "\\begin{pmatrix}#0\\end{pmatrix}";
const PMATRIX = /^\\begin\{pmatrix\}/;

/** A grown matrix: its atom `q` on level `d`, the position `s` before it, and the line before and after it. */
type Anchor = { q: number; s: number; d: number; tail: number; pre: string; post: string; latex: string };

const SEP = "\u0001";
/** The atoms up to position `s`, each with its depth. None of them holds the matrix (an atom comes after its parts). */
function before(mf: Field, s: number): string {
  const out: string[] = [];
  for (let o = 1; o <= s; o++) out.push(`${depthAt(mf, o)}:${latexAt(mf, o)}`);
  return out.join(SEP);
}
/** The atoms after the matrix at `q` (level `d`); a template that holds it counts by its depth alone, since its LaTeX
 *  holds the matrix's. */
function after(mf: Field, q: number, d: number): string {
  const out: string[] = [];
  let min = d;
  for (let o = q + 1; o <= mf.lastOffset; o++) {
    const dep = depthAt(mf, o);
    if (dep < min) out.push(`^${(min = dep)}`);
    else out.push(`${dep}:${latexAt(mf, o)}`);
  }
  return out.join(SEP);
}
const isMatrix = (mf: Field, q: number, d: number): boolean => q <= mf.lastOffset && depthAt(mf, q) === d && PMATRIX.test(latexAt(mf, q));
/** The matrix on level `d` that starts right after position `s`, if one does. */
function matrixFrom(mf: Field, s: number, d: number): number | undefined {
  let p = s + 1;
  while (p <= mf.lastOffset && depthAt(mf, p) > d) p++;
  return isMatrix(mf, p, d) ? p : undefined;
}
function anchor(mf: Field, q: number): Anchor {
  const s = atomStart(mf, q);
  const d = depthAt(mf, q);
  return { q, s, d, tail: mf.lastOffset - q, pre: before(mf, s), post: after(mf, q, d), latex: latexAt(mf, q) };
}

/** The rows of a matrix's LaTeX: its row breaks `\\` outside braces and outside a matrix in a cell, plus one. */
export function rowCount(latex: string): number {
  const body = latex.replace(/^\\begin\{pmatrix\}/, "").replace(/\\end\{pmatrix\}$/, "");
  let rows = 1;
  let brace = 0;
  let env = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "{") brace++;
    else if (ch === "}") brace--;
    else if (ch === "\\") {
      if (body[i + 1] === "\\") {
        if (brace === 0 && env === 0) rows++;
        i++;
      } else if (body.startsWith("begin{", i + 1)) env++;
      else if (body.startsWith("end{", i + 1)) env--;
      else i++; // \{ and \} are no braces
    }
  }
  return rows;
}

/** The cell the cursor is in, directly (not inside a template in it): collapsed, or with a lone □ selected. */
function cellAt(mf: Field): { pos: number; q: number; d: number } | undefined {
  let pos: number;
  if (mf.selectionIsCollapsed) pos = mf.position;
  else if (mf.getValue(mf.selection, "latex") === PLACEHOLDER) pos = Math.max(...(mf.selection.ranges[0] ?? [mf.position]));
  else return undefined;
  const d = depthAt(mf, pos);
  if (d === 0) return undefined;
  let q = pos + 1;
  while (q <= mf.lastOffset && depthAt(mf, q) >= d) q++;
  return isMatrix(mf, q, d - 1) ? { pos, q, d: d - 1 } : undefined;
}

/** The matrices Shift + 5 made on the line (EntryController holds one, made with the field). */
export class Grown {
  private anchors: Anchor[] = [];

  /** The line was set or cleared: nothing on it grows. */
  clear(): void {
    this.anchors = [];
  }

  /** Shift + 5 has just inserted its matrix: the one the cursor is in (or right after, when it wrapped a selection). */
  add(mf: Field): void {
    const q = cellAt(mf)?.q ?? (isMatrix(mf, mf.position, depthAt(mf, mf.position)) ? mf.position : undefined);
    if (q !== undefined && !this.anchors.some((a) => a.q === q)) this.anchors.push(anchor(mf, q));
  }

  /**
   * After an edit: find each grown matrix again. An edit before it leaves the line after it as it was, an edit after it
   * (or in it) the line before it; a matrix neither finds is gone. Where both find a matrix and they differ (something
   * typed right before it), the one with the old LaTeX is it.
   */
  refresh(mf: Field): void {
    if (this.anchors.length === 0) return;
    const found: number[] = [];
    for (const a of this.anchors) {
      const byStart = a.s <= mf.lastOffset && before(mf, a.s) === a.pre ? matrixFrom(mf, a.s, a.d) : undefined;
      const qe = mf.lastOffset - a.tail;
      const byEnd = qe >= 0 && isMatrix(mf, qe, a.d) && after(mf, qe, a.d) === a.post ? qe : undefined;
      let q = byStart ?? byEnd;
      if (byStart !== undefined && byEnd !== undefined && byStart !== byEnd)
        q = latexAt(mf, byStart) === a.latex && latexAt(mf, byEnd) !== a.latex ? byStart : byEnd;
      if (q !== undefined && !found.includes(q)) found.push(q);
    }
    this.anchors = found.map((q) => anchor(mf, q));
  }

  /** A tapped ▶ (`moveToNextChar`) or ▼ (`moveDown`) at the edge of a grown matrix: true if it grew or shrank here. */
  key(mf: Field, cmd: string): boolean {
    if ((cmd !== "moveToNextChar" && cmd !== "moveDown") || this.anchors.length === 0) return false;
    const at = cellAt(mf);
    if (!at || !this.anchors.some((a) => a.q === at.q)) return false;
    const { pos, q, d } = at;
    const s = atomStart(mf, q);
    const cells: number[] = [];
    for (let o = s + 1; o < q; o++) if (depthAt(mf, o) === d + 1 && latexAt(mf, o) === "") cells.push(o);
    const rows = rowCount(latexAt(mf, q));
    const cols = cells.length / rows;
    if (!Number.isInteger(cols) || cols < 1) return false;
    const end = (i: number): number => (cells[i + 1] ?? q) - 1;
    const empty = (i: number): boolean => {
      const [f, e] = [cells[i] ?? 0, end(i)];
      return e === f || (e === f + 1 && latexAt(mf, e) === PLACEHOLDER);
    };
    let k = 0;
    while (k + 1 < cells.length && (cells[k + 1] ?? q) <= pos) k++;
    const [row, col] = [Math.floor(k / cols), k % cols];
    const right = cmd === "moveToNextChar";
    if (right ? col !== cols - 1 || pos !== end(k) : row !== rows - 1) return false;
    // the last column (row): all empty is the one just added, which ▶ (▼) takes back on the way out
    const line = right ? Array.from({ length: rows }, (_, r) => r * cols + col) : Array.from({ length: cols }, (_, c) => row * cols + c);
    if (line.every(empty)) {
      if ((right ? cols : rows) === 1) return false; // (the 1×1 itself: the plain step)
      mf.position = pos;
      mf.executeCommand(right ? "removeColumn" : "removeRow");
      mf.position = matrixFrom(mf, s, d) ?? mf.position;
      return true;
    }
    if (empty(k)) return false; // a column (row) grows from a filled cell only
    mf.executeCommand(right ? "addColumnAfter" : "addRowAfter");
    return true;
  }
}
