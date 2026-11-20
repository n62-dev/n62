// SPDX-License-Identifier: GPL-3.0-or-later
import type { Giac } from "./numeric.ts";

/** Giac's lname of `expr` (the names in it, ∞ as `infinity`), from bridge-3's elements (not Giac's text, P20); null when it is no list (an error). Its own module: numeric.ts is at its line baseline. */
export function namesOf(giac: Giac, expr: string): string[] | null {
  const v = giac.value(`lname(${expr})`, []);
  return v.kind === "list" || v.kind === "matrix" ? (v.elements ?? null) : null;
}
