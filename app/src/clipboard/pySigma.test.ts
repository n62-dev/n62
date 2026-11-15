// SPDX-License-Identifier: GPL-3.0-or-later
// G217: σ's note and N62's ⚠ reasons in Copy as Python; the affinity of a unit row's tree (pySigma.ts).
import { describe, expect, it } from "vitest";
import { unitText } from "../i18n/enUnits.ts";
import { affinity, sigmaTail, SIGMA_NOTE, WHY_TEXT } from "./pySigma.ts";
import type { Json } from "../input/emit.ts";

const x: Json = ["Call", "pasupm", { num: "1" }, { num: "0.1" }];
const n = (v: string): Json => ({ num: v });

describe("pySigma (G217)", () => {
  it("the ⚠ reasons are N62's own texts", () => {
    expect(WHY_TEXT.jump).toBe(unitText("units.why.jump"));
    expect(WHY_TEXT.singular).toBe(unitText("units.why.singular"));
  });
  it("sigmaTail: the reason for jump and singular, never for order2; the note when not affine", () => {
    expect(sigmaTail("order2", true)).toBe("");
    expect(sigmaTail(null, false)).toBe(` ${SIGMA_NOTE}`);
    expect(sigmaTail("jump", false)).toBe(` ⚠ ${unitText("units.why.jump")} ${SIGMA_NOTE}`);
    expect(sigmaTail("singular", true)).toBe(` ⚠ ${unitText("units.why.singular")}`);
  });
  it("affinity: sums and one uncertain factor are affine; products of two, quotients by one and powers are not", () => {
    expect(affinity(["Multiply", n("2"), "pasu1"])).toBe(0);
    expect(affinity(["Add", ["Multiply", n("2"), x], ["Negate", x]])).toBe(1);
    expect(affinity(["Divide", x, n("3")])).toBe(1);
    expect(affinity(["Multiply", x, x])).toBe(2);
    expect(affinity(["Divide", n("1"), x])).toBe(2);
    expect(affinity(["Power", ["Delimiter", x], n("2")])).toBe(2);
    expect(affinity(["Power", ["Delimiter", x], n("1")])).toBe(1);
    expect(affinity(["Square", x])).toBe(2);
  });
});
