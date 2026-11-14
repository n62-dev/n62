// SPDX-License-Identifier: GPL-3.0-or-later
// G214 fix round 1: the translator decides by emit.ts's own FN table and oddIndex rule, never by a copy. emit.ts is
// mocked with one mapping and one rule changed: the translation must follow it (a copy would keep the old one).
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

const { translateRows } = await import("./python.ts");
const HEAD = "# N62 0.1.0 · Copy as Python · preview: the form of this file can change";
const one = (input: string): string => translateRows([{ view: "home", input, ok: true, mark: "=", exact: "v", angle: "rad" }], { app: "0.1.0" });

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
});
