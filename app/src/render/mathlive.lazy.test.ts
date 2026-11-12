// SPDX-License-Identifier: GPL-3.0-or-later
// R263: MathLive's door (render/mathlive.svelte.ts) after a failed fetch: the next load runs a new import; a load that
// succeeded is kept. (MathLive itself needs a DOM: a stub module stands in for it.)
import { expect, it, vi } from "vitest";
import { mathlive } from "./mathlive.svelte.ts";

const runs = vi.hoisted(() => ({ n: 0 }));
vi.mock("mathlive", () => {
  if (runs.n++ === 0) throw new TypeError("Failed to fetch dynamically imported module: mathlive");
  return { version: { mathlive: "stub" } };
});

it("mathlive.load: a rejected load is tried again, and the load that succeeded is kept", async () => {
  const first = mathlive.load();
  await expect(first).rejects.toThrow(); // (vitest wraps the factory's TypeError)
  expect(mathlive.mod).toBeUndefined();
  const second = mathlive.load();
  expect(second).not.toBe(first);
  const m = await second;
  expect(m).toHaveProperty("version");
  expect(mathlive.mod).toBe(m);
  expect(mathlive.load()).toBe(second);
  expect(runs.n).toBe(2);
});
