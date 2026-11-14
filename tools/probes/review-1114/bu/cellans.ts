// SPDX-License-Identifier: GPL-3.0-or-later
// bu hunt (night review 2026-11-14): a matrix cell's edit runs on the Home/CAS entry line, which the grid clears first
// (views/matrixGrid.svelte.ts:170-172); the route then gives an operator on that empty line Ans first (keyboard/route.ts
// startsWithAns, entry/ans.ts). What the grid's checks (matrixGrid.svelte.ts:209 and :302, CAS parse with the line's
// chips, which hold no Ans: Ans is resolved at Enter, session.svelte.ts:461-463) make of such a cell.
// Run: env -C <review worktree>/app npx tsx <this file>
import { giacOfEntry } from "../../../../app/src/input/entry.ts";

const cell = ["\\ans-5", "\\ans^2", "\\ans^{-1}"];
for (const c of cell) {
  for (const latex of [c, `M:=\\begin{pmatrix}1&2\\\\${c}&4\\end{pmatrix}`]) {
    let out: string;
    try {
      out = giacOfEntry(latex, "cas", { chips: {}, names: [{ name: "M", kind: "var" }] }).giac;
    } catch (e) {
      out = `REFUSED ${(e as Error).message}`;
    }
    console.log(`${latex.padEnd(48)} -> ${out}`);
  }
}
