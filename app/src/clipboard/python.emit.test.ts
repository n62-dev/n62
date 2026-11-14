// SPDX-License-Identifier: GPL-3.0-or-later
// G214 fix round 1: the translator decides by emit.ts's own FN table and oddIndex rule, never by a copy. emit.ts is
// mocked with one mapping and one rule changed: the translation must follow it (a copy would keep the old one). Fix
// round 2: the same for angles.ts's ANGLE_IN and ANGLE_OUT, the lists emit.ts adds pasdeg by.
import { describe, expect, it, vi } from "vitest";
import type { Json } from "../input/emit.ts";

vi.mock("../input/emit.ts", async (orig) => {
  const real = await orig<typeof import("../input/emit.ts")>();
  return {
    ...real,
    // \sin goes to Giac's cos; \cosh to a name outside PY_FUNCTIONS
    FN: { ...real.FN, Sin: "cos", Cosh: "pasmod" },
    // 3 no longer counts as odd, 4 does
    oddIndex: (n: Json | undefined): boolean => typeof n === "object" && n !== null && !Array.isArray(n) && "num" in n && n.num === "4",
  };
});

vi.mock("../engine/angles.ts", async (orig) => {
  const real = await orig<typeof import("../engine/angles.ts")>();
  // atan no longer returns an angle; tan no longer takes one; sinh takes one in a form the table does not write
  const out: ReadonlySet<string> = new Set([...real.ANGLE_OUT].filter((n) => n !== "atan"));
  const inn: typeof real.ANGLE_IN = { ...Object.fromEntries(Object.entries(real.ANGLE_IN).filter(([n]) => n !== "tan")), sinh: [1, 0] };
  return {
    ...real,
    ANGLE_OUT: out,
    ANGLE_IN: inn,
    returnsAngle: (n: string): boolean => out.has(real.angleName(n)),
    angleInSpec: (n: string): (typeof real.ANGLE_IN)[string] | undefined => {
      const c = real.angleName(n);
      return Object.hasOwn(inn, c) ? inn[c] : undefined;
    },
  };
});

const { translateRows } = await import("./python.ts");
const HEAD = "# N62 0.1.0 · Copy as Python · preview: the form of this file can change";
const one = (input: string, angle = "rad"): string => translateRows([{ view: "home", input, ok: true, mark: "=", exact: "v", angle }], { app: "0.1.0" });

describe("translateRows reads emit.ts's own tables", () => {
  it("a head goes to the function FN gives", () => {
    expect(one("\\sin(30)")).toBe(`${HEAD}\nfrom sympy import cos\n_1 = cos(30)  # N62: = v\n`);
  });
  it("a head whose FN name is not in PY_FUNCTIONS stays not translated", () => {
    expect(one("\\cosh(1)")).toBe(`${HEAD}\n# N62 NOT TRANSLATED (Cosh is not translated): \\cosh(1)\n# N62: = v\n`);
  });
  it("the root follows oddIndex", () => {
    expect(one("\\sqrt[3]{-8}")).toBe(`${HEAD}\nfrom sympy import root\n_1 = root(-8, 3)  # N62: = v\n`);
    expect(one("\\sqrt[4]{-16}")).toBe(`${HEAD}\nfrom sympy import real_root\n_1 = real_root(-16, 4)  # N62: = v\n`);
  });
  it("the angle tags follow angles.ts", () => {
    // ANGLE_OUT without atan: no deg(...) around it in DEG; asin keeps its own
    expect(one("\\arctan(1)", "deg")).toBe(`${HEAD}\nfrom sympy import atan\n_1 = atan(1)  # N62: = v\n`);
    expect(one("\\arcsin(1)", "deg")).toBe(`${HEAD}\nfrom sympy import asin, deg\n_1 = deg(asin(1))  # N62: = v\n`);
    // ANGLE_IN without tan: no rad(...); sin keeps its own
    expect(one("\\tan(30)", "deg")).toBe(`${HEAD}\nfrom sympy import tan\n_1 = tan(30)  # N62: = v\n`);
    expect(one("\\sin(30)", "deg")).toBe(`${HEAD}\nfrom sympy import cos, rad\n_1 = cos(rad(30))  # N62: = v\n`);
    // an angle argument in another form than [0, 1] is refused
    expect(one("\\sinh(1)", "deg")).toBe(`${HEAD}\n# N62 NOT TRANSLATED (sinh takes its angle in a form that is not translated): \\sinh(1)\n# N62: = v\n`);
  });
});
