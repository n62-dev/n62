// SPDX-License-Identifier: GPL-3.0-or-later
// R201: the "Made of" text of the sheet that makes your own unit (views/ownUnitsText.ts): MathLive's LaTeX to plain text,
// the text read as a unit slot of Find ids, and a slot written back. Find's real index (npm run index): m, km, h, s, kg, N.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { slotCatalogue } from "../units/slot.ts";
import { ofText, readOf, unitFrom } from "./ownUnitsText.ts";

const file = join(dirname(fileURLToPath(import.meta.url)), "../find/_gen/find-index.json");
const items: IndexItem[] = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as IndexItem[]) : [];
const it_ = items.some((x) => x.kind === "unit") || process.env["FIND_INDEX"] === "required" ? it : it.skip;
const cat = slotCatalogue(items);

describe("unitFrom: the entry line's LaTeX as text", () => {
  it("keeps plain letters, turns fractions, dots and powers into * / ^", () => {
    expect(unitFrom("m")).toBe("m");
    expect(unitFrom("\\frac{km}{h}")).toBe("km/h");
    expect(unitFrom("kg\\cdot m")).toBe("kg*m");
    expect(unitFrom("kg\\cdot\\frac{m}{s^{2}}")).toBe("kg*m/s^2");
    expect(unitFrom("s^{-1}")).toBe("s^-1");
    expect(unitFrom("\\operatorname{kWh}")).toBe("kWh");
    expect(unitFrom("kg\\ m")).toBe("kg m");
  });
});

describe("readOf and ofText", () => {
  it_("m is one token", () => {
    expect(readOf("m", cat)).toEqual({ ok: true, of: { tokens: [{ unit: "m" }] } });
  });
  it_("km/h: a ÷ after the first factor", () => {
    const r = readOf("km/h", cat);
    expect(r.ok && r.of.per).toBe(1);
    expect(r.ok && r.of.tokens.length).toBe(2);
    expect(r.ok && ofText(r.of)).toMatch(/\/h$/);
  });
  it_("kg*m^2/s^2 reads kg (k and g, as a pick from Find gives it)·m² above and s² below, and writes back as it was read", () => {
    const r = readOf("kg*m^2/s^2", cat);
    expect(r).toEqual({ ok: true, of: { tokens: [{ prefix: "k", unit: "g" }, { unit: "m", power: "2" }, { unit: "s", power: "2" }], per: 2 } });
    expect(r.ok && readOf(ofText(r.of), cat)).toEqual(r);
  });
  it_("1/s is s^-1 with no ÷", () => {
    expect(readOf("1/s", cat)).toEqual({ ok: true, of: { tokens: [{ unit: "s", power: "-1" }] } });
  });
  it_("names the word that is no unit, an empty text, and a power that is no integer", () => {
    expect(readOf("m*zzz", cat)).toEqual({ ok: false, unit: "zzz" });
    expect(readOf("", cat)).toEqual({ ok: false, empty: true });
    expect(readOf("m^x", cat)).toEqual({ ok: false, unit: "m^x" });
    expect(readOf("m^0", cat)).toEqual({ ok: false, unit: "m^0" });
  });
});
