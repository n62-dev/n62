// SPDX-License-Identifier: GPL-3.0-or-later
// R263: the parser chunk's doors (input/parser.ts) after a failed fetch: the next call runs a new import (a spent reload
// of state/chunkReload.ts no longer leaves every Enter failing for good); a load that succeeded is kept, run once.
import { expect, it, vi } from "vitest";
import { loadEntry, loadParser } from "./parser.ts";

const runs = vi.hoisted(() => ({ parser: 0, entry: 0 }));
vi.mock("./latex-to-giac.ts", async (actual) => {
  if (runs.parser++ === 0) throw new TypeError("Failed to fetch dynamically imported module: latex-to-giac");
  return await actual();
});
vi.mock("./entry.ts", async (actual) => {
  if (runs.entry++ === 0) throw new TypeError("Failed to fetch dynamically imported module: entry");
  return await actual();
});

it("loadParser: a rejected load is tried again, and the load that succeeded is kept", async () => {
  const first = loadParser();
  await expect(first).rejects.toThrow(); // (vitest wraps the factory's TypeError)
  const second = loadParser();
  expect(second).not.toBe(first);
  await expect(second).resolves.toHaveProperty("latexToGiac");
  expect(loadParser()).toBe(second); // the control: once in, the same promise, no new import
  await loadParser();
  expect(runs.parser).toBe(2);
});

it("loadEntry: the same", async () => {
  const first = loadEntry();
  await expect(first).rejects.toThrow(); // (vitest wraps the factory's TypeError)
  const second = loadEntry();
  expect(second).not.toBe(first);
  await expect(second).resolves.toHaveProperty("giacOfEntry");
  expect(loadEntry()).toBe(second);
  expect(runs.entry).toBe(2);
});
