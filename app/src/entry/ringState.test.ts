// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { ringState, type RingInput } from "./ringState.ts";

const base: RingInput = { shift: false, alpha: false, view: "home", newest: "done", editedSinceEnter: false };
const ring = (o: Partial<RingInput>) => ringState({ ...base, ...o });

describe("ringState (R154)", () => {
  it("is rest with nothing armed", () => expect(ring({})).toBe("rest"));
  it("Shift: shift", () => expect(ring({ shift: true })).toBe("shift"));
  it("Alpha: alpha", () => expect(ring({ alpha: true })).toBe("alpha"));
  it("Alpha, armed or locked, wins over Shift", () => expect(ring({ shift: true, alpha: true })).toBe("alpha"));
  describe("error", () => {
    const err: Partial<RingInput> = { newest: "error" };
    it("in Home and CAS, with an empty untouched line", () => {
      expect(ring({ ...err, view: "home" })).toBe("error");
      expect(ring({ ...err, view: "cas" })).toBe("error");
    });
    it("not in an app", () => expect(ring({ ...err, view: "app" })).toBe("rest"));
    it("not when the newest item is anything else", () => {
      for (const newest of ["done", "pending", "cancelled", "note", undefined] as const) expect(ring({ newest }), String(newest)).toBe("rest");
    });
    it("not once a key or an edit came since Enter, even back to an empty line", () => expect(ring({ ...err, editedSinceEnter: true })).toBe("rest"));
    it("Shift and Alpha win over it", () => {
      expect(ring({ ...err, shift: true })).toBe("shift");
      expect(ring({ ...err, alpha: true })).toBe("alpha");
    });
  });
});
