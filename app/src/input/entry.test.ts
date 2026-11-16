// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { giacOfEntry } from "./entry.ts";
import { homeLatexStep } from "../goldenRun.ts";
import type { ChipTable } from "./chips.ts";

describe("G98: the golden runner sends a Home latex entry as the session does", () => {
  const chips: ChipTable = { "res:1": { value: "0.333333333333", exact: false } };
  const latex = "\\res{1}{0.333333333333}+1";
  it("an inexact chip goes in by name (pasr_<k>), in the runner and the session alike", () => {
    const run = homeLatexStep(latex, chips);
    const session = giacOfEntry(latex, "home", { chips });
    expect(run.giac).toBe(session.giac);
    expect(run.giac).toMatch(/pasr_/);
    expect(run.inexact).toBe(true);
  });
  it("CAS keeps the chip as text", () => {
    expect(giacOfEntry(latex, "cas", { chips }).giac).not.toMatch(/pasr_/);
  });
});

// R353: a unit result's exact chip (5 km) stored from Home goes by name, so the store keeps its unit (G371's unitOfStore
// reads the chip by its name); its value still goes in as written and the result stays exact
describe("R353: an exact chip with a unit goes in by name", () => {
  const unit = { text: "km", dim: "m1", slot: { tokens: [{ prefix: "k", unit: "m" }] } };
  it("\\res{5 km} ▶ X names pasr_1, listed in named, not inexact; without a unit it stays a literal", () => {
    const withUnit = giacOfEntry("\\res{1}{5}\\blacktriangleright X", "home", { chips: { "res:1": { value: "5", exact: true, unit } } });
    expect(withUnit.giac).toMatch(/pasr_1/);
    expect(withUnit.named).toEqual({ "1": { value: "5", exact: true, unit } });
    expect(withUnit.inexact).toBe(false);
    const bare = giacOfEntry("\\res{1}{5}\\blacktriangleright X", "home", { chips: { "res:1": { value: "5", exact: true } } });
    expect(bare.giac).not.toMatch(/pasr_/);
  });
});
