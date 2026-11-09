// SPDX-License-Identifier: GPL-3.0-or-later
// R148 (F186): Solve's Num view keeps its roots above the entry line. c45 (x²−5x+6 = 0) at the Tab One's 1192 × 672:
// the second root's box ended 1 px above the entry line on the device (devices 84, 85); it must end at least 12 px above.
import { expect, test } from "@playwright/test";
import { loadCore, replay, start } from "./core-lib.ts";

const c45 = loadCore().find((c) => c.id === "c45");

test("c45 at 1192 × 672: Solve's second root ends at least 12 px above the entry line", async ({ browser }) => {
  if (!c45) throw new Error("c45 is not in core.yaml");
  const ctx = await browser.newContext({ viewport: { width: 1192, height: 672 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await start(page);
    await replay(page, c45.keys);
    const roots = page.locator('[data-testid="solve-roots"] li');
    await expect(roots).toHaveCount(2);
    const m = await page.evaluate(() => {
      const li = [...document.querySelectorAll('[data-testid="solve-roots"] li')].at(-1)?.getBoundingClientRect();
      const entry = document.querySelector(".entry")?.getBoundingClientRect();
      return { rootBottom: li?.bottom ?? 0, entryTop: entry?.top ?? 0 };
    });
    console.log(`c45 at 1192 × 672: root bottom ${m.rootBottom.toFixed(1)}, entry top ${m.entryTop.toFixed(1)}, clear ${(m.entryTop - m.rootBottom).toFixed(1)} px`);
    expect(m.entryTop - m.rootBottom).toBeGreaterThanOrEqual(12);
  } finally {
    await ctx.close();
  }
});
