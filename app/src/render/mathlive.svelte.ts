// SPDX-License-Identifier: GPL-3.0-or-later
// MathLive is the biggest part of the bundle, so it loads after the keypad has been drawn (dynamic import).
// `lib.mod` becomes defined once it is there; views that draw LaTeX show plain text until then. The renderer's macro
// table (render/macros.ts, entry/macroTable.ts) loads with it, out of the start chunk (R791 fix round 1).
import type * as MathLive from "mathlive";
import type { renderOptions } from "./macros.ts";
import { loadParser } from "../input/parser.ts";
import { loadShiftPalettes } from "../keyboard/palettes.ts";
import { lazyOnce } from "../lazyOnce.ts";

class Lazy {
  mod = $state<typeof MathLive | undefined>(undefined);
  /** The options for `convertLatexToMarkup` (render/macros.ts), set before `mod`; undefined until then. */
  options: typeof renderOptions | undefined;
  /** R263: a failed load is tried again by the next call. */
  private readonly loadMod = lazyOnce(() =>
    Promise.all([import("mathlive"), import("./macros.ts")]).then(([m, r]) => {
      this.options = r.renderOptions;
      this.mod = m;
      return m;
    }),
  );

  load(): Promise<typeof MathLive> {
    // The parser chunk comes with MathLive (decisions M4-3): both are needed only once something can be entered.
    void loadParser().catch(() => undefined);
    void loadShiftPalettes().catch(() => undefined); // R18: the Shift palettes, needed only to enter something
    return this.loadMod();
  }
}

export const mathlive = new Lazy();

/** How many LaTeX strings have been turned into markup (tests check that Enter draws only the new entry). */
export const renderStats = { count: 0 };
