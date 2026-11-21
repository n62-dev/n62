// SPDX-License-Identifier: GPL-3.0-or-later
// R777f1: the route's one rule of a dead press (route.ts deadPress). For each branch: where it says true, route.run calls the context's
// dead and nothing else; where it says false, the key acts. The real route.run over a stub context, as recallKey.test.ts.
import { describe, expect, test } from "vitest";
import type { HistoryItem } from "../state/session.svelte.ts";

const route = await import("./route.ts");
const { keyboard } = await import("./keyboard.ts");
const { sheetChunk } = await import("../views/sheetView.svelte.ts");
const sheetKeys = await import("../views/sheetKeys.ts");

type Mods = { shift: boolean; alpha: boolean };
const PLAIN: Mods = { shift: false, alpha: false };
const SHIFT: Mods = { shift: true, alpha: false };

function ctx(opts: { statuses?: string[]; app?: boolean; showsEntry?: boolean; filter?: string } = {}) {
  const log: string[] = [];
  const items = (opts.statuses ?? []).map((status, i) => ({ id: i + 1, status, latex: String(i + 1), result: status === "done" ? "r" : undefined }));
  const entry = {
    empty: true,
    fieldPending: false,
    endSelect() {},
    insertAns: () => void log.push("ans"),
    run: (a: { latex?: string; text?: string; name?: string }) => void log.push(`run ${a.latex ?? a.text ?? a.name}`),
    select: () => (log.push("select"), true),
  };
  const session = {
    shift: false,
    alpha: false,
    shiftLock: false,
    settings: { entry: "textbook" },
    items,
    taps: { tap() {} },
    clearModifiers() {},
    hasResult: () => items.some((i) => i.status === "done"),
    formKey: (k: string) => (log.push(`formKey ${k}`), Promise.resolve(true)),
  };
  const level = {
    filter: opts.filter ?? "",
    filterable: true,
    columns: undefined,
    digits: false,
    items: [],
    grid: undefined,
    loading: () => null,
    backspace: () => (log.push("backspace"), false),
  };
  const sheet = { id: "menu", level, disarm() {}, goKey: () => false, pickKey: () => undefined };
  const shell = {
    app: opts.app ? "plot" : null,
    sheet: opts.filter === undefined ? null : sheet,
    sheetPending: null,
    loading: null,
    prompt: null,
    opening: Promise.resolve(),
    showsEntry: opts.showsEntry ?? true,
    nav: (d: string) => (log.push(`nav ${d}`), true),
    undo: () => false,
  };
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
    insertResult() {},
    recallRow: (i: HistoryItem) => void log.push(`recall ${i.id}`),
    goTo() {},
    clearKey() {},
    openSettings() {},
    openMode() {},
    openShiftPalette() {},
    openFind: () => void log.push("openFind"),
    openHelp: () => void log.push("openHelp"),
    openMatrix: () => void log.push("openMatrix"),
    openNames: () => void log.push("openNames"),
    openStore: () => void log.push("openStore"),
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
  const dead = (id: string, mods = PLAIN): boolean => route.deadPress(c as never, key(id), mods);
  /** run the key and return what happened (the log after it). */
  const run = (id: string, mods = PLAIN): string[] => {
    log.length = 0;
    route.run(c as never, key(id), mods);
    return [...log];
  };
  return { c, log, dead, run, entry, session, shell, level };
}

