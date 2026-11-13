// SPDX-License-Identifier: GPL-3.0-or-later
// R224f1: the wide layout's condition is written twice (WIDE_QUERY in views/wide.ts, read through matchMedia by canFold,
// and the `@media` block in App.svelte, which cannot read the constant). Edit one alone and a window between the two
// widths would fold the keypad while side by side, or show the column layout with no results mode.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WIDE_QUERY } from "./wide.ts";

const app = readFileSync(new URL("../App.svelte", import.meta.url), "utf8");

describe("the wide layout's condition", () => {
  it("is the same in App.svelte's @media block as WIDE_QUERY in views/wide.ts", () => {
    const blocks = [...app.matchAll(/@media\s+([^{]*orientation\s*:\s*landscape[^{]*)\{/g)].map((m) => m[1]!.trim().replace(/\s+/g, " "));
    expect(blocks, "App.svelte must hold exactly one @media block with orientation: landscape (the wide layout)").toHaveLength(1);
    expect(
      blocks[0],
      "the @media condition in app/src/App.svelte differs from WIDE_QUERY in app/src/views/wide.ts: change both together",
    ).toBe(WIDE_QUERY);
  });
});
