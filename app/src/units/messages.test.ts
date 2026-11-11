// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enEngine } from "../i18n/enEngine.ts";
import { importsOf } from "../../scripts/import-rules.ts";
import { unitErrorMessage } from "./messages.ts";

describe("unitErrorMessage, G319: Home's refusals", () => {
  it("words each with Home's message", () => {
    for (const code of ["divisionByZero", "seriesDiverges", "integralDiverges", "noLimit", "overflow", "noValue"] as const) {
      expect(unitErrorMessage({ error: "refused", code })).toBe(enEngine[`error.${code}`]);
    }
  });

  it("reads them from the app's table, not enEngine.ts (G319 fix 1: that import made enEngine a start chunk of its own, +0.14 kB gzip)", () => {
    const specs = importsOf(readFileSync(new URL("./messages.ts", import.meta.url), "utf8")).map((i) => i.spec);
    expect(specs).not.toContain("../i18n/enEngine.ts");
  });
});
