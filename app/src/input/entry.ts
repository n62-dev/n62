// SPDX-License-Identifier: GPL-3.0-or-later
// The one place that holds the per-view options of an entry's LaTeX → Giac step (G98, hind-2): the session and the
// golden runner both call it, so the gate checks the input the app sends.
import { latexToGiacInfo, userFunctionsOf, userValuesOf, type LatexToGiacOptions } from "./latex-to-giac.ts";
import type { ChipTable } from "./chips.ts";
import type { ConstEntry, ConstTable } from "../engine/constUnc.ts";
import type { UserName } from "../engine/defs.ts";

export type EntryView = "home" | "cas";

/** `consts` (R40): the constants it holds by name, as the engine takes them (constTableOf). */
type EntryResult = Omit<ReturnType<typeof latexToGiacInfo>, "consts"> & { consts?: ConstTable };

/** The Giac text of an entry in `view`. Home sends a chip that is not exact by name (`pasr_<k>`, R65/G49), and an
 *  inexact constant (`pasc_<id>`, R40); a power keeps Giac's principal root in both views (R66). `o` carries what is not
 *  per view: the entry's chips and the user's names, as the session holds them: its functions are calls (R56), its
 *  values of more than one letter are read as `\operatorname{name}` (R258). */
export function giacOfEntry(latex: string, view: EntryView, o: { chips?: ChipTable; names?: readonly Pick<UserName, "name" | "kind">[] } = {}): EntryResult {
  const { names, ...rest } = o;
  const user = names ? { userFunctions: userFunctionsOf(names), userValues: userValuesOf(names) } : {};
  const r = latexToGiacInfo(latex, { ...rest, ...user, ...(view === "home" ? { chipNames: true } : {}) });
  return r.consts ? { ...r, consts: constTableOf(r.consts) } : (r as EntryResult);
}

/** R40: the constants an input holds by name (`pasc_<id>`), as the engine takes them (G26): the value and σ, and G81's
 *  basis and leaves (constants that share a leaf enter through their basis; without the two, each is an input of its
 *  own again). A stored basis is passed unchecked: the engine checks it before any use (constBasis.ts basisOf). */
export function constTableOf(consts: ChipTable): ConstTable {
  const out: Record<string, ConstEntry> = {};
  for (const [id, c] of Object.entries(consts)) {
    const { value, unc, basis, basisLeaves } = c;
    out[id] = { value, ...(unc !== undefined ? { unc } : {}), ...(basis !== undefined ? { basis } : {}), ...(basisLeaves !== undefined ? { basisLeaves } : {}) };
  }
  return out;
}