describe("deadPress: Home and CAS", () => {
  test("Fmt: dead with no result, acting once there is a row", () => {
    const a = ctx();
    expect(a.dead("fmt")).toBe(true);
    expect(a.run("fmt")).toEqual(["dead"]);
    const b = ctx({ statuses: ["done"] });
    expect(b.dead("fmt")).toBe(false);
    expect(b.run("fmt")).toEqual(["formKey cycleFormat"]);
  });
  test("Store ▶ with nothing on the line and no result is dead; with a result, or text on the line, it acts", () => {
    const a = ctx();
    expect(a.dead("emark", SHIFT)).toBe(true);
    expect(a.run("emark", SHIFT)).toEqual(["dead"]);
    const b = ctx({ statuses: ["done"] });
    expect(b.dead("emark", SHIFT)).toBe(false);
    expect(b.run("emark", SHIFT)).not.toContain("dead");
    const t = ctx();
    t.entry.empty = false;
    expect(t.dead("emark", SHIFT)).toBe(false);
    expect(t.run("emark", SHIFT)).toContain("openStore");
  });
  test("◀ on a picked row: dead while it runs with an empty line, recalled when finished, the caret's when the line has text", () => {
    const a = ctx({ statuses: ["done", "pending"] });
    a.c.picked = 1;
    expect(a.dead("left")).toBe(true);
    expect(a.run("left")).toEqual(["dead"]);
    expect(a.c.picked).toBeNull();
    const b = ctx({ statuses: ["done", "done"] });
    b.c.picked = 1;
    expect(b.dead("left")).toBe(false);
    expect(b.run("left")).toEqual(["recall 2"]);
    const t = ctx({ statuses: ["pending"] });
    t.c.picked = 0;
    t.entry.empty = false;
    expect(t.dead("left")).toBe(false);
    expect(t.run("left")).toEqual(["run moveToPreviousChar"]);
  });
  test("Store ▶ on a picked row: dead while the row has no result, storing a finished one", () => {
    const a = ctx({ statuses: ["pending"] });
    a.c.picked = 0;
    expect(a.dead("emark", SHIFT)).toBe(true);
    expect(a.run("emark", SHIFT)).toEqual(["dead"]);
    const b = ctx({ statuses: ["done"] });
    b.c.picked = 0;
    expect(b.dead("emark", SHIFT)).toBe(false);
    expect(b.run("emark", SHIFT)).toEqual(["storeRow 1"]);
  });
});

describe("deadPress: an app", () => {
  test("Fmt and Ans are dead in an app with an entry line, live on Home", () => {
    const a = ctx({ app: true, statuses: ["done"] });
    expect(a.dead("fmt")).toBe(true);
    expect(a.run("fmt")).toEqual(["dead"]);
    expect(a.dead("add", SHIFT)).toBe(true);
    expect(a.run("add", SHIFT)).toEqual(["dead"]);
    expect(a.dead("d7")).toBe(false);
    expect(a.run("d7")).toEqual(["run 7"]);
    const h = ctx({ statuses: ["done"] });
    expect(h.dead("add", SHIFT)).toBe(false);
  });
  test("Plot: every command and key that needs the line is dead; the four arrows are not asked and the shell takes them", () => {
    const p = ctx({ app: true, showsEntry: false });
    const deadKeys: [string, Mods][] = [
      ["bksp", PLAIN], // backspace
      ["bksp", SHIFT], // Del
      ["undo", PLAIN],
      ["redo", PLAIN],
      ["undo", SHIFT], // line start
      ["redo", SHIFT], // line end
      ["d7", PLAIN],
      ["select", PLAIN],
      ["deselect", PLAIN],
      ["deselect", SHIFT], // Paste
      ["math", PLAIN],
      ["help", PLAIN],
    ];
    for (const [id, m] of deadKeys) {
      const name = `${m.shift ? "Shift + " : ""}${id}`;
      expect(p.dead(id, m), name).toBe(true);
      expect(p.run(id, m), name).toEqual(["dead"]);
    }
    for (const id of ["up", "down", "left", "right"]) {
      expect(p.dead(id), id).toBe(false);
      expect(p.run(id), id).toEqual([`nav ${id}`]);
    }
  });
  test("an arrow the shell does not take is still a dead press in Plot, called by the route", () => {
    const p = ctx({ app: true, showsEntry: false });
    p.shell.nav = () => false;
    expect(p.dead("left")).toBe(false);
    expect(p.run("left")).toEqual(["dead"]);
  });
});

describe("deadPress: an open sheet", () => {
  test("⌫ with nothing typed in a list that is not Find's is dead; with a letter typed it deletes", async () => {
    sheetChunk.keys = sheetKeys;
    try {
      const a = ctx({ filter: "" });
      expect(a.dead("bksp")).toBe(true);
      expect(route.sheetPress(a.c as never, keyboard.byId.get("bksp")!, undefined)).toBe(true);
      expect(a.log).toEqual(["dead"]);
      const b = ctx({ filter: "s" });
      expect(b.dead("bksp")).toBe(false);
      expect(route.sheetPress(b.c as never, keyboard.byId.get("bksp")!, undefined)).toBe(true);
      expect(b.log).toEqual(["backspace"]);
      const f = ctx({ filter: "" });
      f.c.shell.sheet = { ...f.c.shell.sheet!, id: "find" } as never;
      expect(f.dead("bksp")).toBe(false); // Find goes back a level
    } finally {
      sheetChunk.keys = null;
    }
  });
});
