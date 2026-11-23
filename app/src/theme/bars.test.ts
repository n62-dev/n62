// SPDX-License-Identifier: GPL-3.0-or-later
// A266: theme/bars.ts, the page's side of Android's system bars.
import { describe, expect, it } from "vitest";
import { isLightBg, setBars } from "./bars.ts";

describe("theme/bars.ts", () => {
  it("light icons on a dark colour, dark icons on a light one (the one with more contrast)", () => {
    expect(["#092726", "#000000", "#2d4056", "#10161e"].map(isLightBg)).toEqual([false, false, false, false]);
    expect(["#ffffd6", "#ffffff", "#fffff1", "#f5f5f5", "#529997"].map(isLightBg)).toEqual([true, true, true, true, true]);
  });
  it("outside Capacitor setBars neither calls anything nor throws", async () => {
    await expect(setBars({ color: "#ffffd6", light: true })).resolves.toBeUndefined();
  });
});
