// SPDX-License-Identifier: GPL-3.0-or-later
// R870: Help in the unit view: the active slot's units with their exact sizes, or the units tip on an empty slot, on the generated
// index (`npm run index`; FIND_INDEX=required fails instead of skipping without it). Every expected value is the index's own text
// (`si`, `names`, `dim`) or derived from it here with BigInt; none from memory.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { makeIndex } from "../find/testIndex.ts";
import type { IndexItem } from "../find/types.ts";
import { tipsText } from "../i18n/enTips.ts";
import { unitText } from "../i18n/enUnits.ts";
import { siUnit } from "./dims.ts";
import { factorTable } from "./factors.ts";
import { SlotModel, slotCatalogue, type PadAction } from "./slot.ts";
import { slotHelp } from "./slotHelp.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const raw = (existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : []) as IndexItem[];
const hasIndex = raw.some((it) => it.kind === "unit");
const required = process.env["FIND_INDEX"] === "required";

const src = hasIndex ? { byId: makeIndex(raw).byId, cat: slotCatalogue(raw), table: factorTable(raw) } : undefined;
const item = (id: string): IndexItem => {
  const it = raw.find((x) => x.id === id);
  if (!it) throw new Error(`${id} is not in the index`);
  return it;
};
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
/** n/d to 12 significant digits, rounded half up, for 1E-1 ≤ n/d < 1 (the cases here). */
const twelve = (n: bigint, d: bigint): string => {
  const m = (2n * n * 10n ** 12n + d) / (2n * d);
  return `0.${m.toString().padStart(12, "0")}`;
};
const slot = (...acts: PadAction[]): SlotModel => {
  const m = new SlotModel(src!.cat);
  for (const a of acts) expect(m.apply(a).ok).toBe(true);
  return m;
};
const line = (r: MenuItem | undefined): string => (r ? [r.label, r.hint].filter(Boolean).join(" ") : "");
/** The other name the row writes after the symbol: the first name that is not the symbol (as R869's card writes them). */
const other = (it: IndexItem, sym: string): string => it.names.find((n) => n !== sym && !n.includes("_")) ?? "";

