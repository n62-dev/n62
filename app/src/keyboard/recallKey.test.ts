// SPDX-License-Identifier: GPL-3.0-or-later
// R720: ◀ on a picked history row with an empty line puts the row's input back on the line (a running row: a dead press);
// with text on the line ◀ is unchanged (R273's rule for Enter), and with no pick it moves the caret. The real route.press, a stub context.
import { describe, expect, test } from "vitest";
import type { HistoryItem } from "../state/session.svelte.ts";

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
    setLine: (v: string) => void (line = v),
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
    recallRow: (i: HistoryItem) => void log.push(`recall ${i.id}`),
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
  const press = (id: string): void => route.press(c as never, key(id));
  return { c, log, press, entry, line: () => line };
}

describe("◀ on a picked row (R720)", () => {
  test("▲ ▲ ◀ with an empty line: the row's input comes back and the pick is dropped", () => {
    const { c, log, press } = ctx();
    press("up");
    press("up");
    press("left");
    expect(log).toEqual(["recall 2"]);
    expect(c.picked).toBeNull();
  });
  test("an error row is recalled too", () => {
    const { c, log, press } = ctx(["done", "error"]);
    press("up");
    press("left");
    expect(log).toEqual(["recall 2"]);
    expect(c.picked).toBeNull();
  });
  test("a running row: a dead press, nothing recalled", () => {
    const { log, press } = ctx(["done", "pending"]);
    press("up");
    press("left");
    expect(log).toEqual(["dead"]);
  });
  test("with text on the line ◀ is unchanged: no recall, the caret moves", () => {
    const { c, log, press, entry } = ctx();
    press("up");
    entry.setLine("5");
    press("left");
    expect(log.some((l) => l.startsWith("recall"))).toBe(false);
    expect(log).toContain("run moveToPreviousChar");
    expect(c.picked).toBeNull();
  });
  test("with no pick ◀ moves the caret", () => {
    const { log, press } = ctx();
    press("left");
    expect(log).toEqual(["run moveToPreviousChar"]);
  });
});
