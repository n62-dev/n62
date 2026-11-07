// SPDX-License-Identifier: GPL-3.0-or-later
// R152 (F189): the macro table of the static renderer. MathLive's `macros` option REPLACES its own table, and
// `\exponentialE`, `\imaginaryI` (and the rest) are macros of that table, so passing only ENTRY_MACROS drew e and i as
// raw LaTeX in red. The entry line merges (`{ ...mf.macros, ...ENTRY_MACROS }`); this is that merge, in one place, for
// the field (entry/field.ts) and for Math.svelte. MathLive exports no default table (0.111.1): a mounted field's
// `macros` is the reference, so the defaults are read from one throw-away field, once.
import type * as MathLive from "mathlive";
import { ENTRY_MACROS } from "../entry/macros.ts";

type Macros = NonNullable<NonNullable<Parameters<typeof MathLive.convertLatexToMarkup>[1]>["macros"]>;

/** The entry line's table: MathLive's defaults, the entry's own macros last (the field's order). */
export const withEntryMacros = (defaults: Readonly<Macros>): Macros => ({ ...defaults, ...ENTRY_MACROS });

let table: Macros | undefined;

/** MathLive's own table, as a freshly mounted field holds it; undefined where there is no field (the SSR build). */
function mountedDefaults(lib: typeof MathLive): Macros | undefined {
  if (typeof lib.MathfieldElement !== "function" || typeof document === "undefined") return undefined;
  lib.MathfieldElement.fontsDirectory = null; // as the entry line (entry/field.ts): no fonts folder to fetch
  lib.MathfieldElement.soundsDirectory = null;
  const mf = new lib.MathfieldElement();
  mf.setAttribute("math-virtual-keyboard-policy", "manual");
  mf.style.cssText = "position:fixed;visibility:hidden;pointer-events:none";
  document.body.append(mf);
  try {
    return { ...mf.macros };
  } finally {
    mf.remove();
  }
}

/** The options Math.svelte hands to `convertLatexToMarkup`: built once from the loaded MathLive. */
export function renderOptions(lib: typeof MathLive): { macros: Macros } {
  if (table) return { macros: table };
  const defaults = mountedDefaults(lib);
  if (!defaults) return { macros: ENTRY_MACROS };
  return { macros: (table = withEntryMacros(defaults)) };
}
