// SPDX-License-Identifier: GPL-3.0-or-later
// R53: results mode for the gallery. Folded by the entry line's swipe (R283: no handle) to the 44 px slice with a row
// picked by a tap (its buttons on the slice's top edge), at the two phone sizes; light and dark come with every shot.
import type { Page } from "@playwright/test";
import { touch } from "../test/helpers.ts";

/** `history`: the gallery's few calculations (gallery.spec.ts someHistory). */
export const foldShots = (history: (p: Page) => Promise<void>): { id: string; group: string; title: string; viewport: { width: number; height: number }; setup: (p: Page) => Promise<void> }[] =>
  ([[360, 740], [412, 839]] as const).flatMap(([width, height]) => [
    {
      id: `fold-picked-${width}`,
      group: "Results mode (R53)",
      title: `Folded to the slice, a row picked by a tap: its buttons on the slice's top edge, at ${width} × ${height}`,
      viewport: { width, height },
      setup: async (p: Page) => {
        await history(p);
        const f = await touch(p, '[data-testid="entry"]'); // the swipe down on the line folds
        await f.move(0, 40, 4);
        await f.end();
        await p.locator('[data-testid="keys"][data-folded="true"]').waitFor();
        await p.locator('[data-testid="result"] .result').nth(1).tap();
        await p.getByTestId("row-actions").waitFor();
        await p.waitForTimeout(250);
      },
    },
  ]);
