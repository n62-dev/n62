// SPDX-License-Identifier: GPL-3.0-or-later
// R157: the app's mark file is the logo file's path, unchanged, cropped to the mark and filled black; the generator wrote it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOGO_FILE, MARK_FILE, logoPath, markSvg } from "./gen-mark.ts";

const mark = (): string => readFileSync(MARK_FILE, "utf8");

describe("R157: the mark file", () => {
  it("has the logo file's path unchanged", () => {
    const d = logoPath(readFileSync(LOGO_FILE, "utf8"));
    expect(d.length).toBeGreaterThan(1500);
    expect(mark()).toContain(` d="${d}"`);
  });
  it("crops to the mark: a viewBox of 31.35 30.5 45.3 47", () => {
    expect(mark()).toMatch(/viewBox="31\.35 30\.5 45\.3 47"/);
  });
  it("has an SPDX line first (rules-core), as public/icons/icon.svg has", () => {
    expect(mark().split("\n")[0]).toBe("<!-- SPDX-License-Identifier: GPL-3.0-or-later -->");
  });
  it("is filled black", () => {
    expect(mark()).toMatch(/<path fill="#000000" /);
  });
  it("is what the generator writes (npm run mark), so no hand copy", () => {
    expect(mark()).toBe(markSvg(readFileSync(LOGO_FILE, "utf8")));
  });
});
