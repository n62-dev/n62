// SPDX-License-Identifier: GPL-3.0-or-later
// R703 (F383): the part of the fit that runs only under the WebView's text zoom (Android's font scale), out of the start chunk:
// fit.ts loads it once it finds a zoom. The keypad's second pass, the bar's fit (views/barFit.ts, after each keypad fit and
// whenever the bar's content changes), and the ellipsis below a floor for every fitted text.
import { cut, fitBar } from "../views/barFit.ts";
import { MIN_FACE_PX, MIN_LEGEND_PX } from "./fit.ts";
// (cut is barFit.ts's, and no other chunk imports from this one: fit.ts's import of it then gets the module as it is, with no
// namespace object built at run time, which the start chunk paid for, R703f1)

/**
 * The keypad's second pass (after fit.ts fitLegends, which wrote each text it shrank through the zoom). What part of a text does
 * not scale with the zoom (the ▾ mark's own size) leaves it too wide: its width is a line in its size, measured at the size
 * written and at a trial size 20 % smaller, and the size that fits is read off it. Then a text that does not fit at its floor
 * is ellipsed, and one that fits again loses its …. A cut text's scrollWidth is still its whole width, so fit.ts never resets it.
 * Read, write, read, write, read: three layouts, only under a zoom.
 */
export function refit(pad: HTMLElement, z: number): void {
  const css = (drawn: number): string => `${Math.floor((drawn / z) * 100) / 100}px`;
  const all = [...pad.querySelectorAll<HTMLElement>(".key")].flatMap((key) => {
    const cs = getComputedStyle(key);
    const inner = key.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // (the room as fit.ts gives it: a maths key's ▾ may use 6 px of its side padding)
    return [...key.querySelectorAll<HTMLElement>("[data-fit]")].map((el) => ({
      el,
      room: inner + (key.dataset["letters"] && el.dataset["opens"] ? 6 : 0) - 1,
      floor: el.dataset["fit"] === "legend" ? MIN_LEGEND_PX : MIN_FACE_PX,
      size: parseFloat(getComputedStyle(el).fontSize),
      w1: el.scrollWidth,
    }));
  });
  const wide = all.filter((a) => a.w1 > a.room + 1 && a.el.style.fontSize !== "");
  for (const a of wide) a.el.style.fontSize = css(a.size * 0.8);
  const fixed = wide.map((a) => {
    const slope = (a.w1 - a.el.scrollWidth) / (a.size * 0.2);
    const next = slope > 0 ? Math.floor((a.size - (a.w1 - a.room) / slope) * 10) / 10 : a.floor;
    return { ...a, next };
  });
  for (const a of fixed) a.el.style.fontSize = css(Math.max(a.floor, a.next));
  const cuts = new Set(fixed.filter((a) => a.next < a.floor && a.el.scrollWidth > a.room + 1).map((a) => a.el));
  for (const a of all) if (a.el.hasAttribute("data-cut") !== cuts.has(a.el)) cut(a.el, cuts.has(a.el));
  fitBarOf(pad.ownerDocument);
}

const watched = new WeakSet<HTMLElement>();
/** The bar's fit, and again whenever its content changes (a format, a place, an app's views): its texts, not its styles. */
function fitBarOf(doc: Document): void {
  const bar = doc.querySelector<HTMLElement>("[data-testid='bar']");
  if (!bar) return;
  fitBar(bar);
  if (watched.has(bar) || typeof MutationObserver === "undefined") return;
  watched.add(bar);
  new MutationObserver(() => fitBar(bar)).observe(bar, { subtree: true, childList: true, characterData: true });
}
