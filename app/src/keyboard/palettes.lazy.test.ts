// SPDX-License-Identifier: GPL-3.0-or-later
// R263: the Shift palettes' door (keyboard/palettes.ts) after a failed fetch: the next Shift + 6, Shift + 9 or Tmpl runs
// a new import instead of the kept rejection; a load that succeeded is kept.
import { expect, it, vi } from "vitest";
import * as palettes from "./palettes.ts";

const runs = vi.hoisted(() => ({ n: 0 }));
vi.mock("./shiftPalettes.ts", async (actual) => {
  if (runs.n++ === 0) throw new TypeError("Failed to fetch dynamically imported module: shiftPalettes");
  return await actual();
});

it("loadShiftPalettes: a rejected load is tried again, and the load that succeeded is kept", async () => {
  const first = palettes.loadShiftPalettes();
  await expect(first).rejects.toThrow(); // (vitest wraps the factory's TypeError)
  expect(palettes.shiftPalettes).toBeUndefined();
  const second = palettes.loadShiftPalettes();
  expect(second).not.toBe(first);
  const m = await second;
  expect(m).toHaveProperty("relations");
  expect(palettes.shiftPalettes).toBe(m);
  expect(palettes.loadShiftPalettes()).toBe(second);
  expect(runs.n).toBe(2);
});
