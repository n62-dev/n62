// SPDX-License-Identifier: GPL-3.0-or-later
// R24b: the unit pad's switch, loaded with the unit view (never in the start chunk). The pad is up while
// `sheetChunk.pad` holds its cells (views/sheetView.svelte.ts: the state the keypad already reads for the sheet's keys):
// Keypad.svelte draws the keys through it, keyboard/route.ts hands it a press and `on` the result, and `other` the keys
// that are no cell. The unit view (units/open.ts, R24c) sets them; `?pad=1` (dev only, main.ts) shows the pad alone.
import { tick, untrack } from "svelte";
import type { AppShell } from "../apps/shell.svelte.ts";
import { fitLegends } from "../keyboard/fit.ts";
import { sheetChunk } from "../views/sheetView.svelte.ts";
import type { Key } from "../keyboard/keyboard.ts";
import type { Mods, RouteCtx } from "../keyboard/route.ts";
import type { PadEmit, UnitPad } from "./pad.ts";

export const unitPad: {
  model: UnitPad | null;
  on: (e: PadEmit) => void;
  /** R24c: a key that is no cell while the pad is up (◀ ▶, Esc, the place keys): the unit view's; true when it took it. */
  other?: ((c: RouteCtx, key: Key, mods: Mods) => boolean) | undefined;
  log?: PadEmit[];
} = {
  get model() {
    return sheetChunk.pad;
  },
  set model(m: UnitPad | null) {
    sheetChunk.pad = m;
    // the faces and legends change with it: fit them again once drawn (Keypad.svelte re-fits on its own for Shift and Alpha)
    void tick().then(() => {
      const pad = document.querySelector<HTMLElement>(".pad");
      if (pad) fitLegends(pad);
    });
  },
  on: () => {},
};

/** R838: `closed` runs when the last sheet over the unit view goes (Settings, Mode, Find on units: Esc, Back, ×, a pick that
 *  closes it; a sheet that gives way to another in the same update is no close). R915: and each time `read` gives another
 *  value (the angle unit and the digits), whoever changed them: the bar's angle word, a sheet, an Undo. Returns the stop. */
export function watchSheet(shell: AppShell, read: () => string, closed: () => void): () => void {
  let open = false;
  let last: string | undefined;
  return $effect.root(() => {
    $effect(() => {
      const now = shell.sheet !== null;
      const v = read();
      if ((open && !now) || (last !== undefined && v !== last)) untrack(closed);
      open = now;
      last = v;
    });
  });
}

/** Load the pad and show it on the keys. */
export async function showUnitPad(): Promise<void> {
  const m = await import("./pad.ts");
  unitPad.model = new m.UnitPad();
}

/** The dev switch (`?pad=1`): the pad is up and every press is logged (window.n62.unitPad.log). */
export function devPad(): void {
  unitPad.log = [];
  unitPad.on = (e) => void unitPad.log?.push(e);
  void showUnitPad();
}
