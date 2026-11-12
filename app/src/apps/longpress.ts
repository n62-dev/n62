// SPDX-License-Identifier: GPL-3.0-or-later
// A long press (500 ms) on a value: it copies the value (docs/04 section 2.6), in an app view and on a history row's
// input or result (R276: the one long-press code of the app). A Svelte action; the click that follows the lift is
// swallowed so the press does not also pick, select or edit. A finger that moves more than MOVE_PX is a drag (a row's
// swipe, R276), not a press.
const LONG_PRESS_MS = 500;
const MOVE_PX = 8; // (below rowSwipe.ts's 10 px that decides a drag: a swipe always ends the press first)

export function longpress(node: HTMLElement, run: (() => void) | undefined): { update(r: (() => void) | undefined): void; destroy(): void } {
  let act = run;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;
  let x0 = 0;
  let y0 = 0;
  const stop = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  const down = (e: PointerEvent): void => {
    stop();
    fired = false;
    if (!act || e.button > 0) return;
    x0 = e.clientX;
    y0 = e.clientY;
    timer = setTimeout(() => {
      timer = undefined;
      fired = true;
      act?.();
    }, LONG_PRESS_MS);
  };
  const move = (e: PointerEvent): void => {
    if (timer !== undefined && Math.hypot(e.clientX - x0, e.clientY - y0) > MOVE_PX) stop();
  };
  const click = (e: MouseEvent): void => {
    if (!fired) return;
    fired = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  const menu = (e: Event): void => {
    if (act) e.preventDefault(); // the browser's own long-press menu would cover ours
  };
  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", stop);
  node.addEventListener("pointercancel", stop);
  node.addEventListener("pointerleave", stop);
  node.addEventListener("click", click, true);
  node.addEventListener("contextmenu", menu);
  return {
    update(r) {
      act = r;
    },
    destroy() {
      stop();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", stop);
      node.removeEventListener("pointercancel", stop);
      node.removeEventListener("pointerleave", stop);
      node.removeEventListener("click", click, true);
      node.removeEventListener("contextmenu", menu);
    },
  };
}
