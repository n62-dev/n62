// SPDX-License-Identifier: GPL-3.0-or-later
// G40: the unit view's angle wrappers as text: sin, cos and tan take an angle, the inverses give one, and the parser's
// degree factor (R64) is taken off both. No engine (the golden gate's units stage evaluates them).
import { describe, expect, it } from "vitest";
import { numberPart, withAngles } from "./evaluate.ts";

describe("withAngles (P15, G40)", () => {
  it("sin, cos and tan take an angle, without the parser's pasdeg", () => {
    expect(withAngles("sin(pasdeg*30)+cos(x)")).toBe("pasusin(30)+pasucos(x)");
  });
  it("an inverse gives an angle: the parser's /pasdeg after it goes", () => {
    expect(withAngles("(asin(1/2)/pasdeg)*2*m")).toBe("(pasuasin(1/2))*2*m");
    expect(withAngles("acos(x)")).toBe("pasuacos(x)");
    expect(withAngles("(atan2(3*m,4*m)/pasdeg)")).toBe("(pasuatan2(3*m,4*m))");
    expect(withAngles("(atan(1)/pasdeg)+(acot(1)/pasdeg)")).toBe("(pasuatan(1))+(pasuacot(1))");
  });
  it("nested calls and brackets inside the argument", () => {
    expect(withAngles("(asin((asin(1/2)/pasdeg)/(2*(1+1)))/pasdeg)")).toBe("(pasuasin((pasuasin(1/2))/(2*(1+1))))");
    expect(withAngles("sin(pasdeg*(asin(1/2)/pasdeg))")).toBe("pasusin((pasuasin(1/2)))");
  });
  it("leaves other names, a power of pasdeg and an unbalanced call alone", () => {
    expect(withAngles("asinh(1)+basin(2)")).toBe("asinh(1)+basin(2)");
    expect(withAngles("asin(x)/pasdeg^2")).toBe("pasuasin(x)/pasdeg^2");
    expect(withAngles("asin(x")).toBe("asin(x");
  });
});

describe("numberPart (G319)", () => {
  it("each slot as its factor: a dimension symbol with its power is 1, decimals exact", () => {
    expect(numberPart("5*(((1000)*pasdimL^(1))*((3600)*pasdimT^(1))^(-1))")).toBe("5*(((1000)*1)*((3600)*1)^(-1))");
    expect(numberPart("1.5*((1)*pasdimM*pasdimL^(-1/2))")).toBe("(15/10^1)*((1)*1*1)");
  });
  it("rad is 1/pasdeg: the parser's degree factor takes an angle in rad as it is", () => {
    expect(numberPart("tan(pasdeg*(90*(((1)*pasdimA^(1)))))")).toBe("tan(pasdeg*(90*(((1)*(1/pasdeg)^(1)))))");
  });
  it("leaves other names, calls and Home's input alone", () => {
    expect(numberPart("(1/(1/0))*pasdimLx+pasdimL(2)")).toBe("(1/(1/0))*pasdimLx+pasdimL(2)");
  });
});
