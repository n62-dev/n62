// SPDX-License-Identifier: GPL-3.0-or-later
// R838f1: the pad cancels its touchmoves (no scroll gesture, so no fling to take the next tap's click) until the cleanup.
import { describe, expect, it } from "vitest";
import { noFling } from "./noFling.ts";

const move = (el: EventTarget, cancelable: boolean): Event => {
  const e = new Event("touchmove", { cancelable });
  el.dispatchEvent(e);
  return e;
};

describe("noFling (R838f1)", () => {
  it("cancels a cancelable touchmove, leaves the rest, and stops after the cleanup", () => {
    const pad = new EventTarget();
    const off = noFling(pad as HTMLElement);
    expect(move(pad, true).defaultPrevented).toBe(true);
    expect(move(pad, false).defaultPrevented).toBe(false);
    const other = new Event("pointermove", { cancelable: true });
    pad.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false); // (the pad's own paths are pointer events)
    off?.();
    expect(move(pad, true).defaultPrevented).toBe(false);
  });

  it("no pad yet: nothing, no cleanup", () => {
    expect(noFling(undefined)).toBeUndefined();
  });
});
