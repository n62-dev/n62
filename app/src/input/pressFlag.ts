// SPDX-License-Identifier: GPL-3.0-or-later
// R161, R164 (F191): the press look is the app's own flag `data-down` on the touched element, never CSS `:active` (on a touch
// screen Chrome sets that from Android's tap detector: late, and stuck on one element in fast tapping). Set at the finger
// down, removed at the later of the lift and PRESS_MS after the down, so a quick tap is seen; a cancel or the app going away
// clears it at once. Plain DOM, no Svelte state: nothing re-renders. The keypad (keyboard/Keypad.svelte) drives a
// `PressFlag` itself, since it handles pointers for the whole pad; every single button uses the `pressFlag` action.

/** How long a press shows at least, from the down (ms). */
export const PRESS_MS = 80;

export interface PressFlag {
  /** The finger came down on `el`: lit now (a new down on an element still lit keeps it lit, its 80 ms counted anew). */
  light(el: HTMLElement | undefined): void;
  /** The finger lifted: out at the later of now and PRESS_MS after the down. */
  unlight(el: HTMLElement | undefined): void;
  /** A cancel, or the page going away: every flag out at once. */
  clearAll(): void;
}

/** A set of lit elements. `onOff` is told when an element's flag goes out by the clock (not by a cancel). */
export function createPressFlag(onOff?: (el: HTMLElement) => void): PressFlag {
  const lit = new Map<HTMLElement, { at: number; timer?: ReturnType<typeof setTimeout> }>();
  return {
    light(el) {
      if (!el) return;
      clearTimeout(lit.get(el)?.timer);
      lit.set(el, { at: performance.now() });
      el.dataset["down"] = "";
    },
    unlight(el) {
      const l = el && lit.get(el);
      if (!el || !l || l.timer !== undefined) return;
      const off = (): void => {
        lit.delete(el);
        delete el.dataset["down"];
        onOff?.(el);
      };
      const left = Math.ceil(l.at + PRESS_MS - performance.now());
      if (left <= 0) off();
      else l.timer = setTimeout(off, left);
    },
    clearAll() {
      for (const [el, l] of lit) {
        clearTimeout(l.timer);
        delete el.dataset["down"];
      }
      lit.clear();
    },
  };
}

const shared = createPressFlag();

/** A Svelte action for one button: `<button use:pressFlag>`. Every button shares one set, so a cancel clears them all (the
 *  page going away ends every touch with one). A disabled button is dimmed by its own rule, which comes after the flag's. */
export function pressFlag(node: HTMLElement): void {
  const up = (): void => shared.unlight(node);
  node.addEventListener("pointerdown", () => shared.light(node));
  node.addEventListener("pointerup", up);
  node.addEventListener("pointerleave", up); // (a mouse that slides off, which has no implicit capture)
  node.addEventListener("pointercancel", () => shared.clearAll());
}
