// SPDX-License-Identifier: GPL-3.0-or-later
// R815: a hold on a sheet row runs the row's `copy` (apps/types.ts MenuItem): a Svelte action that attaches the hold (apps/longpress.ts, in
// the gestures' chunk, rowGestures.ts) only while the row has one, so a list of Find rows carries no listener it never uses.
import { rowHold } from "./rowGestures.ts";

type Run = (() => void) | undefined;

export function sheetHold(node: HTMLElement, run: Run): { update(r: Run): void; destroy(): void } {
  let now = run;
  const hold = (): void => now?.();
  let inner = run ? rowHold(node, hold) : undefined;
  return {
    update(r) {
      now = r;
      if (r && !inner) inner = rowHold(node, hold);
      else if (!r && inner) (inner.destroy(), (inner = undefined));
    },
    destroy: () => inner?.destroy(),
  };
}
