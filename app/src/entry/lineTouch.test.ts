// SPDX-License-Identifier: GPL-3.0-or-later
// R277: a touch on the entry line is a tap or a hold until it moves 8 px; then a sideways drag scrolls the line and a
// vertical one is R53's swipe. The scroll writes MathLive's shadow `[part=content]` (field.ts scrollLine); without the
// part it does nothing and throws nothing.
import { describe, expect, test } from "vitest";
import { scrollLine } from "./field.ts";
import { SLOP_PX, dragOf } from "./lineTouch.ts";

describe("dragOf", () => {
  test("within the slop: still a tap or a hold", () => {
    expect(dragOf(0, 0)).toBeUndefined();
    expect(dragOf(SLOP_PX - 1, -(SLOP_PX - 1))).toBeUndefined();
  });
  test("past it: sideways scrolls, vertical is no gesture of the line's", () => {
    expect(dragOf(SLOP_PX, 0)).toBe("scroll");
    expect(dragOf(-20, 12)).toBe("scroll");
    expect(dragOf(3, SLOP_PX)).toBe("none");
    expect(dragOf(10, -30)).toBe("none");
  });
});

describe("scrollLine", () => {
  test("moves the content part's scrollLeft by dx", () => {
    const part = { scrollLeft: 100 };
    const mf = { shadowRoot: { querySelector: (s: string) => (s === "[part=content]" ? part : null) } };
    expect(scrollLine(mf as never, -30)).toBe(true);
    expect(part.scrollLeft).toBe(70);
  });
  test("without the part (a MathLive update) or a shadow root it does nothing", () => {
    expect(scrollLine({ shadowRoot: { querySelector: () => null } } as never, 10)).toBe(false);
    expect(scrollLine({ shadowRoot: null } as never, 10)).toBe(false);
  });
});
