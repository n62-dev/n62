// SPDX-License-Identifier: GPL-3.0-or-later
// R149: the credits' text comes from THIRD_PARTY.md's parts (virtual:about), with the owner's story first, unedited.
import about from "virtual:about";
import { describe, expect, it } from "vitest";
import { creditBlocks } from "./creditsSheet.ts";

describe("creditBlocks", () => {
  const blocks = creditBlocks(about.parts);
  const text = blocks.map((b) => ("heading" in b ? b.heading : b.text));
  it("starts with the owner's story, then Made with", () => {
    expect(text[0]).toBe("N for number, 6 first perfect number, 2 first prime number");
    expect(text[1]).toBe("Made with");
  });
  it("names Giac and MathLive with their copyright lines as THIRD_PARTY.md has them", () => {
    expect(blocks.some((b) => "heading" in b && b.heading.startsWith("Giac"))).toBe(true);
    const i = text.findIndex((x) => x.startsWith("MathLive"));
    expect(text[i + 1]).toContain("Arno Gourdol");
  });
  it("ends with the licence and the web address", () => {
    expect(text.at(-2)).toContain("GNU General Public License");
    expect(text.at(-1)).toBe("https://n62.dev");
  });
});
