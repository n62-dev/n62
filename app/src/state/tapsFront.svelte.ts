// SPDX-License-Identifier: GPL-3.0-or-later
// R320: the session's press counters as the start chunk holds them. The counter (taps.svelte.ts) and the rules that name a
// press (pressCount.ts) are a lazy chunk, loaded when the browser is idle (App.svelte, as the key names, R41), by the first
// read of the counts, or by the first start's tips; until it is in, each press waits here as it came (a keypad touch with
// its Shift and Alpha state, a hardware key's name, a screen tap's event), and the chunk names and counts them once, in
// order. TapCounter already adds what was counted before the stored counts arrive, so the replay takes that path.
import type { Kv } from "./storage.ts";
import type { FinishedTouch, HwKind } from "./pressCount.ts";
import type { TapCounter, TapCounts } from "./taps.svelte.ts";

type Op = (c: TapCounter) => void;
const NONE: TapCounts = { shift: 0, alpha: 0, presses: 0, presets: 0, keys: {}, since: "" };

export class Taps {
  /** The counter, once its chunk is in (reactive). */
  counter = $state.raw<TapCounter>();
  private readonly ops: Op[] = [];
  private loading: Promise<TapCounter | undefined> | undefined;
  private readonly kv: Kv;

  constructor(kv: Kv) {
    this.kv = kv;
  }

  /** Load the counter (once; a failed load is tried again by the next call) and replay the presses that waited. */
  load(): Promise<TapCounter | undefined> {
    return (this.loading ??= import("./taps.svelte.ts").then(
      (m) => {
        const c = new m.TapCounter(this.kv);
        for (const op of this.ops.splice(0)) op(c);
        return (this.counter = c);
      },
      () => (this.loading = undefined),
    ));
  }

  /** The counts (Settings › Counters, the presets' row); all zero until the counter is in, which this read asks for. */
  get counts(): TapCounts {
    void this.load();
    return this.counter?.counts ?? NONE;
  }
  /** A press happened in this start (R266), as the counter knows it: false until it is in (the first tips wait for it). */
  get pressedThisStart(): boolean {
    return this.counter?.pressedThisStart === true;
  }

  private run(op: Op): void {
    if (this.counter) op(this.counter);
    else this.ops.push(op);
  }
  /** A press already named: a hardware key (`<key id>:hw`, `hw:<kind>`, a desktop key's name). */
  press(key?: string): void {
    this.run((c) => c.press(key));
  }
  /** A hardware key that runs no keypad key (`letter`, `symbol`, `dead`, `other`): the chunk names it (pressCount.ts hwKind). */
  hw(kind: HwKind): void {
    this.run((c) => c.hw(kind));
  }
  /** A finished keypad touch, as Keypad.svelte holds it, with the layer the pad showed (the counter names it). */
  touch = (g: FinishedTouch, layer: { shift: boolean; alpha: boolean }): void => this.run((c) => c.touch(g, layer));
  /** A click or touchend anywhere on the page (listen below). */
  screen = (ev: Event): void => this.run((c) => c.screen(ev));
  tap(key: "shift" | "alpha" | "presets"): void {
    this.run((c) => c.tap(key));
  }
  reset(): void {
    this.run((c) => c.reset());
  }

  /** Count every tap on the screen (a history row, a Find result, a chip, a menu item). The click is captured, so the count
   *  is in before the tap's own handler runs (Reset then zeroes it; a Settings tap counts itself). R159f1: a control that
   *  cancels its touchend (the unit chips, which pick on pointerup) gets no click, so its touchend counts; bubbling, so the
   *  control's own listener has run and `defaultPrevented` tells that no click follows. Returns the cleanup. */
  listen(): () => void {
    document.addEventListener("click", this.screen, true);
    document.addEventListener("touchend", this.screen);
    return () => {
      document.removeEventListener("click", this.screen, true);
      document.removeEventListener("touchend", this.screen);
    };
  }
}

/** A hardware key's handler that counts the press first (docs/04 5.2: every key press counts 1; `count` gets the handler's
 *  own arguments, R127). Its last argument is the event's KeyboardEvent.repeat: a held key counts once, so an auto-repeat
 *  runs the key again but counts nothing (R70f1). */
export function counted<A extends unknown[]>(count: (...a: NoInfer<A>) => void, run: (...a: A) => void): (...a: [...A, repeat: boolean]) => void {
  return (...a) => {
    const args = a.slice(0, -1) as A;
    if (a[a.length - 1] !== true) count(...args);
    run(...args);
  };
}
