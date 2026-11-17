// SPDX-License-Identifier: GPL-3.0-or-later
// R53, R724: results mode for the gallery. Folded by the entry line's swipe (R283: no handle) to the 44 px folded bar, with
// and without a row picked by a tap (its buttons in the folded bar), at the two phone sizes; light and dark come with every shot.
import type { Page } from "@playwright/test";
import { touch } from "../test/helpers.ts";

/** `history`: the gallery's few calculations (gallery.spec.ts someHistory). */
export const foldShots = (history: (p: Page) => Promise<void>): { id: string; group: string; title: string; viewport: { width: number; height: number }; setup: (p: Page) => Promise<void> }[] =>
  ([[360, 740], [412, 839]] as const).flatMap(([width, height]) => [
    {
      id: `fold-bar-${width}`,
      group: "Results mode (R53)",
      title: `Folded (R724): the folded bar, ⌃ · Home | CAS · ⇧ α · ☰, no pick, at ${width} × ${height}`,
      viewport: { width, height },
      setup: async (p: Page) => {
        await history(p);
        const f = await touch(p, '[data-testid="entry"]');
        await f.move(0, 40, 4);
        await f.end();
        await p.locator('[data-testid="keys"][data-folded="true"]').waitFor();
        await p.waitForTimeout(250);
      },
    },
    {
      id: `fold-picked-${width}`,
      group: "Results mode (R53)",
      title: `Folded, a row picked by a tap: Store ▶ · Copy › in the folded bar (R724), at ${width} × ${height}`,
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
    {
      id: `fold-store-${width}`,
      group: "Results mode (R53)",
      title: `Folded, a row picked, Store ▶ (R740): "Store in" over the history, the keys stay down, New name… last, at ${width} × ${height}`,
      viewport: { width, height },
      setup: async (p: Page) => {
        await history(p);
        const f = await touch(p, '[data-testid="entry"]');
        await f.move(0, 40, 4);
        await f.end();
        await p.locator('[data-testid="keys"][data-folded="true"]').waitFor();
        await p.locator('[data-testid="result"] .result').nth(1).tap();
        await p.getByTestId("row-actions").getByRole("button", { name: "Store ▶" }).tap();
        await p.getByTestId("store").waitFor();
        await p.waitForTimeout(250);
      },
    },
  ]);
