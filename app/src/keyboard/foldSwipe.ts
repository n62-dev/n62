// SPDX-License-Identifier: GPL-3.0-or-later
// R53 (P16): the swipe on the entry line that folds the keypad into results mode, and back. A pointer that starts on the
// line and moves at least FOLD_PX down (up: unfold), mostly vertical (|dy| > 2 |dx|) and within SWIPE_MS, is the
// swipe, whichever way the keypad is (down on a folded keypad does nothing, and changes nothing on the line either);
// every other pointer stays MathLive's (a tap places the caret, a horizontal drag selects). MathLive sees the
// pointerdown first-hand, so the caret it placed there, and any selection the drag made before it was recognized, are
// put back from the snapshot taken at the pointerdown: the swipe changes nothing on the line. Listeners in the capture
// phase on the line's box, so they run before the field's own. No dependency.

export const FOLD_PX = 24;
export const SWIPE_MS = 400;

export type Swipe = "down" | "up";

/** One pointer's path since its down: a swipe, "drop" once it can no longer be one, else undefined (undecided). */
export function swipeOf(dx: number, dy: number, ms: number): Swipe | "drop" | undefined {
  const vertical = Math.abs(dy) > 2 * Math.abs(dx);
  if (vertical && Math.abs(dy) >= FOLD_PX && ms <= SWIPE_MS) return dy > 0 ? "down" : "up";
  if (ms > SWIPE_MS || (!vertical && Math.abs(dx) >= FOLD_PX / 2)) return "drop"; // too slow, or sideways: a selection or a scroll of the line
  return undefined;
}

export interface SwipeEnv {
  /** Swipes are taken now (Home or CAS, no sheet over the keys). Read at each pointerdown. */
  on(): boolean;
  /** The line's caret and selection, taken at the pointerdown before the field has it. */
  snapshot(): unknown;
  restore(snap: unknown): void;
  fire(s: Swipe): void;
}

/** Listen on `el` (the entry line's box); returns the remover. */
export function foldSwipe(el: HTMLElement, env: SwipeEnv): () => void {
  let track: { id: number; x: number; y: number; t: number; snap: unknown; done: boolean } | undefined;
  const down = (e: PointerEvent): void => {
    track = undefined;
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (env.on()) track = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, snap: env.snapshot(), done: false };
  };
  const move = (e: PointerEvent): void => {
    const t = track;
    if (!t || e.pointerId !== t.id) return;
    if (t.done) return void e.stopPropagation(); // the field's drag must not select
    const s = swipeOf(e.clientX - t.x, e.clientY - t.y, e.timeStamp - t.t);
    if (s === undefined) return;
    if (s === "drop") return void (track = undefined);
    t.done = true;
    e.stopPropagation();
    env.restore(t.snap);
    env.fire(s);
  };
  /** A swipe's touch ends with no click and no tap (the browser's gesture code saw it as one in tests, and then took
   *  the next tap within its double-tap time). */
  let swiped = false;
  const end = (e: PointerEvent): void => {
    const t = track;
    if (!t || e.pointerId !== t.id) return;
    track = undefined;
    swiped = t.done && e.pointerType === "touch";
    // the field ends its own drag on this event; the line is put back after it
    if (t.done) setTimeout(() => env.restore(t.snap));
  };
  const touchEnd = (e: TouchEvent): void => {
    if (swiped && e.cancelable) e.preventDefault();
    swiped = false;
  };
  /** A touch that is or may become a swipe (mostly vertical so far) starts no scroll, whose fling would take the next
   *  tap's click; a sideways one keeps the line's own pan. */
  const touchMove = (e: TouchEvent): void => {
    const t = track;
    const p = e.touches[0];
    if (!t || !p || !e.cancelable) return;
    if (t.done || Math.abs(p.clientY - t.y) > 2 * Math.abs(p.clientX - t.x)) e.preventDefault();
  };
  const opts = { capture: true };
  el.addEventListener("pointerdown", down, opts);
  el.addEventListener("pointermove", move, opts);
  el.addEventListener("pointerup", end, opts);
  el.addEventListener("pointercancel", end, opts);
  el.addEventListener("touchend", touchEnd, { capture: true, passive: false });
  el.addEventListener("touchmove", touchMove, { capture: true, passive: false });
  return () => {
    el.removeEventListener("touchend", touchEnd, opts);
    el.removeEventListener("touchmove", touchMove, opts);
    el.removeEventListener("pointerdown", down, opts);
    el.removeEventListener("pointermove", move, opts);
    el.removeEventListener("pointerup", end, opts);
    el.removeEventListener("pointercancel", end, opts);
  };
}
