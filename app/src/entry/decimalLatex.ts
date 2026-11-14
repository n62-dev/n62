// SPDX-License-Identifier: GPL-3.0-or-later
// R189f1: the one rule that writes a plain decimal for the entry line, shared by the Solve app (its values) and the
// matrix grid's write-back (engine/matrixRead.ts, its floats). A module of its own, so the start chunk does not take it.
import { EMARK } from "./macros.ts";

/** A plain decimal as LaTeX for the entry line, its exponent as the exponent key types it (R14): 1.5e-3 → 1.5ᴇ-3,
 *  1.5E+20 → 1.5ᴇ20. */
export const decimalLatex = (s: string): string => s.replace(/[eE]\+?(-?\d+)$/, `${EMARK}$1`);