describe.skipIf(!hasIndex && !required)("R870 slotHelp, on the generated index", () => {
  it("has the index (FIND_INDEX=required)", () => expect(hasIndex).toBe(true));

  it("k m ÷ h: the title km/h, the rows km and h, then 1 km/h = 5/18 m/s ≈ 0.277777777778 m/s", () => {
    const km = item("unit:km");
    const h = item("unit:h");
    const help = slotHelp(slot({ do: "prefix", id: "k" }, { do: "unit", id: "m" }, { do: "per" }, { do: "unit", id: "h" }), false, src!);
    expect(help.title).toBe("Help: km/h");
    expect(help.text).toBeUndefined();
    // the rows: R869's value line of each factor ("1 km = 1000 m"), with its hint
    expect(help.items[0]?.label).toBe(`km · ${other(km, "km")}: 1 km = ${km.si} m`);
    expect(help.items[0]?.hint).toBe("exact");
    expect(help.items[1]?.label).toBe(`h · ${other(h, "h")}: 1 h = ${h.si} s`);
    expect(help.items[1]?.hint).toBe("exact");
    // the whole slot: si(km)/si(h), reduced (1000/3600 = 5/18), not a decimal that ends: the fraction and ≈ 12 digits
    const [n, d] = [BigInt(km.si!), BigInt(h.si!)];
    const g = gcd(n, d);
    const si = siUnit("m1s-1").text;
    expect(si).toBe("m/s");
    const total = help.items.at(-1);
    expect(total?.id).toBe("total");
    expect(line(total)).toBe(`1 km/h = ${n / g}/${d / g} ${si} ≈ ${twelve(n / g, d / g)} ${si}`);
    expect(line(total)).toBe("1 km/h = 5/18 m/s ≈ 0.277777777778 m/s");
    expect(help.items.every((r) => r.keep && !r.run)).toBe(true); // each row only informs
  });

  it("kg·m/s²: the whole slot is exactly 1 of the coherent SI unit, as siUnit writes it", () => {
    const help = slotHelp(slot({ do: "unit", id: "kg" }, { do: "unit", id: "m" }, { do: "per" }, { do: "unit", id: "s" }, { do: "power", n: 2 }), false, src!);
    expect(help.title).toBe("Help: kg·m/s²");
    expect(help.items.map((r) => r.id)).toEqual(["f0", "f1", "f2", "total"]);
    for (const id of ["unit:kg", "unit:m", "unit:s"]) expect(item(id).si).toBe("1");
    expect(line(help.items.at(-1))).toBe(`1 kg·m/s² = 1 ${siUnit("kg1m1s-2").text} exact`);
  });

  it("° (deg): π carried, as the index's pi/180, and ≈ 12 digits", () => {
    const deg = item("unit:deg");
    expect(deg.si).toBe("pi/180");
    const help = slotHelp(slot({ do: "unit", id: "deg" }, { do: "per" }, { do: "unit", id: "s" }), false, src!);
    expect(help.title).toBe("Help: °/s");
    expect(help.items[0]?.label).toMatch(/^° · .+: 1° = π\/180 rad$/);
    // π/180 to 12 digits from π's digits (60 of them, so the 12th is sure)
    const PI = 3141592653589793238462643383279502884197169399375105820974944n;
    const scale = 10n ** 60n;
    const m = (2n * PI * 10n ** 13n + 180n * scale) / (2n * 180n * scale); // (π/180)·10^13, half up: 0.0174532925199 has 12 significant digits
    expect(line(help.items.at(-1))).toBe(`1 °/s = π/180 ${siUnit("rad1s-1").text} ≈ 0.0${m} ${siUnit("rad1s-1").text}`);
  });

  it("a squared factor: the power is in the total (km² = 10⁶ m²)", () => {
    const help = slotHelp(slot({ do: "prefix", id: "k" }, { do: "unit", id: "m" }, { do: "power", n: 2 }), false, src!);
    expect(help.title).toBe("Help: km²");
    const n = BigInt(item("unit:km").si!) ** 2n;
    expect(line(help.items.at(-1))).toBe(`1 km² = ${n} m² exact`);
  });

  it("a prefixed pair Find does not hold (M s, marked rare): the prefix's row and the unit's row", () => {
    expect(raw.some((x) => x.id === "unit:Ms")).toBe(false);
    const M = item("pfx:M");
    const help = slotHelp(slot({ do: "prefix", id: "M" }, { do: "unit", id: "s" }), false, src!);
    expect(help.items.map((r) => r.id)).toEqual(["p0", "f0", "total"]);
    expect(help.items[0]?.label).toBe(`M · ${other(M, "M")}: × ${M.si} = 10⁶`);
    expect(help.items[1]?.label).toBe(`s · ${other(item("unit:s"), "s")}: 1 s = 1 s`);
    expect(line(help.items[2])).toBe(`1 Ms = ${M.si} s exact`);
  });

  it("°C alone: R869's offset line is the whole slot in SI", () => {
    const help = slotHelp(slot({ do: "unit", id: "oC" }), false, src!);
    const row = help.items[0];
    expect(row?.label).toMatch(/^°C · .+: °C = K − /);
    expect(help.items.at(-1)?.id).toBe("total");
    expect(help.items.at(-1)?.label).toBe(row?.label.slice(row.label.indexOf(": ") + 2));
  });

  it("a prefix armed alone: the prefix's row only, titled by it", () => {
    const k = item("pfx:k");
    const help = slotHelp(slot({ do: "prefix", id: "k" }), false, src!);
    expect(help.title).toBe("Help: k");
    expect(help.items.map((r) => r.id)).toEqual(["armed"]);
    expect(help.items[0]?.label).toBe(`k · ${other(k, "k")}: × ${k.si} = 10³`);
    expect(help.items[0]?.hint).toBe("exact");
  });

  it("an empty slot: the units tip; the empty end slot: its reading, then the tip", () => {
    const empty = slotHelp(new SlotModel(src!.cat), false, src!);
    expect(empty.items).toEqual([]);
    expect(empty.text).toBe(tipsText("tips.units"));
    expect(empty.title).toBe("Help: unit slot");
    const end = slotHelp(new SlotModel(src!.cat), true, src!);
    expect(end.text).toBe(`${unitText("units.read.endEmpty")}\n\n${tipsText("tips.units")}`);
  });
});
