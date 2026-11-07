// SPDX-License-Identifier: GPL-3.0-or-later
// R162: the key pop while a finger is down (never lifted), on a digit, on sin and on a top-row key (Esc), for the gallery.
import type { Page } from "@playwright/test";

export const popShots = (): { id: string; group: string; title: string; setup: (p: Page) => Promise<void> }[] =>
  (["d7", "sin", "esc"] as const).map((id) => ({
    id: `keypop-${id}`,
    group: "The key pop (R162)",
    title: `The key pop: a finger down on ${id}`,
    setup: async (p: Page) => {
      await p.evaluate((id) => {
        const el = document.querySelector<HTMLElement>(`.pad [data-key="${id}"]`) as HTMLElement;
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "touch", isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      }, id);
      await p.getByTestId("key-pop").waitFor();
    },
  }));
