// SPDX-License-Identifier: GPL-3.0-or-later
// The only door from the start chunk into the Shift palettes' chunk (R18, keyboard/shiftPalettes.ts). It starts loading
// with MathLive (render/mathlive.svelte.ts), like the parser, so it is there before anything can be entered.
import { lazyOnce } from "../lazyOnce.ts";

/** Set once the chunk is there: Shift + 6 and Shift + 9 then open at once. */
export let shiftPalettes: typeof import("./shiftPalettes.ts") | undefined;

/** A failed load is tried again by the next palette key (R263). */
export const loadShiftPalettes = lazyOnce(() => import("./shiftPalettes.ts").then((m) => (shiftPalettes = m)));
