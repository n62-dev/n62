// SPDX-License-Identifier: GPL-3.0-or-later
// The five Appearance values (R50e, families R150, R153, R156): family, brightness, High contrast, Plain keys, Key shadows. Types, defaults and validation only,
// so the session (the start chunk) can hold them; the family names and colours are in lookView.ts and the mapping to
// applyTheme in lookApply.ts (both lazy). The inline script of index.html reads the same values from a localStorage
// mirror before the first paint.
import type { Family } from "./apply.ts";

export type BrightnessPref = "system" | "light" | "dark";
export interface Look {
  family: Family;
  brightness: BrightnessPref;
  /** High contrast: on at the first start when the system asks for more contrast (`prefers-contrast: more`). */
  contrast: boolean;
  /** Plain keys. */
  plain: boolean;
  /** Key shadows (R156): a dark line under each key; on by default, and for a stored look from before it. */
  shadow: boolean;
}

export const BRIGHTNESS: readonly BrightnessPref[] = ["system", "light", "dark"];
export const FAMILY_IDS: readonly Family[] = ["n62", "bw", "solarized"];
/** R150, R153: the families that were taken out (Graphite, Gruvbox, Nord; Teal); a stored look naming one shows as N62 and keeps its other three values. */
export const RETIRED_FAMILIES: readonly string[] = ["graphite", "gruvbox", "nord", "teal"];

/** The look of a first start: Dark in the Android app, System in the PWA (docs/05 3.10); High contrast when the system asks. */
export function defaultLook(native = false, moreContrast = false): Look {
  return { family: "n62", brightness: native ? "dark" : "system", contrast: moreContrast, plain: false, shadow: true };
}

/** A stored look, field by field: a wrong or missing field keeps `fallback`'s; a missing `shadow` (a look stored before
 *  R156) is on, the default. */
export function validLook(x: unknown, fallback: Look): Look {
  const o = (x && typeof x === "object" ? x : {}) as Partial<Record<keyof Look, unknown>>;
  const family = FAMILY_IDS.find((f) => f === o.family) ?? (typeof o.family === "string" && RETIRED_FAMILIES.includes(o.family) ? "n62" : fallback.family);
  const brightness = BRIGHTNESS.find((b) => b === o.brightness) ?? fallback.brightness;
  return {
    family,
    brightness,
    contrast: typeof o.contrast === "boolean" ? o.contrast : fallback.contrast,
    plain: typeof o.plain === "boolean" ? o.plain : fallback.plain,
    shadow: typeof o.shadow === "boolean" ? o.shadow : o.shadow === undefined || fallback.shadow,
  };
}
