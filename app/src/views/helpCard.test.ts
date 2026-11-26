// SPDX-License-Identifier: GPL-3.0-or-later
// R869: the help card of a unit, prefix or constant, on the generated index (`npm run index`; FIND_INDEX=required fails instead of
// skipping without it). Every expected value is the index's own text or derived from it here (the `si` fraction, the units menu's
// category); none from memory.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { unitNote } from "../find/finder.ts";
import type { FindItem, IndexItem } from "../find/types.ts";
import { siUnit } from "../units/dims.ts";
import { approx, cardRows, exactDecimal } from "./helpCard.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const items = (existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : []) as IndexItem[];
const hasIndex = items.some((it) => it.kind === "unit");
const menu = parse(readFileSync(join(here, "../../../spec/units-menu.yaml"), "utf8")) as { categories: { name: string; dims: string[] }[] };

const item = (id: string): FindItem => {
  const it = items.find((x) => x.id === id);
  if (!it) throw new Error(`${id} is not in the index`);
  return { ...it, insert: it.insert ?? "" };
};
const card = (id: string): MenuItem[] => cardRows(item(id)) ?? [];
const rowOf = (id: string, row: string): MenuItem | undefined => card(id).find((r) => r.id === row);

const big = (s: string): bigint => BigInt(s);
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
/** The reduced p/q of an `si` with only integers and one `/`; undefined for any other form. */
const fraction = (si: string): [bigint, bigint] | undefined => {
  const m = /^(\d+)(?:\/(\d+))?$/.exec(si);
  if (!m) return undefined;
  const [n, d] = [big(m[1] as string), big(m[2] ?? "1")];
  const g = gcd(n, d);
  return [n / g, d / g];
};
/** Whether p/q's decimal ends within 30 digits: q = 2^a·5^b with max(a, b) ≤ 30. */
const ends = (d: bigint): boolean => {
  let [q, a, b] = [d, 0, 0];
  while (q % 2n === 0n) (q /= 2n), a++;
  while (q % 5n === 0n) (q /= 5n), b++;
  return q === 1n && Math.max(a, b) <= 30;
};
/** The ≈ text's number and its significant digits. */
const approxOf = (hint: string | undefined): { value: number; sig: number } => {
  const m = /^≈ (\S+)/.exec(hint ?? "");
  const t = m?.[1] ?? "NaN";
  return { value: Number(t), sig: t.replace(/E.*$/, "").replace(/[-.]/g, "").replace(/^0+/, "").length };
};

