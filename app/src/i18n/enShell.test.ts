// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { en } from "./en.ts";
import { enShell, shellText } from "./enShell.ts";

describe("the shell's own words (G399: off the start table)", () => {
  it("fills the Menu row's placeholders as t does", () => {
    expect(shellText("menu.inView", { labels: "Zoom, trace …", view: "Plot" })).toBe("Zoom, trace … in Plot");
    expect(shellText("status.views")).toBe("Views");
  });

  it("keeps no key in both tables", () => {
    expect(Object.keys(enShell).filter((k) => k in en)).toEqual([]);
  });
});
