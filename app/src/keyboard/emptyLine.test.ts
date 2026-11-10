// SPDX-License-Identifier: GPL-3.0-or-later
// R255: keys pressed before MathLive's field is up wait in the entry's queue; the keys that act on an empty line (an
// operator's Ans, a b/c's form cycle, ▲'s pick, Undo's restore) must see that queue, and a kept line still to come
// (R34), as text on the line. The real route.press and EntryController, a stub context (no MathLive, no field).
import { describe, expect, test, vi } from "vitest";

// MathLive never arrives here: the field stays down for the whole test, as in the first moments of a cold start
vi.mock("../render/mathlive.svelte.ts", () => ({ mathlive: { load: () => new Promise(() => {}) } }));
vi.mock("../entry/field.ts", () => ({}));
vi.mock("../entry/hwkeys.ts", () => ({}));
// R255f1: the unit view's chunk, a spy here (it would need the page's entry line)
const { openUnits } = vi.hoisted(() => ({ openUnits: vi.fn(async () => {}) }));
vi.mock("../units/open.ts", () => ({ openUnits }));

const { EntryController } = await import("../entry/controller.ts");
const route = await import("./route.ts");
const { keyboard, actionFor } = await import("./keyboard.ts");
const { ANS_CHIP } = await import("../entry/macros.ts");

type Queued = { kind: string; text?: string; latex?: string; name?: string };
type Inner = { pendingValue?: string; queue: Queued[] };

function ctx(stored = true) {
  const log: string[] = [];
  const entry = new EntryController();
  const session = {
    shift: false,
    alpha: false,
    shiftLock: false,
    settings: { entry: "textbook" },
    items: stored ? [{ id: 1, status: "done", latex: "7" }] : [],
    taps: { tap() {} },
    clearModifiers() {},
    hasResult: () => stored,
    undoRemoved: () => (log.push("undoRemoved"), false),
    cycleForm: async () => (log.push("cycleForm"), true),
  };
  const shell = { app: null, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true };
  const c = { session, shell, entry, picked: null as number | null, sheetLoad: null, waiting: [], casKeys: false, enter() {}, insertResult() {}, recallRow() {}, goTo() {}, clearKey() {}, openSettings() {}, openMode() {}, openTemplates() {}, openShiftPalette() {}, openFind() {}, openNames() {}, withClip() {}, loadClip() {}, dead: () => void log.push("dead"), unfold: () => false };
  const press = (...ids: string[]): void => {
    for (const id of ids) {
      const key = keyboard.byId.get(id);
      if (!key) throw new Error(`no key ${id}`);
      route.press(c as never, key);
    }
  };
  const inner = entry as unknown as Inner;
  const queued = (): (string | undefined)[] => inner.queue.map((a) => a.text ?? a.latex ?? a.name);
  return { c, entry, log, press, inner, queued };
}
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("a line queued before the field is up is not empty (R255)", () => {
  test("2 + 3: no Ans goes in front of the queued 2", () => {
    const { press, inner, queued } = ctx();
    press("d2", "add", "d3");
    expect(inner.pendingValue).toBeUndefined();
    expect(queued()).toEqual(["2", "+", "3"]);
    expect(queued()).not.toContain(ANS_CHIP);
  });
  test("2 a b/c 3: the fraction goes on the queue, no form cycle of the last row", () => {
    const { press, log, inner } = ctx();
    press("d2", "frac", "d3");
    const frac = keyboard.byId.get("frac");
    expect(frac).toBeDefined();
    expect(inner.queue[1]).toEqual(frac && actionFor(frac, false, false));
    expect(inner.queue).toHaveLength(3);
    expect(log).not.toContain("cycleForm");
  });
  test("2 ▲: no row is picked, the move waits with the 2", () => {
    const { c, press, queued } = ctx();
    press("d2", "up");
    expect(c.picked).toBeNull();
    expect(queued()).toEqual(["2", "moveUp"]);
  });
  test("2 Undo: the line's own undo, not the restore of a cleared history", () => {
    const { press, log } = ctx();
    press("d2", "undo");
    expect(log).not.toContain("undoRemoved");
  });
  test("a kept line still to come (the store has not answered): + waits for it, no Ans", () => {
    const { entry, press, queued } = ctx();
    void entry.load(new Promise(() => {}));
    expect(entry.empty).toBe(false);
    press("add");
    expect(queued()).toEqual(["+"]);
  });
  test("a kept line the store answered with: + goes after it, no Ans", async () => {
    const { entry, press, queued } = ctx();
    void entry.load(Promise.resolve({ latex: "5", chips: {} }));
    await tick();
    expect(entry.empty).toBe(false);
    press("add", "d3");
    expect(queued()).toEqual(["+", "3"]);
  });
  test("Esc's clear drops the queue and the kept line still to come: the line is empty again", async () => {
    const { entry, press } = ctx();
    void entry.load(Promise.resolve({ latex: "5", chips: {} }));
    await tick();
    press("d2");
    entry.clear();
    expect(entry.empty).toBe(true);
  });
});

describe("controls: a truly empty line keeps its empty-line jobs before the field is up", () => {
  test("+ starts with Ans", () => {
    const { press, inner } = ctx();
    press("add");
    expect(inner.pendingValue).toBe(ANS_CHIP);
  });
  test("a b/c cycles the last row's form", () => {
    const { press, log, inner } = ctx();
    press("frac");
    expect(log).toContain("cycleForm");
    expect(inner.queue).toHaveLength(0);
  });
  test("▲ picks the last row", () => {
    const { c, press } = ctx();
    press("up");
    expect(c.picked).toBe(0);
  });
  test("Undo reaches the restore of what Clear took", () => {
    const { press, log } = ctx();
    press("undo");
    expect(log).toContain("undoRemoved");
  });
  test("the kept line answered with nothing: + starts with Ans", async () => {
    const { entry, press, inner } = ctx();
    void entry.load(Promise.resolve(undefined));
    await tick();
    press("add");
    expect(inner.pendingValue).toBe(ANS_CHIP);
  });
  test("no stored result: + is a bare operator", () => {
    const { press, inner, queued } = ctx(false);
    press("add");
    expect(inner.pendingValue).toBeUndefined();
    expect(queued()).toEqual(["+"]);
  });
});

describe("the units key reads the line only once the field is up (R255f1)", () => {
  const tmpl = keyboard.byId.get("tmpl");
  const unitsKey = (c: unknown): void => {
    if (!tmpl) throw new Error("no key tmpl");
    route.press(c as never, tmpl, "shift"); // a flick up on Tmpl: the units key
  };
  test("5 then the units key: the unit view does not open on a line without the 5", async () => {
    openUnits.mockClear();
    const { c, press, queued } = ctx();
    press("d5");
    unitsKey(c);
    await vi.dynamicImportSettled();
    await tick();
    expect(openUnits).not.toHaveBeenCalled();
    expect(queued()).toEqual(["5"]);
    expect(c.waiting).toHaveLength(1);
    press("d6"); // a key after it waits behind it, not on the line under the unit view
    expect(queued()).toEqual(["5"]);
    expect(c.waiting).toHaveLength(2);
  });
  test("▲ then the units key: the picked row's unit view waits for the field too", async () => {
    openUnits.mockClear();
    const { c, press } = ctx();
    press("up");
    expect(c.picked).toBe(0);
    unitsKey(c);
    await vi.dynamicImportSettled();
    await tick();
    expect(openUnits).not.toHaveBeenCalled();
    expect(c.waiting).toHaveLength(1);
  });
});
