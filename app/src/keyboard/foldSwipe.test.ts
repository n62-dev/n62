// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { BACK_PX, FOLD_PX, SWIPE_MS, isTap, liftOf, swipeOf } from "./foldSwipe.ts";

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
  it("acts on the lift only while the pointer is still FOLD_PX past its start and mostly vertical (R773)", () => {
    expect(BACK_PX).toBe(12);
    expect(liftOf(0, 24)).toBe("down");
    expect(liftOf(5, -30)).toBe("up");
    expect(liftOf(0, 23)).toBeUndefined();
    expect(liftOf(0, 0)).toBeUndefined();
    expect(liftOf(20, 30)).toBeUndefined(); // gone sideways
  });
  it("a lift within BACK_PX of the start, each way, and within SWIPE_MS is a tap (R868)", () => {
    expect(isTap(0, 0, 80)).toBe(true);
    expect(isTap(-11, 11, SWIPE_MS)).toBe(true);
    expect(isTap(0, BACK_PX, 80)).toBe(false); // moved too far: a swipe's start or a scroll
    expect(isTap(BACK_PX, 0, 80)).toBe(false);
    expect(isTap(0, 0, SWIPE_MS + 1)).toBe(false); // a hold: the line's
  });
});
