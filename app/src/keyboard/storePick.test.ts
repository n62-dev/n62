// SPDX-License-Identifier: GPL-3.0-or-later
// R280 (sd-2, docs/archive/store-design.md section 5): with a history row picked, Store ▶ (Shift + ᴇ, or its flick up)
// stores that row as the row bar's Store ▶ does (ClipActions.storeRow: its chip and ▶), not Ans, and the pick ends.
// Without a pick it is unchanged: Ans ▶ on an empty line (docs/04 2.8). The real route.press, a stub context.
import { describe, expect, test } from "vitest";
import type { HistoryItem } from "../state/session.svelte.ts";
import type { Layer } from "./keyboard.ts";

const route = await import("./route.ts");
const { keyboard } = await import("./keyboard.ts");

function ctx(statuses: string[] = ["done", "done", "done"]) {
  const log: string[] = [];
  const items = statuses.map((status, i) => ({ id: i + 1, status, latex: String(i + 1) }));
  let line = "";
  const entry = {
    get empty() {
      return line === "";
    },
    get value() {
      return line;
    },
    fieldPending: false,
    endSelect() {},
    insertAns: () => void ((line += "Ans"), log.push("ans")),
    run: (a: { latex?: string; text?: string; name?: string }) => void ((line += a.latex ?? a.text ?? ""), log.push(`run ${a.latex ?? a.text ?? a.name}`)),
  };
  const session = {
    shift: false,
    alpha: false,
    shiftLock: false,
    settings: { entry: "textbook" },
    items,
    taps: { tap() {} },
    clearModifiers() {
      session.shift = false;
    },
    hasResult: () => items.some((i) => i.status === "done"),
  };
  const shell = { app: null, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true };
  const clip = { storeRow: (row?: HistoryItem): boolean => (log.push(`storeRow ${row?.id}`), true) };
  const c = {
    session,
    shell,
    entry,
    picked: null as number | null,
    sheetLoad: null,
    waiting: [],
    casKeys: false,
    enter() {},
    insertResult: (i: HistoryItem) => void log.push(`insert ${i.id}`),
    recallRow() {},
    goTo() {},
    clearKey() {},
    openSettings() {},
    openMode() {},
    openTemplates() {},
    openShiftPalette() {},
    openFind() {},
    openNames() {},
    openStore: (row?: HistoryItem) => void log.push(`openStore ${row?.id}`),
    withClip: (run: (x: typeof clip) => void) => run(clip),
    loadClip() {},
    dead: () => void log.push("dead"),
    unfold: () => false,
  };
  const key = (id: string) => {
    const k = keyboard.byId.get(id);
    if (!k) throw new Error(`no key ${id}`);
    return k;
  };
  const press = (id: string, layer?: Layer): void => route.press(c as never, key(id), layer);
  /** Shift + ᴇ by two taps (the one-shot Shift is the session's). */
  const shiftStore = (): void => {
    session.shift = true;
    press("emark");
  };
  return { c, log, press, shiftStore, line: () => line };
}

describe("Store ▶ on a picked row (R280)", () => {
  test("▲ ▲ ▲, Shift + ᴇ: the first row is stored, not Ans, and the pick ends", () => {
    const { c, log, press, shiftStore, line } = ctx();
    press("up");
    press("up");
    press("up");
    expect(c.picked).toBe(0);
    shiftStore();
    expect(log).toEqual(["storeRow 1"]);
    expect(line()).toBe(""); // no Ans ▶ typed by the key itself (storeRow puts the chip and ▶)
    expect(c.picked).toBeNull();
  });
  test("the flick up on ᴇ does the same", () => {
    const { c, log, press } = ctx();
    press("up");
    press("up");
    press("emark", "shift");
    expect(log).toEqual(["storeRow 2"]);
    expect(c.picked).toBeNull();
  });
  test("a picked row without a result: nothing is stored, the double haptic, no Ans", () => {
    const { c, log, press, shiftStore } = ctx(["done", "error"]);
    press("up");
    expect(c.picked).toBe(1);
    shiftStore();
    expect(log).toEqual(["dead"]);
    expect(c.picked).toBeNull();
  });
  test("without a pick: unchanged, Ans ▶ on the empty line", () => {
    const { log, shiftStore, line } = ctx();
    shiftStore();
    expect(log).toEqual(["ans", "run \\blacktriangleright", "openStore 3"]); // R281: "Store in" for Ans's row
    expect(line()).toBe("Ans\\blacktriangleright");
  });
  test("ᴇ alone on a picked row keeps its job (drops the pick, types E)", () => {
    const { c, log, press } = ctx();
    press("up");
    press("emark");
    expect(log.some((l) => l.startsWith("storeRow"))).toBe(false);
    expect(c.picked).toBeNull();
  });
});
