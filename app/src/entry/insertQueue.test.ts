// SPDX-License-Identifier: GPL-3.0-or-later
// R298 (night review 2026-11-14, vr-1, vr-5): before MathLive's field is up, keys wait in the entry's queue; an insert
// made then (Paste, a result chip, a Find constant, the store sheet's name, Store ▶'s arrow) must take its place among
// them, so the field gets the line in the order pressed (decisions.md R8). The real route.press and EntryController, a
// stub context; the field is a fake that appends what it is given, released by the test.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import type { ActionBody } from "../keyboard/keyboard.ts";

/** The fake field: its value is the text of every action and insert, in the order they reach it. */
class FakeField {
  value = "";
  insert(latex: string): void {
    this.value += latex;
  }
  focus(): void {}
  executeCommand(): void {}
  addEventListener(): void {}
}
let release = (): void => {};
vi.mock("../render/mathlive.svelte.ts", () => ({
  mathlive: { load: () => new Promise<{ MathfieldElement: unknown }>((r) => (release = () => r({ MathfieldElement: FakeField }))) },
}));
vi.mock("./field.ts", () => ({
  makeField: async () => new FakeField(),
  runOnField: (mf: FakeField, a: ActionBody) => void (mf.value += a.kind === "type" ? a.text : a.kind === "insert" ? a.latex : `<${a.kind}>`),
  SelectChain: class {
    end(): void {}
    step(): boolean {
      return false;
    }
  },
  Grown: class {
    clear(): void {}
    add(): void {}
  },
}));
vi.mock("./hwkeys.ts", () => ({ hardwareKey: () => false }));
vi.mock("./namemarks.ts", () => ({ NameMarks: class { setNames(): void {} } }));

const { EntryController } = await import("./controller.ts");
const route = await import("../keyboard/route.ts");
const { keyboard } = await import("../keyboard/keyboard.ts");
const { resChip, constChip } = await import("./macros.ts");

const chip = { value: "5", exact: true };
function ctx(stored = true) {
  const entry = new EntryController();
  const session = {
    shift: false,
    alpha: false,
    shiftLock: false,
    settings: { entry: "textbook" },
    items: stored ? [{ id: 1, status: "done", latex: "5" }] : [],
    taps: { tap() {} },
    toggleShift() {
      this.shift = !this.shift;
    },
    clearModifiers() {
      this.shift = false;
    },
    hasResult: () => stored,
    undoRemoved: () => false,
    cycleForm: async () => true,
  };
  const shell = { app: null, sheet: null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true };
  const c = { session, shell, entry, picked: null, sheetLoad: null, waiting: [], casKeys: false, enter() {}, insertResult() {}, recallRow() {}, goTo() {}, clearKey() {}, openSettings() {}, openMode() {}, openTemplates() {}, openShiftPalette() {}, openFind() {}, openNames() {}, openHelp() {}, openMatrix() {}, openStore() {}, withClip() {}, loadClip() {}, dead() {}, unfold: () => false };
  const press = (...ids: string[]): void => {
    for (const id of ids) {
      const key = keyboard.byId.get(id);
      if (!key) throw new Error(`no key ${id}`);
      route.press(c as never, key);
    }
  };
  /** Bring the field up (the kept line answered with nothing) and return what it holds once the queue is replayed. */
  const up = async (): Promise<string> => {
    const ready = entry.load(Promise.resolve(undefined));
    await new Promise((r) => setTimeout(r, 0));
    release();
    await ready;
    return entry.value;
  };
  return { entry, press, up };
}

describe("an insert before the field keeps its place among the keys (R298)", () => {
  test("2, then a paste of 3: the field gets 23", async () => {
    const { entry, press, up } = ctx();
    press("d2");
    entry.insert("3");
    expect(await up()).toBe("23");
  });
  test("2 ×, a result chip, − 1: the chip sits between × and −", async () => {
    const { entry, press, up } = ctx();
    press("d2", "mul");
    entry.insertResult("5", chip);
    press("sub", "d1");
    expect(await up()).toBe(`2\\times${resChip(1, "5")}-1`);
    expect(entry.chips).toEqual({ "res:1": chip });
  });
  test("a key, then insert, insertResult, insertConst, then a key: the press order", async () => {
    const { entry, press, up } = ctx();
    press("d2");
    entry.insert("3");
    entry.insertResult("5", chip);
    entry.insertConst("c", "c", { value: "299792458", exact: true });
    press("d4");
    expect(await up()).toBe(`23${resChip(1, "5")}${constChip("c", "c")}4`);
  });
  test("5, Store ▶, the store sheet's A: 5▶A", async () => {
    const { entry, press, up } = ctx();
    press("d5", "shift", "emark");
    entry.insert("A");
    expect(await up()).toBe("5\\blacktrianglerightA");
  });
  test("a line with queued keys is not empty, and an insert alone makes it not empty", () => {
    const a = ctx();
    a.press("d2");
    expect(a.entry.empty).toBe(false);
    const b = ctx();
    b.entry.insert("3");
    expect(b.entry.empty).toBe(false);
  });
});

describe("controls", () => {
  test("set() before the field still replaces the line (a recall on an empty line), and a key after it follows", async () => {
    const { entry, press, up } = ctx();
    press("d2");
    entry.insert("3");
    entry.set("9");
    press("d1");
    expect(await up()).toBe("91");
  });
  test("after the field is up, keys and inserts go straight in, in the order made", async () => {
    const { entry, press, up } = ctx();
    expect(await up()).toBe("");
    press("d2");
    entry.insert("3");
    entry.insertResult("5", chip);
    press("sub", "d1");
    expect(entry.value).toBe(`23${resChip(1, "5")}-1`);
  });
  test("a clear before the field drops the queued inserts too", async () => {
    const { entry, press, up } = ctx();
    press("d2");
    entry.insert("3");
    entry.clear();
    press("d4");
    expect(await up()).toBe("4");
  });
});

// vr-5: before the field `entry.value` is not the line (the queued keys are not in it); R255 moved every empty-line
// reader to `entry.empty`, and R298 the last two (App.svelte's recallTapped, route.ts's Enter on a pick)
test('no code in app/src tests `entry.value === ""` (R298: the empty line is `entry.empty`)', () => {
  const src = new URL("..", import.meta.url).pathname;
  const hits: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|svelte)$/.test(name) && !name.endsWith(".test.ts") && /entry\.value\s*===?\s*(""|'')/.test(readFileSync(p, "utf8"))) hits.push(p.slice(src.length));
    }
  };
  walk(src);
  expect(hits).toEqual([]);
});
