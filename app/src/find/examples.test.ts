// SPDX-License-Identifier: GPL-3.0-or-later
// G231: every tier-0 Find function has one example (`example: { input, expect }` in find/functions.yaml, our own words). `input`
// is the LaTeX the entry line holds. The engine test runs each through Home with our parser, as a user's keys would, and the
// shown result must be `expect`, in RAD and in DEG unless the example says `angle`; the generated index carries both.
// An example we show must be true.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import { runHomeCase } from "../goldenRun.ts";
import type { IndexItem } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Example { input?: string; expect?: string; angle?: "rad" | "deg" }
interface Curated { id: string; example?: Example }
const curated = (parse(readFileSync(join(here, "../../../find/functions.yaml"), "utf8")) as { functions: Curated[] }).functions;

describe("the tier-0 examples (find/functions.yaml)", () => {
  it("every tier-0 function has an example with an input and an expected result", () => {
    expect(curated.filter((f) => !f.example?.input || !f.example.expect).map((f) => f.id)).toEqual([]);
  });

  it("no two functions share an example input", () => {
    const seen = curated.flatMap((f) => (f.example?.input ? [f.example.input] : []));
    expect(seen.filter((x, i) => seen.indexOf(x) !== i)).toEqual([]);
  });

  it.skipIf(!giacAvailable())("each example gives its stated result in Home", async () => {
    const host = await nodeHost();
    const fresh = nodeHost;
    const wrong: string[] = [];
    for (const f of curated) {
      if (!f.example?.input) continue;
      for (const angle of f.example.angle ? [f.example.angle] : (["rad", "deg"] as const)) {
        const r = await runHomeCase({ id: f.id, latex: f.example.input, settings: { angle } }, host, fresh);
        const shown = r.ok ? r.display : `error: ${r.display}`;
        if (shown !== f.example.expect) wrong.push(`${f.id} (${angle}): ${f.example.input} gave ${shown}, expected ${f.example.expect}`);
      }
    }
    expect(wrong).toEqual([]);
  }, 300_000);
});

const indexFile = join(here, "_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];

describe.skipIf(!items.some((it) => it.kind === "unit"))("the generated index carries the examples", () => {
  it("a tier-0 function has its example and result; tier 1 has none (Giac's help stays Giac's)", () => {
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const f of curated) {
      expect(byId.get(f.id)?.example, f.id).toBe(f.example?.input);
      expect(byId.get(f.id)?.exampleResult, f.id).toBe(f.example?.expect);
      expect(byId.get(f.id)?.exampleAngle, f.id).toBe(f.example?.angle);
    }
    expect(items.filter((i) => i.tier === 1 && (i.example || i.exampleResult || i.exampleAngle)).length).toBe(0);
  });
});
