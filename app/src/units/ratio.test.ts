// SPDX-License-Identifier: GPL-3.0-or-later
// G369: the ratio units (%, ‰, ppm, ppb) are defined once, in find/units.yaml `defined:` with `ratio: true`; the index
// carries the flag and the unit view's shown unit reads it (build.ts shownOf). This checks the yaml's rule and that the
// generated index holds the same set, so a ratio added or renamed in the yaml cannot be shown as a product (pptr·m).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { shownUnits } from "./build.ts";
import { factorTable } from "./factors.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const it_ = items.some((i) => i.kind === "unit") || process.env["FIND_INDEX"] === "required" ? it : it.skip;

interface Defined { id: string; si: string; dim: string; ratio?: boolean }
const defined = (parse(readFileSync(join(here, "../../../find/units.yaml"), "utf8")) as { defined: Defined[] }).defined;
const yamlRatios = defined.filter((d) => d.ratio === true).map((d) => d.id).sort();

describe("G369: the ratio units, one definition", () => {
  it("find/units.yaml: the owner's four are ratios, and every pure number with a factor other than 1 is flagged", () => {
    expect(yamlRatios).toEqual(["percent", "permille", "ppb", "ppm"]);
    // rev is a count of cycles (factor 1, G25), not a ratio; any other pure number with a factor is one
    const unflagged = defined.filter((d) => d.dim === "" && d.si !== "1" && d.ratio !== true).map((d) => d.id);
    expect(unflagged).toEqual([]);
    expect(defined.filter((d) => d.ratio === true && d.dim !== "").map((d) => d.id)).toEqual([]);
  });
  it_("the index carries the flag on exactly the yaml's ratios", () => {
    const flagged = items.filter((i) => i.kind === "unit" && i.ratio === true).map((i) => i.id.slice("unit:".length)).sort();
    expect(flagged).toEqual(yamlRatios);
  });
  it_("with the real index each ratio drops out beside a metre: 5 % · 200 m is shown in m", () => {
    const table = factorTable(items);
    for (const id of yamlRatios) {
      const shown = shownUnits({ formula: "", slots: [{ tokens: [{ unit: id }] }, { tokens: [{ unit: "m" }] }] }, table);
      expect(`${id}: ${shown[0]?.text}`).toBe(`${id}: m`);
    }
  });
});
