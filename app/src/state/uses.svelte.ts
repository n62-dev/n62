// SPDX-License-Identifier: GPL-3.0-or-later
// The results mode's counter (R53; decisions.md P16's removal test): named counts plus a `since` date, after R9's tap
// counter (taps.svelte.ts), under its own IndexedDB key `uses`. Counted on the device only, never sent, and not in a
// backup (backup.ts LEFT_OUT: it judges this install's use). Its own chunk: App.svelte loads it on the first fold, and
// Settings › Counters › Results mode reads it. Counted names: `fold.swipe` (each fold by the swipe), `fold.hw` (by the desktop key, R131), `pick` (a row
// picked by a tap while folded) and each row action run while folded (`insert`, `recall`, `copy`, `store`, `delete`).
// P16's test reads the folds (`fold.swipe` and `fold.hw`, plus `fold.handle`: counts stored before R283 removed the handle stay in the total) and the actions' sum after 14 days from `since`.
import type { Kv } from "./storage.ts";

export const USES_KEY = "uses";
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
  readonly ready: Promise<void>;

  constructor(kv: Kv, now: () => Date = () => new Date()) {
    this.kv = kv;
    this.now = now;
    this.ready = kv.get<unknown>(USES_KEY).then((v) => {
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

  reset(): void {
    this.wasReset = true;
    this.state = { counts: {}, since: this.today() };
    this.schedule();
  }

  /** Write now (tests; the app writes after SAVE_MS). */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    await this.ready;
    await this.kv.set(USES_KEY, $state.snapshot(this.state));
  }

  private today(): string {
    return this.now().toISOString().slice(0, 10);
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_MS);
  }
}
