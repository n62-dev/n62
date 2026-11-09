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

  it("gives null for a root inside a root, without asking Giac", () => {
    for (const text of ["sqrt(sqrt(pi/6/(pi/180)))", "3*sqrt(5*(pi+sqrt(2)))/(pi/180)"]) {
      const { giac, asked } = fake({});
      expect(withoutDegreeQuotient(giac, text)).toBeNull();
      expect(asked).toEqual([]);
    }
  });

  it("still reduces two roots side by side", () => {
    expect(withoutDegreeQuotient(fake({ normal: "sqrt(2)+30" }).giac, "pi/6/(pi/180)+sqrt(2)+sqrt(3)-sqrt(3)")).toBe("sqrt(2)+30");
  });

  it("gives null when normal answers a text that is not shorter", () => {
    const text = "3+exp(9)/(pi/6/(pi/180))";
    for (const normal of [`${text}+0`, "(i*pi*exp(150000000)+540*ln(3))/(180*ln(3))", "x".repeat(text.length)]) {
      expect(withoutDegreeQuotient(fake({ normal }).giac, text)).toBeNull();
    }
  });

  it("gives null when normal answers a run of 1*1, even a shorter one", () => {
    expect(withoutDegreeQuotient(fake({ normal: "1*1*sqrt(3)" }).giac, "sqrt(pi/6/(pi/180)+pi/4/(pi/180))")).toBeNull();
  });

  it("gives null when normal answers an error or undef", () => {
    for (const normal of ["GIAC_ERROR: Bad Argument Value", "undef"]) {
      const { giac } = fake({ normal });
      expect(withoutDegreeQuotient(giac, "pi/6/(pi/180)")).toBeNull();
    }
  });
});
