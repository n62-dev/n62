// SPDX-License-Identifier: GPL-3.0-or-later
// R710 (F385): the colours Plot's canvas draws its axes, tick numbers and trace dot in. JSXGraph's canvas renderer
// cannot resolve a CSS custom property: a "var(--muted)" stroke came out black (1.3:1 on N62 Dark's ground). So the
// theme's tokens are read here as literal colours, again whenever the look changes; no var(...) reaches JSXGraph.
import { brightness, family, highContrast } from "../../theme.svelte.ts";

export interface PlotInk {
  /** The axis lines and their tick numbers: --muted (text, at least 4.5:1 on --bg, docs/05 3.7). */
  axis: string;
  /** The tick marks: --line. */
  tick: string;
  /** The trace dot: --text. */
  trace: string;
}

/** A token's value on the page's root, or `fallback` when the page has none (no stylesheet). */
export function token(style: Pick<CSSStyleDeclaration, "getPropertyValue">, name: string, fallback: string): string {
  return style.getPropertyValue(name).trim() || fallback;
}

/** The three colours for the look the page is in (reactive: read in an effect, it runs again on a family, brightness or
 *  High contrast change; applyTheme sets those attributes only once the family's stylesheet is in). */
export function plotInk(root: Element = document.documentElement): PlotInk {
  void brightness();
  void family();
  void highContrast();
  const s = getComputedStyle(root);
  return { axis: token(s, "--muted", "gray"), tick: token(s, "--line", "gray"), trace: token(s, "--text", "gray") };
}
