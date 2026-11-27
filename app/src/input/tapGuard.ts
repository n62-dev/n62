// SPDX-License-Identifier: GPL-3.0-or-later
// R918, R921f1 (docs/04 5.5, the layer contract: a layer over Home refuses a tap by default): while a layer that lends Home's
// line is up (the unit view, units/open.ts; a name prompt, askName in views/presetsView.svelte.ts), a tap on the screen outside
// its own box is the dead press, unless THROUGH lets it on: no pick, no row bar, nothing on the line. A hold on a row copies as
// before (its copy came with the timer, apps/longpress.ts); its click is swallowed with no pulse. The pads and the bars are not
// the screen: they keep their own paths. No dependency but the hold's time.
import { LONG_PRESS_MS } from "../apps/longpress.ts";

/** What a tap on the screen outside the layer's box still reaches; none of these writes the line: the undo note (R98), a running
 *  row's Cancel, the engine's Reload and the update's Restart. */
export const THROUGH = '[data-testid="undo-note"], .history .cancel, [data-testid="engine-reload"], [data-testid="update-note"]';

/** Guard the screen's taps while `up()` holds: outside `own` (and THROUGH) a click is swallowed in the capture phase and `dead`
 *  pulses (not after a hold). `then` runs after every tap on the screen while up, `refused` true for a swallowed one, `held`
 *  true for the click that ends a hold (R797: the hold copied). Returns the guard's removal. */
export function guardTaps(own: Element, dead: () => void, up: () => boolean, then?: (ev: MouseEvent, refused: boolean, held: boolean) => void): () => void {
  /** When the last press on the page went down (a click that long after it ends a hold, which copied). */
  let downAt = 0;
  const down = (ev: PointerEvent): void => void (downAt = ev.timeStamp);
  const tapped = (ev: MouseEvent): void => {
    if (!up()) return;
    if (!(ev.target instanceof Element) || !ev.target.closest(".screen")) return; // (the pads and bars keep their own paths)
    const refused = !own.contains(ev.target) && !ev.target.closest(THROUGH);
    const held = ev.timeStamp - downAt >= LONG_PRESS_MS;
    if (refused) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      if (!held) dead();
    }
    then?.(ev, refused, held);
  };
  document.addEventListener("pointerdown", down, { capture: true });
  document.addEventListener("click", tapped, { capture: true });
  return () => {
    document.removeEventListener("pointerdown", down, { capture: true });
    document.removeEventListener("click", tapped, { capture: true });
  };
}
