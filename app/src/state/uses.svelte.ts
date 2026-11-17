// SPDX-License-Identifier: GPL-3.0-or-later
// The results mode's counter (R53; decisions.md P16's removal test): named counts plus a `since` date, after R9's tap
// counter (taps.svelte.ts), under its own IndexedDB key `uses`. Counted on the device only, never sent, and not in a
// backup (backup.ts LEFT_OUT: it judges this install's use). Its own chunk: App.svelte loads it on the first fold, and
// Settings › Counters › Removal tests › Results mode reads it. Counted names: `fold.swipe` (each fold by the swipe), `fold.hw` (by the desktop key, R131), `pick` (a row
// picked by a tap while folded) and each row action run while folded (`insert`, `recall`, `copy`, `store`, `delete`), and `store.new`: New name… on the store sheet, which brings the keys up (R740; not an action of the sum).
// R722: a second counter of this class under its own key `bar-uses` (its own `since` and Reset, so the results mode's
// 14 days never start on an angle tap): `bar.angle` (each tap on the bar's angle chip) and `bar.angle.undo` (a tap within
// 3 s of the one before, which takes it back; decisions.md "The bar on the keypad"), read in Settings › Counters › Angle chip.
// P16's test reads the folds (`fold.swipe` and `fold.hw`, plus `fold.handle`: counts stored before R283 removed the handle stay in the total) and the actions' sum after 14 days from `since`.
import type { Kv } from "./storage.ts";

export const USES_KEY = "uses";
export const BAR_USES_KEY = "bar-uses";
export type UseKey = typeof USES_KEY | typeof BAR_USES_KEY;
/** A tap this soon after the one before undoes it (R722). */
export const UNDO_MS = 3000;
/** Writes wait this long, so a burst is one IndexedDB write. */
const SAVE_MS = 1000;
/** The row actions counted while folded (decisions.md P16: under 10 in 14 days, the mode goes). */
export const FOLDED_ACTIONS = ["insert", "recall", "copy", "store", "delete"] as const;

export interface UseCounts {
  counts: Record<string, number>;
  /** When counting started (ISO date: the first count or the last reset). */
  since: string;
}

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

export class UseCounter {
  state = $state<UseCounts>({ counts: {}, since: "" });
  private timer: ReturnType<typeof setTimeout> | undefined;
  private wasReset = false;
  private readonly kv: Kv;
  private readonly now: () => Date;
  private readonly key: UseKey;
  /** When `countTap`'s name was last counted (ms), until a tap undoes it; never stored. */
  private readonly tapAt = new Map<string, number>();
  readonly ready: Promise<void>;

  constructor(kv: Kv, now: () => Date = () => new Date(), key: UseKey = USES_KEY) {
    this.kv = kv;
    this.now = now;
    this.key = key;
    this.ready = kv.get<unknown>(key).then((v) => {
      if (this.wasReset || typeof v !== "object" || v === null) return;
      const o = v as Record<string, unknown>;
      const stored = typeof o["counts"] === "object" && o["counts"] !== null ? (o["counts"] as Record<string, unknown>) : {};
      const counts = { ...this.state.counts };
      for (const [k, n] of Object.entries(stored)) if (isCount(n)) counts[k] = (counts[k] ?? 0) + n; // counts made before the load are added
      this.state = { counts, since: typeof o["since"] === "string" && o["since"] ? o["since"] : this.state.since };
    });
  }

  /** How often `name` was counted. */
  get(name: string): number {
    return this.state.counts[name] ?? 0;
  }

  /** The folds: swipes, the desktop key's (R131), and the stored counts of the handle R283 removed. */
  get folds(): number {
    return this.get("fold.handle") + this.get("fold.swipe") + this.get("fold.hw");
  }

  /** The row actions run while folded. */
  get actions(): number {
    return FOLDED_ACTIONS.reduce((n, a) => n + this.get(a), 0);
  }

  count(name: string): void {
    const s = this.state;
    this.state = { counts: { ...s.counts, [name]: (s.counts[name] ?? 0) + 1 }, since: s.since || this.today() };
    this.schedule();
  }

  /** R722: count a tap on `name` made at `at` (ms), and `name.undo` when it comes within UNDO_MS of the counted tap before;
   *  an undoing tap is not itself undone by the next. */
  countTap(name: string, at: number): void {
    const before = this.tapAt.get(name);
    const undo = before !== undefined && at - before < UNDO_MS;
    if (undo) this.tapAt.delete(name);
    else this.tapAt.set(name, at);
    this.count(name);
    if (undo) this.count(`${name}.undo`);
  }

  reset(): void {
    this.wasReset = true;
    this.tapAt.clear();
    this.state = { counts: {}, since: this.today() };
    this.schedule();
  }

  /** Write now (tests; the app writes after SAVE_MS). */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.ready;
    const s = $state.snapshot(this.state);
    // each key written by name, so the backup's guard (backup.test.ts) finds both
    if (this.key === BAR_USES_KEY) await this.kv.set(BAR_USES_KEY, s);
    else await this.kv.set(USES_KEY, s);
  }

  private today(): string {
    return this.now().toISOString().slice(0, 10);
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_MS);
  }
}
