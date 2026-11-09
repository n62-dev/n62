// SPDX-License-Identifier: GPL-3.0-or-later
// G301: which texts withoutDegreeQuotient leaves alone, and when it asks Giac at all. The reduced values themselves are
// golden rows (tests/golden/precision.yaml, g301-*), on the real engine.
import { describe, expect, it } from "vitest";
import { withoutDegreeQuotient } from "./degrees.ts";
import type { Giac } from "./numeric.ts";

/** A Giac that answers from `answers` by the text's command, and records what it was asked. */
function fake(answers: { lname?: string; normal?: string }): { giac: Giac; asked: string[] } {
  const asked: string[] = [];
  const giac: Giac = {
    eval: (input) => {
      asked.push(input);
      if (input.startsWith("lname(")) return answers.lname ?? "[]";
      if (input.startsWith("normal(")) return answers.normal ?? "30";
      throw new Error(`unexpected: ${input}`);
    },
    value: () => {
      throw new Error("not used");
    },
  };
  return { giac, asked };
}

describe("withoutDegreeQuotient", () => {
  it("reduces a constant's quotient over the factor", () => {
    const { giac, asked } = fake({});
    expect(withoutDegreeQuotient(giac, "pi/6/(pi/180)")).toBe("30");
    expect(asked).toEqual(["lname(pi/6/(pi/180))", "normal(pi/6/(pi/180))"]);
  });

  it("reduces the form with the factor's pi cancelled", () => {
    const { giac } = fake({ normal: "9" });
    expect(withoutDegreeQuotient(giac, "180/20*pi/pi")).toBe("9");
  });

  it("gives null for a free name, without a normal", () => {
    const { giac, asked } = fake({ lname: "[x]" });
    expect(withoutDegreeQuotient(giac, "pi/6/(pi/180)+x")).toBeNull();
    expect(asked).toEqual(["lname(pi/6/(pi/180)+x)"]);
  });

  it("gives null for a text with a trig or inverse call, without asking Giac", () => {
    for (const text of ["sin(1)/(pi/180)", "asin(x)*pi/pi"]) {
      const { giac, asked } = fake({});
      expect(withoutDegreeQuotient(giac, text)).toBeNull();
      expect(asked).toEqual([]);
    }
  });

  it("gives null for a string, without asking Giac", () => {
    const { giac, asked } = fake({});
    expect(withoutDegreeQuotient(giac, '"pi/6/(pi/180)"')).toBeNull();
    expect(asked).toEqual([]);
  });

  it("gives null for a text with neither form, without asking Giac", () => {
    for (const text of ["(1+sqrt(2))^2", "1/(1+sqrt(2))", "pi/180", "1/180*pi*atan(x)"]) {
      const { giac, asked } = fake({});
      expect(withoutDegreeQuotient(giac, text)).toBeNull();
      expect(asked).toEqual([]);
    }
  });

  it("gives null when normal answers an error or undef", () => {
    for (const normal of ["GIAC_ERROR: Bad Argument Value", "undef"]) {
      const { giac } = fake({ normal });
      expect(withoutDegreeQuotient(giac, "pi/6/(pi/180)")).toBeNull();
    }
  });
});