describe.skipIf(!hasIndex)("R869: the help card from the Find index", () => {
  it("unit:ft: its names, the quantity from the units menu, the exact value in m", () => {
    const ft = item("unit:ft");
    const cat = menu.categories.find((c) => c.dims.includes(ft.dim ?? ""));
    expect(cat?.name).toBe("Length");
    const [n, d] = fraction(ft.si ?? "") ?? [0n, 1n];
    expect(rowOf("unit:ft", "names")?.label).toBe(`ft · ${ft.names.filter((x) => x !== "ft").join(", ")}`);
    expect(rowOf("unit:ft", "quantity")?.label).toBe("Length");
    expect(rowOf("unit:ft", "value")?.label).toBe(`1 ft = ${Number(n) / Number(d)} ${siUnit(ft.dim ?? "").text}`);
    expect(rowOf("unit:ft", "value")?.label).toBe("1 ft = 0.3048 m");
    expect(rowOf("unit:ft", "value")?.hint).toBe("exact");
    expect(card("unit:ft").every((r) => r.keep === true)).toBe(true);
  });

  it("a unit whose decimal does not end within 30 digits: = p/q, then ≈ with 12 digits", () => {
    const it0 = items.find((x) => x.kind === "unit" && x.tier === 0 && x.si !== undefined && fraction(x.si) && !ends((fraction(x.si) as [bigint, bigint])[1]));
    expect(it0).toBeDefined();
    const [n, d] = fraction(it0?.si ?? "") ?? [0n, 1n];
    const value = rowOf(it0?.id ?? "", "value");
    expect(value?.label).toContain(` = ${n}/${d} ${siUnit(it0?.dim ?? "").text}`);
    const a = approxOf(value?.hint);
    expect(a.sig).toBeLessThanOrEqual(12);
    expect(Math.abs(a.value / (Number(n) / Number(d)) - 1)).toBeLessThan(1e-11);
  });

  it("a unit with π in si (the degree): π/180 rad, then ≈ with 12 digits", () => {
    const deg = item("unit:deg");
    expect(deg.si).toBe("pi/180");
    expect(rowOf("unit:deg", "value")?.label).toBe("1° = π/180 rad");
    expect(rowOf("unit:deg", "value")?.hint).toBe(`≈ ${(Math.PI / 180).toPrecision(12)} rad`);
    expect(rowOf("unit:deg", "quantity")?.label).toBe("Angle");
  });

  it("°C and °F: the offset scale's formula and the size of a difference", () => {
    const c = item("unit:oC");
    const [k, off] = (c.si ?? "").split("+");
    expect(k).toBe("1");
    const [n, d] = fraction(off ?? "") ?? [0n, 1n];
    expect(rowOf("unit:oC", "value")?.label).toBe(`°C = K − ${Number(n) / Number(d)}`);
    expect(rowOf("unit:oC", "value")?.label).toBe("°C = K − 273.15");
    expect(rowOf("unit:oC", "value")?.hint).toBe("a difference of 1 °C is 1 K");
    // °F: K = a·x + b, so x = K/a − b/a (a = 5/9, b/a = 459.67 from the index's fractions)
    const [fa, fb] = (item("unit:oF").si ?? "").split("+").map((x) => fraction(x) ?? [0n, 1n]) as [[bigint, bigint], [bigint, bigint]];
    expect(rowOf("unit:oF", "value")?.label).toBe(`°F = ${Number(fa[1]) / Number(fa[0])}·K − ${Number(fb[0] * fa[1]) / Number(fb[1] * fa[0])}`);
    expect(rowOf("unit:oF", "value")?.hint).toBe(`a difference of 1 °F is ${fa[0]}/${fa[1]} K`);
  });

  it("pfx:k: kilo, × 1000 = 10³, exact; a binary prefix as a power of 2", () => {
    const k = item("pfx:k");
    expect(rowOf("pfx:k", "names")?.label).toBe("k · kilo");
    expect(rowOf("pfx:k", "value")?.label).toBe(`× ${k.si} = 10³`);
    expect(rowOf("pfx:k", "value")?.hint).toBe("exact");
    expect(rowOf("pfx:m", "value")?.label).toBe(`× ${1 / Number((item("pfx:m").si ?? "").split("/")[1])} = 10⁻³`);
    expect(rowOf("pfx:Ki", "value")?.label).toBe(`× ${item("pfx:Ki").si} = 2¹⁰`);
  });

  it("const:c is exact (SI definition); G is the index's value ± unc with CODATA; h is in J·s (G801)", () => {
    const c = item("const:c");
    expect(c.unc).toBeUndefined();
    expect(rowOf("const:c", "names")?.label).toMatch(/^c · /);
    expect(rowOf("const:c", "value")?.label).toBe(`${c.value} m/s`);
    expect(rowOf("const:c", "value")?.hint).toBe("exact (SI definition)");
    const g = item("const:G");
    expect(g.unc).toBeDefined();
    expect(rowOf("const:G", "value")?.label).toBe(`${g.value} ± ${g.unc} m³/(kg·s²)`);
    expect(rowOf("const:G", "value")?.hint).toBe("CODATA");
    const h = item("const:planck");
    expect(h.ownUnit).toBe("J*s");
    expect(rowOf("const:planck", "value")?.label).toBe(`${h.value} J·s`);
    expect(rowOf("const:planck", "names")?.label).toMatch(/^h · /);
  });

  it("a unit without si says unitNote's words; a tier-1 unit says not checked", () => {
    for (const id of ["unit:dB", "unit:Ha"]) {
      const it0 = item(id);
      expect(it0.si).toBeUndefined();
      expect(rowOf(id, "value")?.label).toBe(unitNote(it0));
    }
    expect(rowOf("unit:dB", "value")?.label).toBe("converts only");
    const t1 = items.find((x) => x.kind === "unit" && x.tier === 1);
    expect(t1 && rowOf(t1.id, "tier")?.label).toBe("not checked");
    expect(cardRows(item("fn:sin"))).toBeUndefined(); // a function's help is R197's rows
  });
});

describe("R869: the card's numbers", () => {
  it("exactDecimal: an ending decimal within 30 digits, else none", () => {
    expect(exactDecimal(381n, 1250n)).toBe("0.3048");
    expect(exactDecimal(5463n, 20n)).toBe("273.15");
    expect(exactDecimal(1n, 3n)).toBeUndefined();
    expect(exactDecimal(1n, 10n ** 30n)).toBe(`0.${"0".repeat(29)}1`);
    expect(exactDecimal(1n, 10n ** 31n)).toBeUndefined();
  });
  it("approx: 12 significant digits, half up, E past the plain range", () => {
    expect(approx(1n, 3n)).toBe("0.333333333333");
    expect(approx(2n, 3n)).toBe("0.666666666667");
    expect(approx(5n, 9n)).toBe("0.555555555556");
    expect(approx(10n ** 20n, 3n)).toBe("3.33333333333E19");
    expect(approx(1n, 3n * 10n ** 10n)).toBe("3.33333333333E-11");
    expect(approx(999999999999999n, 10n ** 15n)).toBe("1");
  });
});

if (!hasIndex)
  it("the Find index is required", () => {
    if (process.env["FIND_INDEX"] === "required") expect.fail(`${indexFile} is missing or holds functions only`);
  });
