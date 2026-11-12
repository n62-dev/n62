// SPDX-License-Identifier: GPL-3.0-or-later
// R277 (owner, 2026-11-10): the entry line under a finger or a pen. A sideways drag scrolls the line and leaves the caret
// and the selection as they were; a tap puts the caret at the touch point, settled to the next stop (R47); a hold
// (HOLD_MS, within the slop) selects the term under the finger (term.ts), and the keys act on it as on any selection
// (R17). A vertical move is R53's swipe (keyboard/foldSwipe.ts, on the line's box): it changes nothing here. A mouse
// keeps MathLive's own click and drag selection. Capture listeners on the field's host (the page element it is in) run
// before MathLive's own (the element's capture listener, which on a touch's lift put the caret a second time: R42, and
// those in its shadow root) and after R53's on the line's box; they end the touch pointerdown there (no app listener
// above the line takes one), so MathLive never sees the touch and the drag no longer selects. The caret and the term come from public calls (`getOffsetFromPoint`,
// `getElementInfo`); the scroll is field.ts's `scrollLine`, our one write into MathLive's shadow DOM (decisions.md
// "R277's line scroll"). Loaded with MathLive.
import type { MathfieldElement } from "mathlive";
import { PLACEHOLDER, atomAfter, depthAt, latexAt } from "./boxes.ts";
import { settle } from "./stops.ts";
import { termAt } from "./term.ts";

/** A finger that moves less than this (CSS px) from where it went down is still a tap or a hold. */
export const SLOP_PX = 8;
export const HOLD_MS = 500;

/** A touch's path past the slop: a sideways drag scrolls the line, any other is no gesture of the line's (R53's swipe). */
export function dragOf(dx: number, dy: number): "scroll" | "none" | undefined {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP_PX) return undefined;
  return Math.abs(dx) >= Math.abs(dy) ? "scroll" : "none";
}

/** `y` moved into the band of the line's own atoms: MathLive reads a point more than 8 px above or below it as the
 *  line's start or end, and the field's box is taller than a line of plain digits. */
function inBand(mf: MathfieldElement, y: number): number {
  let top = Infinity;
  let bottom = -Infinity;
  for (let o = 1; o <= mf.lastOffset; o++) {
    const b = depthAt(mf, o) === 0 ? mf.getElementInfo(o)?.bounds : undefined;
    if (!b) continue;
    top = Math.min(top, b.top);
    bottom = Math.max(bottom, b.bottom);
  }
  return top > bottom ? y : Math.min(bottom, Math.max(top, y));
}

/**
 * MathLive keeps its atoms' bounds from a render to the next pointerdown of its own, which a touch no longer reaches:
 * after a scroll (ours, or its own to follow the caret) they lag the drawn line, and so would a tap's caret. Setting an
 * option again re-renders the line on the next frame with fresh bounds (`setOptions`, mathlive.mjs 0.111.1); the
 * scroll stays. The tap's caret waits for that frame; a hold comes later anyway.
 */
function rerender(mf: MathfieldElement): void {
  mf.minFontScale = mf.minFontScale;
}

/** After the caret or the selection is set: MathLive's focus scrolls the line to its caret, now where the finger is. */
function focus(mf: MathfieldElement): void {
  if (!mf.hasFocus()) mf.focus();
}

/** A tap: the caret where MathLive's own click puts it (a □ at or right after the point is selected), then R47's stop. */
function tap(mf: MathfieldElement, x: number, y: number): void {
  const o = mf.getOffsetFromPoint(x, inBand(mf, y), { bias: 0 });
  if (o < 0) return;
  const next = atomAfter(mf, o);
  if (o > 0 && latexAt(mf, o) === PLACEHOLDER) mf.selection = { ranges: [[o - 1, o]] };
  else if (next > 0 && latexAt(mf, next) === PLACEHOLDER) mf.selection = { ranges: [[o, next]] };
  else {
    mf.position = o;
    settle(mf, "moveToNextChar");
  }
  focus(mf);
}

/** A hold: the term under the finger selected; on empty space or an operator the line stays as it was. */
function hold(mf: MathfieldElement, x: number, y: number): void {
  const r = termAt(mf, x, inBand(mf, y));
  if (!r) return;
  mf.selection = { ranges: [r] };
  focus(mf);
}

/** Listen on `host`, the element the field is in; `scroll(dx)` moves the line's content by dx px (field.ts's scrollLine). */
export function lineTouch(mf: MathfieldElement, host: HTMLElement, scroll: (dx: number) => void): void {
  let t: { id: number; x0: number; y0: number; x: number; mode: "wait" | "scroll" | "none" | "held"; timer: ReturnType<typeof setTimeout> } | undefined;
  const end = (): void => {
    if (t) clearTimeout(t.timer);
    t = undefined;
  };
  const opts = { capture: true };
  host.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target !== mf || (e.pointerType !== "touch" && e.pointerType !== "pen")) return;
      // MathLive never sees this pointer: no caret of its own, no selection by drag, no caret again on the lift
      e.preventDefault();
      e.stopPropagation();
      if (t || !e.isPrimary) return; // a second finger does nothing
      rerender(mf);
      const id = e.pointerId;
      const [x, y] = [e.clientX, e.clientY];
      const timer = setTimeout(() => {
        if (t?.id !== id || t.mode !== "wait") return;
        t.mode = "held";
        hold(mf, x, y);
      }, HOLD_MS);
      t = { id, x0: x, y0: y, x, mode: "wait", timer };
    },
    opts,
  );
  host.addEventListener(
    "pointermove",
    (e) => {
      if (!t || e.pointerId !== t.id) return;
      if (t.mode === "wait") {
        const m = dragOf(e.clientX - t.x0, e.clientY - t.y0);
        if (!m) return;
        clearTimeout(t.timer);
        t.mode = m;
        t.x = e.clientX; // the line follows the finger from here, without a jump of the slop
      } else if (t.mode === "scroll") {
        scroll(t.x - e.clientX);
        t.x = e.clientX;
      }
    },
    opts,
  );
  host.addEventListener(
    "pointerup",
    (e) => {
      if (!t || e.pointerId !== t.id) return;
      if (t.mode === "wait") {
        const [x, y] = [t.x0, t.y0];
        requestAnimationFrame(() => tap(mf, x, y));
      }
      end();
    },
    opts,
  );
  host.addEventListener(
    "pointercancel",
    (e) => {
      if (t && e.pointerId === t.id) end();
    },
    opts,
  );
  // a long press's context menu (Chrome's, on Android) is no menu here: the hold is the line's
  host.addEventListener(
    "contextmenu",
    (e) => {
      if (t) e.preventDefault();
    },
    opts,
  );
}
