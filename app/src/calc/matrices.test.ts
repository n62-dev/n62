// SPDX-License-Identifier: GPL-3.0-or-later
// R194f1: the matrix sheet's reads carry Home's settings WITH the word (wordStore.home), so the host's useHomeMode sees
// the same mode key as Home's own requests and runs no second mode switch (which would redefine every word op as 64 bits).
import { describe, expect, it } from "vitest";
import { readMatrices } from "./matrices.ts";
import type { MathEngine, HomeSettings } from "../engine/types.ts";
import { wordStore } from "../state/wordStore.svelte.ts";

describe("the matrices request carries the word (R194f1)", () => {
  it("sends word and signed once the word is set, and none before", async () => {
    const seen: HomeSettings[] = [];
    const engine = {
      call: (req: { settings: HomeSettings }) => (seen.push(req.settings), Promise.resolve({ type: "matrices", result: [] })),
    } as unknown as MathEngine;
    const s = { digits: 12, angle: "rad", format: "std" } as const;
    await readMatrices(engine, ["A"], s, false);
    expect(seen[0]).not.toHaveProperty("word");
    wordStore.set({ bits: 8, signed: true });
    await readMatrices(engine, ["A"], s, true);
    expect(seen[1]).toMatchObject({ word: 8, signed: true, digits: 12, angle: "rad" });
  });
});
