// SPDX-License-Identifier: GPL-3.0-or-later
// G356 (night review 2026-11-14, fh-1): "interpolate" no longer leads to Giac's lagrange, the polynomial through every point
// (11 table points at 0.9 give 1.57868351364, above every y; tests/golden/home.yaml g356-*). find/aliases.yaml gives it no
// such alias, and its row says what it is (find/functions.yaml notes). The table interpolation is G361's. The index part
// needs the generated index (`npm run index`); skipped without it unless FIND_INDEX=required.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "_gen/find-index.json");
const required = process.env.FIND_INDEX === "required";
const aliases = parse(readFileSync(join(here, "../../../find/aliases.yaml"), "utf8")) as { aliases: Record<string, string[]> };
const WHAT = "the polynomial through every point (not a table lookup)";

describe("G356: lagrange is not a table interpolation", () => {
  it("find/aliases.yaml gives fn:lagrange no interpolate or interpolation", () => {
    const names = (aliases.aliases["fn:lagrange"] ?? []).map((n) => n.toLowerCase());
    expect(names.filter((n) => n.startsWith("interpol"))).toEqual([]);
  });

  describe.skipIf(!existsSync(indexFile) && !required)("in the index", () => {
    const items = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
    const lagrange = items.find((it) => it.id === "fn:lagrange");

    it("keeps fn:lagrange, named lagrange, without the interpolate names", () => {
      expect(lagrange?.names).toContain("lagrange");
      expect((lagrange?.names ?? []).filter((n) => n.toLowerCase().startsWith("interpol"))).toEqual([]);
    });

    it("says in its title and its line what it is", () => {
      expect(lagrange?.title.toLowerCase()).toContain(WHAT);
      expect(lagrange?.desc?.toLowerCase()).toContain(WHAT);
    });
  });
});
