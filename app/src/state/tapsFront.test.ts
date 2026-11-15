// SPDX-License-Identifier: GPL-3.0-or-later
// R320: the press counters (taps.svelte.ts, pressCount.ts) are a lazy chunk; until it is in, the session's `taps` is a front
// that queues every press as it came (a raw keypad touch, a hardware key's name, a screen tap's event) and replays them once.
import { describe, expect, it } from "vitest";
import { fakeKv } from "./fakeKv.ts";
import { TAPS_KEY } from "./taps.svelte.ts";
import { Taps } from "./tapsFront.svelte.ts";

/** A stand-in element that answers `closest` for the selectors it is given. */
const el = (...inside: string[]) => ({ closest: (sel: string) => (inside.some((s) => sel.includes(s)) ? {} : null) });
const ev = (type: string, target: unknown, defaultPrevented = false) => ({ type, target, defaultPrevented }) as unknown as Event;
const tap = (id: string) => ({ kind: "key" as const, key: { id }, flick: { state: "tap" as const } });
const up = { shift: false, alpha: false };

describe("the press counters' front (R320)", () => {
  it("counts each press made before the counter's chunk is in once, after it loads: keypad, Shift tap, hardware key, screen tap", async () => {
    const kv = fakeKv([[TAPS_KEY, { shift: 1, alpha: 0, presses: 3, presets: 0, keys: { "d7:primary": 3 }, since: "2026-11-01" }]]);
    const taps = new Taps(kv);
    expect(taps.counter).toBeUndefined();
    expect(taps.pressedThisStart).toBe(false);
    taps.touch(tap("d7"), up); // a keypad tap
    taps.touch(tap("shift"), up); // a Shift tap: a press of the key ...
    taps.tap("shift"); // ... and the Shift count (route.ts)
    taps.touch(tap("d7"), { shift: true, alpha: false }); // named in the layer of the lift
    taps.touch({ kind: "key", key: { id: "d8" }, flick: { state: "cancelled" } }, up); // no press
    taps.touch({ kind: "pad", key: undefined, steps: { count: 4 } }, up); // a drag: one press
    taps.press("enter:hw"); // a hardware key
    taps.screen(ev("click", el("button"))); // a screen tap
    taps.screen(ev("click", el("button", "[data-key]"))); // a keypad key's click: its gesture counted it
    taps.screen(ev("touchend", el("button"))); // a touchend that a click follows: nothing
    taps.screen(ev("touchend", el("[role=button]"), true)); // a cancelled touchend (R159f1): the tap
    expect(taps.counter).toBeUndefined();
    const c = await taps.load();
    expect(c).toBe(taps.counter);
    expect(taps.pressedThisStart).toBe(true);
    await c!.ready;
    expect(taps.counts).toEqual({
      shift: 2,
      alpha: 0,
      presses: 3 + 7,
      presets: 0,
      keys: { "d7:primary": 4, "shift:primary": 1, "d7:shift": 1, "trackpad:drag": 1, "enter:hw": 1, "screen:button": 2 },
      since: "2026-11-01",
    });
    expect(await taps.load()).toBe(c); // one counter
    taps.touch(tap("d7"), { shift: false, alpha: true }); // once in, at once
    expect(taps.counts.keys["d7:alpha"]).toBe(1);
  });

  it("a Reset before the load is replayed in its place: the presses before it and the stored counts are dropped", async () => {
    const kv = fakeKv([[TAPS_KEY, { shift: 5, alpha: 7, presses: 9, since: "2026-11-01" }]]);
    const taps = new Taps(kv);
    taps.press("d1:primary");
    taps.reset();
    taps.press("d2:primary");
    const c = await taps.load();
    await c!.ready;
    expect(taps.counts).toMatchObject({ shift: 0, alpha: 0, presses: 1, keys: { "d2:primary": 1 } });
  });

  it("no press, no flag; reading the counts starts the load", async () => {
    const taps = new Taps(fakeKv());
    expect(taps.counts.presses).toBe(0);
    const c = await taps.load();
    expect(c?.pressedThisStart).toBe(false);
    expect(taps.pressedThisStart).toBe(false);
  });
});
