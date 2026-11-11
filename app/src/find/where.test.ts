// SPDX-License-Identifier: GPL-3.0-or-later
// G230: Find learns where a function sits on the keypad. The generator joins spec/keyboard.yaml (every key's insert, every
// palette cell) to the Find ids and writes `where`: "sin", "Shift sin" for a key layer, "Tmpl" for a palette cell; the
// key names are the key labels' own i18n texts. A unit test of the join, and the generated index checked against it.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs generator module
import { whereMap } from "../../../tools/find-index/where.mjs";
import { legend } from "../i18n/index.ts";
import type { IndexItem } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const yaml = (rel: string): any => parse(readFileSync(join(root, rel), "utf8")); // eslint-disable-line @typescript-eslint/no-explicit-any
const msgs = { "key.shift": "shift", "key.tmpl": "Tmpl", "key.memory": "Mem", "layer.shift": "Shift", "layer.alpha": "Alpha" };
const call = (n: string): string => `\\${n}\\left(#0\\right)`;

/** A small keyboard: sin with its inverse on the Shift layer, a key whose label is an i18n token, the Tmpl palette. */
const mini = {
  keys: [
    { id: "sin", label: { primary: "sin", shift: "sin⁻¹" }, primary: { insert: call("sin") }, shift: { insert: call("arcsin") }, alpha: { type: "G" } },
    { id: "mul", label: { primary: "×" }, primary: { insert: "\\times" }, shift: { insert: "\\mathbin{\\measuredangle}" } },
    { id: "tmpl", label: { primary: "$key.tmpl" }, primary: { special: "tmpl" }, shift: { special: "units" } },
    { id: "sq", label: { primary: "x²", shift: "√" }, primary: { insert: "#@^{2}" }, shift: { insert: "\\sqrt{#0}" } },
  ],
  templates: { items: [{ id: "sqrt", key: "sq", layer: "shift" }, { id: "limit", insert: "\\lim_{#?\\to#?}\\left(#0\\right)" }] },
};
const links = new Map([[call("sin"), "fn:sin"], [call("arcsin"), "fn:asin"], ["\\sqrt{#0}", "fn:sqrt"], ["\\lim_{#?\\to#?}\\left(#0\\right)", "fn:limit"], ["\\times", "fn:times"]]);

describe("whereMap (the join)", () => {
  const w: Map<string, string> = whereMap(mini, msgs, links);

  it("a key's tap is the key's name, a layer is Shift or Alpha in front of it", () => {
    expect(w.get("fn:sin")).toBe("sin");
    expect(w.get("fn:times")).toBe("×");
  });

  it("a key with two functions gives each its own layer", () => {
    expect(w.get("fn:sin")).toBe("sin");
    expect(w.get("fn:asin")).toBe("Shift sin");
  });

  it("a palette cell is the palette key's name through its i18n token; a key's place comes first", () => {
    expect(w.get("fn:limit")).toBe(msgs["key.tmpl"]);
    expect(w.get("fn:sqrt")).toBe("Shift x², Tmpl");
  });

  it("an id with no key has none", () => {
    expect(w.has("fn:sinh")).toBe(false);
    expect([...w.keys()].sort()).toEqual(["fn:asin", "fn:limit", "fn:sin", "fn:sqrt", "fn:times"]);
  });
});

const indexFile = join(here, "_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = items.some((it) => it.kind === "unit");
const byId = new Map(items.map((i) => [i.id, i]));

describe.skipIf(!hasIndex)("the generated index carries where", () => {
  it("every curated function whose insert a key or palette cell makes has a where", () => {
    const kb = yaml("spec/keyboard.yaml");
    const inserts = new Set<string>();
    for (const k of kb.keys) for (const l of ["primary", "shift", "alpha"]) if (k[l]?.insert) inserts.add(k[l].insert);
    for (const p of ["templates", "relations", "symbols"]) for (const c of kb[p].items) if (c.insert) inserts.add(c.insert);
    const curated = (yaml("find/functions.yaml").functions as { id: string; insert?: string }[]).filter((f) => f.insert && inserts.has(f.insert));
    expect(curated.length).toBeGreaterThanOrEqual(8);
    expect(curated.filter((f) => !byId.get(f.id)?.where).map((f) => f.id)).toEqual([]);
  });

  it("the keys' own layers: sin and its inverse, eˣ on the ln key", () => {
    expect(byId.get("fn:sin")?.where).toBe("sin");
    expect(byId.get("fn:asin")?.where).toBe("Shift sin");
    expect(byId.get("fn:exp")?.where).toBe("Shift ln");
    expect(byId.get("fn:sqrt")?.where).toBe("Shift x², Tmpl");
  });

  it("palette functions name the key that opens the palette, through the label's i18n token", () => {
    expect(byId.get("fn:limit")?.where).toBe(legend("$key.tmpl"));
    expect(byId.get("fn:and")?.where).toBe("Shift 6");
  });

  it("a Find id with no key has none", () => {
    for (const id of ["fn:sinh", "fn:cosh", "fn:tanh", "tmpl:cbrt", "fn:det", "const:c", "unit:km"]) expect(byId.get(id)?.where, id).toBeUndefined();
  });

  it("only functions carry one, and every one is a place on the keypad", () => {
    const withWhere = items.filter((i) => i.where !== undefined);
    expect(withWhere.length).toBeGreaterThanOrEqual(10);
    for (const it of withWhere) expect(["fn", "tmpl"], it.id).toContain(it.kind);
  });
});
