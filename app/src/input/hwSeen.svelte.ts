// SPDX-License-Identifier: GPL-3.0-or-later
// R783: whether a hardware keyboard is in use now. A physical key (a trusted keydown) turns it on, a touch on a keypad key
// turns it off. While it is on, the bar shows the ⇧ α badge with the keys up too (views/StatusLine.svelte): with a keyboard
// the fingers are off the keys, which then do not show Shift's or Alpha's state under a thumb.

export const hw = $state({ keys: false });

/** Listen on the window (capture, so MathLive's own handling cannot hide a key); returns the remover. */
export function watchHw(): () => void {
  const on = (e: KeyboardEvent): void => {
    if (e.isTrusted) hw.keys = true;
  };
  const off = (e: PointerEvent): void => {
    // (a touch on the badge itself must not take it from under the finger: only a key's touch counts)
    if (e.pointerType === "touch" && (e.target as Element | null)?.closest?.("[data-key]")) hw.keys = false;
  };
  addEventListener("keydown", on, true);
  addEventListener("pointerdown", off, true);
  return () => {
    removeEventListener("keydown", on, true);
    removeEventListener("pointerdown", off, true);
  };
}
