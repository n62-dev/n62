// SPDX-License-Identifier: GPL-3.0-or-later
// R838f1 (F474): a touch that moves on the keypad (a flick, a trackpad drag) starts no browser scroll. The pad's
// `touch-action: none` keeps the page still, but Chromium still runs the moving touch as a scroll gesture and ends it in a
// fling; the next tap within the fling's time only stops that fling and makes no click (probe, R838f1: a bar tap right after
// a flick, as Shift + Tmpl's flick opening the unit view, got pointerdown … touchend and no click; 1 s later it clicked).
// A cancelled touchmove starts no scroll gesture, so no fling. The pad's own paths are pointer events, which a cancelled
// touchmove leaves alone. Svelte's `ontouchmove` is passive (it cannot cancel), hence the listener here.
// The entry line's swipe does the same for its vertical touches (keyboard/foldSwipe.ts touchMove). Keypad.svelte puts it on
// the pad once the key names are in (keyNames.ts re-exports it): the start chunk is at its pin.

/** Cancel every touchmove on the element that can still be cancelled (none: nothing); the cleanup removes the listener. */
export function noFling(el: HTMLElement | undefined): (() => void) | undefined {
  if (!el) return undefined;
  const stop = (e: TouchEvent): void => void (e.cancelable && e.preventDefault());
  el.addEventListener("touchmove", stop, { passive: false });
  return () => el.removeEventListener("touchmove", stop);
}
