// SPDX-License-Identifier: GPL-3.0-or-later
import { vibrate } from "../input/haptics.ts";
import { rowText } from "../i18n/enRows.ts";
import "./swipeStrip.css";
// R276, R743: a swipe left on a history row deletes it (docs/05 3.5): the row follows the finger over a red strip that grows
// with it (`.swipe-del`, drawn here in the row, `--swipe-x` on it), armed at 40 % of its width, and slides out then or on a
// fling, else it springs back. A swipe right does nothing: the row only gives a little (`rubber`), and springs back. The history's vertical scroll wins: the row is `touch-action:
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

/** The most a drag to the right moves the row (px): right is reserved, it does nothing. */
const RUBBER_MAX = 24;
const RUBBER_SCALE = 48;

/** How far the row follows a finger that is `x` px (> 0) to the right of where it started: a band that gives a little and
 *  stays under RUBBER_MAX. */
export function rubber(x: number): number {
  return x <= 0 ? 0 : RUBBER_MAX * (1 - Math.exp(-x / RUBBER_SCALE));
}

/** True when the row, out by `offset` px of `width` with the finger at `speed` px/ms (+ = right) at the lift, goes: only a
 *  row out to the left (offset < 0) does (R743). */
export function swipeOut(offset: number, width: number, speed: number): boolean {
  if (offset >= 0 || width <= 0) return false;
  if (-offset >= SWIPE_SHARE * width) return true;
  return -offset >= FLING_MIN_PX && speed < 0 && -speed >= FLING_SPEED;
}

/** One move of the finger by `d` px (+ = right) split between a sideways scroller (at `scroll` of `max`, from the start
 *  edge) and the row (out by `offset`): a row that is out comes back first, then the scroller moves to its end, then the
 *  row slides. A finger going right scrolls towards the start. The scroller has room in the move's direction (max minus
 *  the start position going left, the start position going right): 1 px of it or more and the move scrolls and the rest
 *  past the end is dropped, even when this one move is under 1 px (a slow drag, fractional clientX; R333f1). Under 1 px
 *  the scroller is at its end and the rest slides the row, unless the drag had scrolled (`moved`): only a new drag
 *  slides the row then (R333). `scrolled` answers whether this drag has moved the scroller, for the next move. */
export function share(d: number, scroll: number, max: number, offset: number, moved = false): { scroll: number; offset: number; scrolled: boolean } {
  let rest = d;
  let off = offset;
  let scrolled = moved;
  if (off !== 0 && Math.sign(rest) !== Math.sign(off)) {
    const back = Math.sign(rest) * Math.min(Math.abs(rest), Math.abs(off));
    off += back;
    rest -= back;
  }
  // (`scrollLeft` can be fractional past the integer `max`: a scroller at its true end counts as at `max`)
  const top = Math.max(max, 0);
  const from = Math.min(Math.max(scroll, 0), top);
  let s = from;
  if (off === 0 && rest !== 0) {
    s = Math.min(Math.max(from - rest, 0), top);
    const room = rest < 0 ? top - from : from;
    if (room >= 1) scrolled = true;
    if (scrolled) rest = 0;
  }
  return { scroll: s, offset: off + rest, scrolled };
}

export interface SwipeOptions {
  /** False: the row does not slide (a running row). */
  enabled: boolean;
  /** The row slid out: delete it. A result of false (nothing deleted) springs the row back. */
  onswipe: () => Promise<boolean> | boolean | void;
}

/** "arm": the drag went past SWIPE_SHARE to the left: one 10 ms key pulse when Key vibration is on. "right": a drag to the
 *  right was lifted with the row given at least DECIDE_PX (it does nothing): counted as `swipe.right` (R70). "left": a swipe
 *  left deleted the row: counted as `swipe.left` (R832; one that springs back counts nothing). Read from the app's session, so
 *  the start chunk, which is pinned, carries none of it. */
function note(what: "arm" | "right" | "left"): void {
  const session = window.n62?.session;
  if (!session) return;
  if (what !== "arm") void session.uses().then((c) => c.count(`swipe.${what}`));
  else if (session.settings.haptics.on) vibrate(session.settings.haptics.strength / 100, 10);
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
  /** This drag has moved the scroller (R333): the row stays at 0 for the rest of it. */
  let scrolled = false;
  let moves: { t: number; x: number }[] = [];
  /** A drag ended: the click the browser may send after it (a mouse) is not a tap. */
  let swallow = false;
  /** The drag is past SWIPE_SHARE to the left. */
  let armed = false;
  /** The strip, in the row just past its right edge (swipeStrip.css; its width is the row's `--swipe-x`). Drawn here, with the
   *  gesture's chunk, not by History.svelte: the start chunk is pinned. */
  const strip = document.createElement("div");
  const label = document.createElement("span");
  label.textContent = rowText("history.swipeDelete");
  strip.className = "swipe-del";
  strip.dataset["testid"] = "swipe-del";
  strip.setAttribute("aria-hidden", "true");
  strip.append(label);
  node.append(strip);

  /** The row at `x` px (+ = right; to the right it is the rubber band): the strip's width follows it (`--swipe-x`), over `ms`. */
  const place = (x: number, ms = 0): void => {
    const shown = x > 0 ? rubber(x) : x;
    node.style.transition = ms ? `transform ${ms}ms ease-out` : "";
    node.style.transform = x === 0 ? "" : `translateX(${shown}px)`;
    strip.style.transition = ms ? `width ${ms}ms ease-out` : "";
    node.style.setProperty("--swipe-x", `${Math.min(shown, 0)}px`);
  };
  const arm = (on: boolean): void => {
    if (on === armed) return;
    armed = on;
    if (on) strip.setAttribute("data-armed", "true");
    else strip.removeAttribute("data-armed");
    if (on) note("arm");
  };
  const reset = (): void => {
    phase = "idle";
    pointer = -1;
    scroller = null;
    moves = [];
  };
  const back = (): void => {
    offset = 0;
    arm(false);
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
    scrolled = false;
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
    const next = share(d, s ? s.scrollLeft : 0, max, offset, scrolled);
    if (s && next.scroll !== s.scrollLeft) s.scrollLeft = next.scroll;
    scrolled = next.scrolled;
    offset = next.offset;
    place(offset);
    arm(offset < 0 && -offset >= SWIPE_SHARE * node.offsetWidth);
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
    if (!swipeOut(offset, width, speed)) {
      if (offset >= DECIDE_PX) note("right");
      return back();
    }
    const to = -(width + 16);
    place(to, OUT_MS);
    phase = "drag"; // no new drag while it slides out
    setTimeout(() => {
      phase = "idle";
      void Promise.resolve(opts.onswipe()).then(
        (gone) => (gone === false ? back() : note("left")),
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
      strip.remove();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("click", click, true);
    },
  };
}
