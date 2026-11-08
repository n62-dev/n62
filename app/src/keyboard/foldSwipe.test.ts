// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { FOLD_PX, SWIPE_MS, swipeOf } from "./foldSwipe.ts";

describe("the entry line's swipe (R53)", () => {
  it("is 24 px down or up, mostly vertical, within 400 ms", () => {
    expect([FOLD_PX, SWIPE_MS]).toEqual([24, 400]);
    expect(swipeOf(0, 24, 100)).toBe("down");
    expect(swipeOf(11, 24, 400)).toBe("down"); // |dy| > 2 |dx|
    expect(swipeOf(-5, -30, 50)).toBe("up");
  });
  it("is undecided while short and mostly vertical", () => {
    expect(swipeOf(0, 23, 100)).toBeUndefined();
    expect(swipeOf(3, 10, 100)).toBeUndefined();
    expect(swipeOf(11, 22, 100)).toBeUndefined(); // |dy| = 2 |dx|: not yet vertical enough, not sideways either
  });
  it("is dropped (the field's) when sideways or slow", () => {
    expect(swipeOf(12, 0, 50)).toBe("drop");
    expect(swipeOf(30, 20, 50)).toBe("drop");
    expect(swipeOf(0, 10, 401)).toBe("drop");
    expect(swipeOf(0, 40, 401)).toBe("drop");
  });
});
