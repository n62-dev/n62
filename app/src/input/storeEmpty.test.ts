// SPDX-License-Identifier: GPL-3.0-or-later
// R702 (F382): a store arrow with nothing before it says what it needs, never the parser's command name; the other
// infix commands of its family (→, AND, OR, XOR, ∡, mod, and the postfix °, %) do the same. An unknown command a user
// typed still names it.
import { describe, expect, it } from "vitest";
import { parseText } from "../i18n/enParser.ts";
import { latexToGiac } from "./latex-to-giac.ts";

const message = (latex: string): string => {
  try {
    latexToGiac(latex);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`no error for ${latex}`);
};

describe("R702: a lone ▶ says what it needs", () => {
  it("▶ alone, and ▶ A, read: Store needs a value before ▶", () => {
    expect(parseText("parse.storeNeedsValue")).toBe("Store needs a value before ▶");
    expect(message("\\blacktriangleright")).toBe("Store needs a value before ▶");
    expect(message("\\blacktriangleright A")).toBe("Store needs a value before ▶");
  });

  it.each([
    ["\\rightarrow x", "→ needs a variable name before it (x → x²)"],
    ["\\to x", "→ needs a variable name before it (x → x²)"],
    ["\\operatorname{AND}1", "AND needs a number or name before it"],
    ["\\operatorname{OR}1", "OR needs a number or name before it"],
    ["\\operatorname{XOR}1", "XOR needs a number or name before it"],
    ["\\mathbin{\\measuredangle}30", "∡ needs a number or name before it"],
    ["\\bmod 3", "mod needs a number or name before it"],
    ["\\degree", "° needs a number or name before it"],
    ["\\circ", "° needs a number or name before it"],
    ["\\%", "% needs a number or name before it"],
  ])("no LaTeX command name in the message: %s", (latex, want) => {
    const m = message(latex);
    expect(m).not.toMatch(/\\|unsupported command|logic:/);
    expect(m).toBe(want);
  });

  it("an unknown command a user typed still says unsupported command with its name", () => {
    expect(message("\\foo")).toBe("unsupported command \\foo");
  });

  it("controls: 5 ▶ A stores, 5 ▶ alone still asks for the name", () => {
    expect(latexToGiac("5\\blacktriangleright A")).toBe("A:=5");
    expect(message("5\\blacktriangleright")).not.toMatch(/\\/);
  });
});
