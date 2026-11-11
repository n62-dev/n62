// SPDX-License-Identifier: GPL-3.0-or-later
// G329: the calls stage's counting bridge counts one call per bridge call and forwards every argument, `value`'s tree too:
// the app's own wrappers (ctxGate.ts, host.ts) pass it on, so a stage that drops it measures a shorter path than the app runs.
import { describe, expect, it } from "vitest";
import type { GiacBridge, GiacContext, GiacParse, GiacValue } from "../../src/engine/bridge.ts";
import { countingBridge } from "./calls.ts";

function standIn(): { bridge: GiacBridge; seen: unknown[][] } {
  const seen: unknown[][] = [];
  const bridge: GiacBridge = {
    ctxGet: () => (seen.push(["ctxGet"]), { angle_mode: 0 } as GiacContext),
    ctxSet: (f) => (seen.push(["ctxSet", f]), { angle_mode: 1 } as GiacContext),
    parse: (t) => (seen.push(["parse", t]), { ok: true } as GiacParse),
    value: (...a) => (seen.push(["value", ...a]), { kind: "integer", text: "1" } as GiacValue),
  };
  return { bridge, seen };
}

describe("countingBridge", () => {
  it("passes value's tree through, and counts the call once", () => {
    const { bridge, seen } = standIn();
    let n = 0;
    const b = countingBridge(bridge, () => n++);
    expect(b.value("1+1", [12], true).text).toBe("1");
    expect(seen).toEqual([["value", "1+1", [12], true]]);
    expect(n).toBe(1);
    b.value("2", [12]);
    expect(seen[1]).toEqual(["value", "2", [12], undefined]);
    expect(n).toBe(2);
  });

  it("counts and forwards ctxGet, ctxSet and parse", () => {
    const { bridge, seen } = standIn();
    let n = 0;
    const b = countingBridge(bridge, () => n++);
    expect(b.ctxGet().angle_mode).toBe(0);
    expect((b.ctxSet({ angle_mode: 1 }) as GiacContext).angle_mode).toBe(1);
    expect(b.parse("x").ok).toBe(true);
    expect(seen).toEqual([["ctxGet"], ["ctxSet", { angle_mode: 1 }], ["parse", "x"]]);
    expect(n).toBe(3);
  });
});
