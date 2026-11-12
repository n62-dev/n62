// SPDX-License-Identifier: GPL-3.0-or-later
// R276: when a swiped history row goes, and how a drag is split between a long input's sideways scroll and the row.
import { describe, expect, it } from "vitest";
import { FLING_MIN_PX, FLING_SPEED, share, swipeOut, SWIPE_SHARE } from "./rowSwipe.ts";

describe("swipeOut", () => {
  it("goes at 40 % of the width, either way", () => {
    expect(SWIPE_SHARE).toBe(0.4);
    expect(swipeOut(160, 400, 0)).toBe(true);
    expect(swipeOut(-160, 400, 0)).toBe(true);
    expect(swipeOut(159, 400, 0)).toBe(false);
    expect(swipeOut(-159, 400, 0)).toBe(false);
  });
  it("goes on a fling in the slide's direction, once the row is out a little", () => {
    expect(swipeOut(FLING_MIN_PX, 400, FLING_SPEED)).toBe(true);
    expect(swipeOut(-FLING_MIN_PX, 400, -FLING_SPEED)).toBe(true);
    expect(swipeOut(FLING_MIN_PX, 400, -FLING_SPEED)).toBe(false); // flung back
    expect(swipeOut(FLING_MIN_PX - 1, 400, 2)).toBe(false); // the row barely moved (a long input took the drag)
    expect(swipeOut(60, 400, FLING_SPEED / 2)).toBe(false); // a slow lift springs back
  });
  it("never goes with the row in place or no width", () => {
    expect(swipeOut(0, 400, 5)).toBe(false);
    expect(swipeOut(30, 0, 5)).toBe(false);
  });
});

describe("share", () => {
  it("moves the row alone when nothing scrolls", () => {
    expect(share(-30, 0, 0, 0)).toEqual({ scroll: 0, offset: -30 });
    expect(share(30, 0, 0, 0)).toEqual({ scroll: 0, offset: 30 });
  });
  it("scrolls a long input first; the row slides only from the end of that scroll", () => {
    // finger left: the content scrolls on towards its end (max 100), the rest slides the row
    expect(share(-30, 50, 100, 0)).toEqual({ scroll: 80, offset: 0 });
    expect(share(-30, 80, 100, 0)).toEqual({ scroll: 100, offset: -10 });
    // finger right: back towards the start, then the row
    expect(share(30, 10, 100, 0)).toEqual({ scroll: 0, offset: 20 });
  });
  it("brings an out row back before the content scrolls again", () => {
    expect(share(15, 100, 100, -10)).toEqual({ scroll: 95, offset: 0 });
    expect(share(5, 100, 100, -10)).toEqual({ scroll: 100, offset: -5 });
    expect(share(-5, 0, 100, 20)).toEqual({ scroll: 0, offset: 15 });
  });
});
