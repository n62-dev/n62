// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it, vi } from "vitest";
import type { ActionBody } from "../keyboard/keyboard.ts";
import { appAction, appText, constValueLatex, hasChipLatex, type Where } from "./appValue.ts";

describe("a constant on an app's line (R747)", () => {
  it("an integer or plain decimal is its digits", () => {
    expect(constValueLatex("299792458", "expr")).toBe("299792458");
    expect(constValueLatex("0.5291772", "num")).toBe("0.5291772");
  });
  it("an exponent: one bracketed term on an expression line, the exponent key's form on a number line", () => {
    expect(constValueLatex("6.67430E-11", "expr")).toBe("\\left(6.67430\\times10^{-11}\\right)");
    expect(constValueLatex("1.5e+3", "expr")).toBe("\\left(1.5\\times10^{3}\\right)");
    expect(constValueLatex("6.67430E-11", "num")).toBe("6.67430\\emark-11");
    expect(constValueLatex("2E0", "expr")).toBe("2");
  });
  it("a signed value is one bracketed term on an expression line, so x^(-2.5) never reads x^-2.5", () => {
    expect(constValueLatex("-2.5", "expr")).toBe("\\left(-2.5\\right)");
    expect(constValueLatex("-3", "expr")).toBe("\\left(-3\\right)");
    expect(constValueLatex("+1.5", "expr")).toBe("\\left(+1.5\\right)");
    expect(constValueLatex("-2.5", "num")).toBe("-2.5");
    expect(constValueLatex("-2.5E-3", "expr")).toBe("\\left(-2.5\\times10^{-3}\\right)");
  });
  it("a value that is no plain decimal goes in as written", () => {
    expect(constValueLatex("1/3", "expr")).toBe("\\left(1/3\\right)");
  });
  it("finds the chips", () => {
    expect(hasChipLatex("x+\\const{c}{c}")).toBe(true);
    expect(hasChipLatex("\\res{2}{3}")).toBe(true);
    expect(hasChipLatex("\\ans")).toBe(true);
    expect(hasChipLatex("x\\times3")).toBe(false);
  });
  const table = { "const:G": { value: "6.67430E-11", exact: false, unc: "1.5E-15" }, "const:c": { value: "299792458", exact: true } };
  const hook = (kind: "home" | "expr" | "num", said: string[] = []): Where => ({ app: kind === "home" ? null : "solve", view: kind === "num" ? "num" : "symb", clip: { say: (n) => void said.push(n) } });
  it("an app's line takes a chip's value; a symbol with braces is skipped whole", () => {
    expect(appText("x=\\const{c}{c}", hook("expr"), table)).toBe("x=299792458");
    expect(appText("x\\times\\const{G}{m_{\\mathrm{e}}}+1", hook("expr"), table)).toBe("x\\times\\left(6.67430\\times10^{-11}\\right)+1");
    expect(appText("\\const{G}{G}", hook("num"), table)).toBe("6.67430\\emark-11");
  });
  it("an app's line refuses a chip it cannot value: no table entry, a result, Ans", () => {
    expect(appText("\\const{h}{h}", hook("expr"), table)).toBeUndefined();
    expect(appText("x+\\res{1}{3}", hook("expr"), table)).toBeUndefined();
    expect(appText("\\ans", hook("num"), table)).toBeUndefined();
  });
  it("Home and CAS keep the chip as it is", () => {
    expect(appText("\\const{c}{c}", hook("home"), table)).toBe("\\const{c}{c}");
    const a: ActionBody = { kind: "insert", latex: "\\const{c}{c}", chip: { key: "const:c", chip: { value: "299792458", exact: true } } };
    expect(appAction(a, hook("home"))).toBe(a);
  });
  it("a free key's constant types its value on an app's line, any other chip is refused", () => {
    const a: ActionBody = { kind: "insert", latex: "\\const{c}{c}", chip: { key: "const:c", chip: { value: "299792458", exact: true } } };
    expect(appAction(a, hook("expr"))).toEqual({ kind: "insert", latex: "299792458" });
    expect(appAction({ kind: "insert", latex: "\\ans" }, hook("expr"))).toBeUndefined();
    expect(appAction({ kind: "type", text: "x" }, hook("expr"))).toEqual({ kind: "type", text: "x" });
  });
  it("a refused line says nothing and keeps the note", async () => {
    vi.resetModules();
    const { appText } = await import("./appValue.ts");
    const said: string[] = [];
    expect(appText("\\const{c}{c}+\\ans", hook("expr", said), table)).toBeUndefined();
    expect(said).toHaveLength(0);
    appText("\\const{c}{c}", hook("expr", said), table);
    expect(said).toHaveLength(1);
  });
  it("the note is said once", async () => {
    vi.resetModules();
    const { appText } = await import("./appValue.ts");
    const said: string[] = [];
    appText("\\const{c}{c}", hook("expr", said), table);
    appText("\\const{c}{c}", hook("expr", said), table);
    expect(said).toHaveLength(1);
  });
});
