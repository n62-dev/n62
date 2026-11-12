// SPDX-License-Identifier: GPL-3.0-or-later
// R276: a swipe left or right on a history row deletes it (docs/05 3.5): the row follows the finger and slides out at
// 40 % of its width or on a fling, else it springs back. The history's vertical scroll wins: the row is `touch-action:
// pan-y`, so the browser takes a gesture that starts vertical (pointercancel), and a drag that moves more down than
// across before it is decided never slides. A long input or result (`.in`, `.out`, scrolling sideways) is scrolled by
// the drag first, here (its own touch scroll would take the gesture away); the row slides only from the end of that
// scroll. A Svelte action on the row; `onswipe` deletes, and a row that comes back from it (nothing deleted) springs
// back.

/** The share of the row's width a drag must reach to delete (or a fling). */
export const SWIPE_SHARE = 0.4;
/** A fling: the finger's speed at the lift (px/ms) in the slide's direction, with the row out at least FLING_MIN_PX. */
export const FLING_SPEED = 0.5;
export const FLING_MIN_PX = 24;
/** The move that decides a drag: across (the row's) or down (the history's). */
const DECIDE_PX = 10;
/** The speed is read over the last moves of this span. */
const SPEED_SPAN_MS = 100;
const OUT_MS = 160;
const BACK_MS = 150;
/** How long after a drag's lift its click is looked for. */
const SWALLOW_MS = 400;

/** True when the row, out by `offset` px of `width` with the finger at `speed` px/ms (+ = right) at the lift, goes. */
export function swipeOut(offset: number, width: number, speed: number): boolean {
  if (offset === 0 || width <= 0) return false;
  if (Math.abs(offset) >= SWIPE_SHARE * width) return true;
  return Math.abs(offset) >= FLING_MIN_PX && Math.sign(speed) === Math.sign(offset) && Math.abs(speed) >= FLING_SPEED;
}

/** One move of the finger by `d` px (+ = right) split between a sideways scroller (at `scroll` of `max`, from the start
 *  edge) and the row (out by `offset`): a row that is out comes back first, then the scroller moves to its end, then the
 *  row slides. A finger going right scrolls towards the start. */
export function share(d: number, scroll: number, max: number, offset: number): { scroll: number; offset: number } {
  let rest = d;
  let off = offset;
  if (off !== 0 && Math.sign(rest) !== Math.sign(off)) {
    const back = Math.sign(rest) * Math.min(Math.abs(rest), Math.abs(off));
    off += back;
    rest -= back;
  }
  let s = scroll;
  if (off === 0 && rest !== 0) {
    s = Math.min(Math.max(scroll - rest, 0), Math.max(max, 0));
    rest += s - scroll;
  }
  return { scroll: s, offset: off + rest };
}

export interface SwipeOptions {
  /** False: the row does not slide (a running row). */
  enabled: boolean;
  /** The row slid out: delete it. A result of false (nothing deleted) springs the row back. */
  onswipe: () => Promise<boolean> | boolean | void;
}

type Phase = "idle" | "wait" | "drag" | "off";

export function rowSwipe(node: HTMLElement, options: SwipeOptions): { update(o: SwipeOptions): void; destroy(): void } {
  let opts = options;
  let phase: Phase = "idle";
  let pointer = -1;
  let x0 = 0;
  let y0 = 0;
  let lastX = 0;
  let offset = 0;
  let scroller: HTMLElement | null = null;
  let moves: { t: number; x: number }[] = [];
  /** A drag ended: the click the browser may send after it (a mouse) is not a tap. */
  let swallow = false;

  const place = (x: number, ms = 0): void => {
    node.style.transition = ms ? `transform ${ms}ms ease-out, opacity ${ms}ms ease-out` : "";
    node.style.transform = x === 0 ? "" : `translateX(${x}px)`;
    node.style.opacity = x === 0 ? "" : String(Math.max(0.3, 1 - Math.abs(x) / Math.max(node.offsetWidth, 1)));
  };
  const reset = (): void => {
    phase = "idle";
    pointer = -1;
    scroller = null;
    moves = [];
  };
  const back = (): void => {
    offset = 0;
    place(0, BACK_MS);
  };

  const down = (e: PointerEvent): void => {
    swallow = false;
    if (!opts.enabled || e.button > 0 || !e.isPrimary || phase === "drag") return;
    phase = "wait";
    pointer = e.pointerId;
    x0 = lastX = e.clientX;
    y0 = e.clientY;
    offset = 0;
    const box = (e.target as Element).closest(".in, .out");
    scroller = box instanceof HTMLElement && node.contains(box) ? box : null;
    moves = [{ t: e.timeStamp, x: e.clientX }];
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId !== pointer || (phase !== "wait" && phase !== "drag")) return;
    if (phase === "wait") {
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < DECIDE_PX) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        phase = "off"; // the history's scroll (docs/05 3.5: vertical wins)
        return;
      }
      phase = "drag";
      try {
        node.setPointerCapture(e.pointerId);
      } catch {
        // (a pointer already gone: the lift or cancel ends the drag)
      }
    }
    const d = e.clientX - lastX;
    lastX = e.clientX;
    const s = scroller;
    const max = s ? s.scrollWidth - s.clientWidth : 0;
    const next = share(d, s ? s.scrollLeft : 0, max, offset);
    if (s && next.scroll !== s.scrollLeft) s.scrollLeft = next.scroll;
    offset = next.offset;
    place(offset);
    moves.push({ t: e.timeStamp, x: e.clientX });
    while (moves.length > 2 && e.timeStamp - moves[0]!.t > SPEED_SPAN_MS) moves.shift();
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    const was = phase;
    const first = moves[0];
    const speed = first && e.timeStamp > first.t ? (e.clientX - first.x) / (e.timeStamp - first.t) : 0;
    reset();
    if (was !== "drag") return;
    swallow = true;
    setTimeout(() => (swallow = false), SWALLOW_MS); // (a touch drag sends no click: the next tap is a tap)
    const width = node.offsetWidth;
    if (!swipeOut(offset, width, speed)) return back();
    const to = Math.sign(offset) * (width + 16);
    place(to, OUT_MS);
    phase = "drag"; // no new drag while it slides out
    setTimeout(() => {
      phase = "idle";
      void Promise.resolve(opts.onswipe()).then(
        (gone) => void (gone === false && back()),
        () => back(),
      );
    }, OUT_MS);
  };
  const cancel = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    const was = phase;
    reset();
    if (was === "drag") back();
  };
  const click = (e: MouseEvent): void => {
    if (!swallow) return;
    swallow = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  };

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("click", click, true);
  return {
    update(o) {
      opts = o;
      if (!o.enabled && phase !== "idle") {
        reset();
        back();
      }
    },
    destroy() {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("click", click, true);
    },
  };
}
