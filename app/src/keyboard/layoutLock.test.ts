// SPDX-License-Identifier: GPL-3.0-or-later
// R291, the layout lock (docs/06 section 3b): spec/layout-lock.yaml pins every live key layer and every fixed row of the
// numbered lists; this compares it with the spec and with the lists as the code builds them (no copy of either here).
// A change to a pinned line, or a live line the lock does not know, fails and names the entry. Growth into blank space
// (a reserved line turning live, a row appended after a list's last fixed row) passes once the lock records it.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
vi.mock("../theme.svelte.ts", () => ({ brightness: () => "dark", family: () => "n62" })); // (the page's data-brightness: no document in the test)
import { FunctionApp } from "../apps/function/app.svelte.ts";
import type { Cell } from "../apps/function/engineApi.ts";
import { AppShell } from "../apps/shell.svelte.ts";
import { SolveApp } from "../apps/solve/app.svelte.ts";
import type { AppHost, MenuItem } from "../apps/types.ts";
import { decimalFromRational } from "../engine/rational.ts";
import { makeIndex } from "../find/testIndex.ts";
import type { IndexItem } from "../find/types.ts";
import { unitsMenu, unitViewMenu } from "../units/menu.ts";
import { unitTools } from "../units/tools.ts";
import { cellRows } from "../units/find.ts";
import { statItems } from "../views/statSheet.ts";
import type { Calc } from "../calc/port.ts";
import { FakeCalc } from "../calc/fake.ts";
import { ClipActions } from "../clipboard/actions.svelte.ts";
import type { EntryController } from "../entry/controller.ts";
import type { FindItem } from "../find/types.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { baseItems } from "../views/baseSheet.ts";
import { BAR_ITEMS, FOLDED_APP_BAR_ITEMS, FOLDED_BAR_ITEMS } from "../views/barItems.ts";
import { matrixRows, MATRIX_ROWS } from "../views/matrixSheet.ts";
import { modeItems, settingsSections } from "../views/modeSheet.ts";
import { loadKeyboard, keyboard } from "./keyboard.ts";
import { UserKeys } from "./userKeys.svelte.ts";
import { applyMoves, compareLayout, compareToRelease, decisionsText, layerPins, LIST_BUILDERS, listSlots, modifierPins, paletteSlots, parseLock, releaseLock, UNPINNED_LISTS, type Lock, type Pins } from "./layoutLock.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const LOCK = "spec/layout-lock.yaml";
const read = (p: string): string => readFileSync(join(root, p), "utf8");
const specDoc = (): { keys: Record<string, unknown>[] } => parse(read("spec/keyboard.yaml")) as { keys: Record<string, unknown>[] };
const decisions = decisionsText(root);
const ids = (rows: readonly { id: string }[]): Record<string, string> => listSlots(rows.map((r) => r.id));

/** The Find items by id as the shipped app has them: the generated index, so a row whose Find item is missing there
 *  renumbers the matrix sheet and fails the lock. Without the index (FIND_INDEX not required) the sheet's own ids stand in. */
function findItems(): ReadonlyMap<string, FindItem> {
  const file = join(root, "app/src/find/_gen/find-index.json");
  if (!existsSync(file)) {
    if (process.env["FIND_INDEX"] === "required") throw new Error("layout lock: FIND_INDEX=required but the generated Find index is missing (npm run index)");
    console.info("layout lock: no generated Find index, the matrix rows are stubs");
    return new Map(MATRIX_ROWS.map(({ id }) => [id, { id } as unknown as FindItem]));
  }
  return makeIndex(JSON.parse(readFileSync(file, "utf8")) as IndexItem[]).byId;
}

/** The apps' host, as much as a ☰ reads. */
const appHost = (): AppHost =>
  ({
    settings: { digits: 12, angle: "rad", format: "std", decimalMark: "point" },
    calc: { ready: async () => undefined },
    kv: { get: async () => undefined, set: async () => undefined },
    userNames: [],
    setEntry: () => undefined,
    copy: () => undefined,
    notice: () => undefined,
    paste: () => undefined,
    mode: () => undefined,
  }) as unknown as AppHost;

/** A finished row of `linreg` or `stats1` whose list holds `n` exact values (the sheet's rows follow its call). */
const statRow = (call: string, n: number, full: string): HistoryItem =>
  ({
    id: 1, view: "home", latex: `\\operatorname{${call}}\\left(\\left\\{1,2,3,4\\right\\}\\right)`, status: "done", resultLatex: "", text: "", approximate: true, full, fullExact: true,
    facts: { exact: false, reliableDigits: null, items: Array.from({ length: n }, (_, i) => ({ exact: true, reliableDigits: null, value: { re: decimalFromRational(BigInt(i + 1), 1n), im: decimalFromRational(0n, 1n) } })) },
  }) as unknown as HistoryItem;

/** Every pinned list, built by the code that draws it. Settings' sections are the shipped app's (App.svelte's settingsEnv
 *  gives both userKeys and data, so none is left out). */
async function built(kb = keyboard, find: ReadonlyMap<string, FindItem> = findItems()): Promise<Record<string, Record<string, string>>> {
  const session = new Session(new FakeCalc(), fakeKv());
  const env = { userKeys: new UserKeys(fakeKv()), data: () => {} };
  const clip = new ClipActions({ items: [] } as unknown as Session, { showsEntry: true } as unknown as AppShell, {} as EntryController, { insert() {} });
  const menu = clip.menu();
  const copy = clip.copyItem({ status: "done" } as HistoryItem); // R830: Copy › is the picked row's button
  const shell = new AppShell({} as Calc, fakeKv(), { value: "", set() {}, clear() {} }, () => session.settings);
  shell.toggleApps();
  await shell.sheetPending;
  const item = { status: "done", value: { re: { sign: 1, digits: "255", exp: 0 }, im: { sign: 1, digits: "0", exp: 0 } }, rational: { n: "255", d: "1" } } as unknown as HistoryItem;
  // the apps' ☰ as fixed instances: Plot with an answer (its ninth row, To Home, is there), Solve with an unknown selected (Paste is there)
  const fn = new FunctionApp(appHost());
  fn.readout = { lines: [{ label: "x", value: "1", primary: true, cell: { ok: true } as Cell }], info: "", warn: false };
  const solve = new SolveApp(appHost());
  solve.selected = "x";
  const draw = (el: HistoryItem) => session.display(el);
  const stat = (call: string, n: number): Record<string, string> => ids(statItems(statRow(call, n, `list[${Array.from({ length: n }, (_, i) => i + 1).join(",")}]`), draw, () => {}) ?? []);
  const units = unitsMenu(makeIndex([]), { pick: () => {}, constant: () => {}, tools: [] }).categories;
  return {
    layers: layerPins(kb),
    tmpl: paletteSlots(kb.palette),
    relations: paletteSlots(kb.relations),
    symbols: paletteSlots(kb.symbols),
    chars: paletteSlots(kb.chars),
    "home-menu": ids(menu),
    "home-copy": ids(copy.submenu?.items ?? []),
    mode: ids(modeItems(session, env)),
    settings: ids(settingsSections(session, env)),
    apps: ids(shell.sheet?.level.items ?? []),
    base: ids(baseItems(session, item)),
    matrix: ids(matrixRows(find, (it): MenuItem => ({ id: it.id, label: it.id }), [], () => ({ title: "", items: [] }))),
    "function-symb": ids(fn.menu("symb")),
    "function-plot": ids(fn.menu("plot")),
    "function-num": ids(fn.menu("num")),
    "solve-symb": ids(solve.menu("symb")),
    "solve-num": ids(solve.menu("num")),
    "stat-linreg": stat("linreg", 3),
    "stat-stats1": stat("stats1", 6),
    "units-menu": ids(units),
    "units-cell": ids(cellRows(() => {})),
    // R862: the unit view's ☰, Tools' six rows (with no result: their places are the same, some disabled) and Constants ›
    "units-view": ids(unitViewMenu(makeIndex([]), unitTools({ kind: "none" }, { end() {}, alt() {}, alts() {}, home() {}, store() {}, storeRefused: () => undefined }), () => {})),
    bar: listSlots(BAR_ITEMS),
    "folded-bar": listSlots(FOLDED_BAR_ITEMS),
    "folded-bar-app": listSlots(FOLDED_APP_BAR_ITEMS),
    modifiers: modifierPins(() => new Session(new FakeCalc(), fakeKv())),
  };
}

let lock: Lock;
let actual: Pins;
beforeAll(async () => {
  lock = parseLock(read(LOCK), LOCK);
  actual = await built();
});

const problems = (a: Pins = actual, l: Lock = lock): string[] => compareLayout(a, l, decisions);
/** A copy of the built lists with one section changed. */
const with_ = (section: string, f: (s: Record<string, string>) => Record<string, string>): Pins => ({ ...actual, [section]: f({ ...actual[section] }) });
/** A copy of the lock with one line set (or, for undefined, removed). */
const pinned = (section: string, slot: string, value: string | undefined, moves: Lock["moves"] = lock.moves): Lock => {
  const s = { ...lock.pins[section] };
  if (value === undefined) delete s[slot];
  else s[slot] = value;
  return { pins: { ...lock.pins, [section]: s }, moves };
};
const spec = (edit: (keys: Record<string, unknown>[]) => void): Pins => {
  const doc = specDoc();
  edit(doc.keys);
  return { ...actual, layers: layerPins(loadKeyboard(doc)) };
};
/** A layer taken away: its action and its legend. */
const drop = (keys: Record<string, unknown>[], id: string, layer: string): void => {
  delete key(keys, id)[layer];
  delete (key(keys, id)["label"] as Record<string, string>)[layer];
};
const key = (keys: Record<string, unknown>[], id: string): Record<string, unknown> => keys.find((k) => k.id === id) as Record<string, unknown>;

describe("the layout lock holds the layout as merged", () => {
  it("every pinned line is built as pinned and every live layer and fixed row is pinned", () => {
    expect(problems()).toEqual([]);
  });
  it("the lock has the sections the app builds, and Settings is built with Your keys and Data (a missing one moves the digits after it)", () => {
    expect(Object.keys(lock.pins).sort()).toEqual(Object.keys(actual).sort());
    const sections = Object.values(actual["settings"] ?? {});
    expect(sections).toContain("keys");
    expect(sections).toContain("data");
    expect(problems()).toEqual([]);
  });
  it("the last release's lock (a v* tag that holds it) is kept: nothing live there is missing or edited", () => {
    const rel = releaseLock(root, LOCK);
    if (!rel) return void console.info("layout lock: not checked against a release (no git or no v* tag holds the lock)");
    expect(compareToRelease(rel.tag, rel.lock, lock)).toEqual([]);
  });
});

describe("every numbered list is in the lock (R299)", () => {
  const src = join(root, "app/src");
  /** The source files (under app/src, not tests) that open a sheet or an app's ☰. */
  const openers = (): string[] =>
    (readdirSync(src, { recursive: true }) as string[])
      .filter((f) => /\.(ts|svelte)$/.test(f) && !/\.test\.ts$/.test(f) && !f.includes("_gen"))
      .filter((f) => /\bshowMenu\(|^\s*menu\(view: ViewId\)/m.test(readFileSync(join(src, f), "utf8")))
      .sort();
  const KEYPAD = new Set(["layers", "tmpl", "relations", "symbols", "chars", "modifiers"]);
  it("every file that opens a numbered list is in the registry, or is listed with why its rows have no fixed digit", () => {
    const known = new Set([...Object.values(LIST_BUILDERS).flat(), ...Object.keys(UNPINNED_LISTS)]);
    expect(openers().filter((f) => !known.has(f))).toEqual([]);
  });
  it("every file the registry names exists (a builder or an opener), and every unpinned file opens a list", () => {
    for (const f of Object.values(LIST_BUILDERS).flat()) expect(existsSync(join(src, f)), f).toBe(true);
    const open = new Set(openers());
    for (const f of Object.keys(UNPINNED_LISTS)) expect(open.has(f), f).toBe(true);
  });
  it("a registered file opens no more lists than it has sections (a second showMenu in a registered file is a list the lock does not hold)", () => {
    // calls that open the same list again (App.svelte opens Mode from two places) count once
    const SAME_LIST: Record<string, number> = { "App.svelte": 1 };
    const sections = new Map<string, number>();
    for (const [name, files] of Object.entries(LIST_BUILDERS)) for (const f of files) sections.set(f, (sections.get(f) ?? 0) + (KEYPAD.has(name) ? 0 : 1));
    for (const f of sections.keys()) {
      const calls = (readFileSync(join(src, f), "utf8").match(/\.showMenu\(/g) ?? []).length - (SAME_LIST[f] ?? 0);
      expect(calls, `${f}: ${calls} showMenu calls, ${sections.get(f)} sections registered`).toBeLessThanOrEqual(sections.get(f) ?? 0);
    }
  });
  it("the registry's sections are the lists the test builds and the lock pins, no more and no fewer", () => {
    const lists = (o: object): string[] => Object.keys(o).filter((k) => !KEYPAD.has(k)).sort();
    expect(lists(actual)).toEqual(Object.keys(LIST_BUILDERS).sort());
    expect(lists(lock.pins)).toEqual(Object.keys(LIST_BUILDERS).sort());
  });
  it("the apps' ☰ and the stat sheets are pinned with their rows", () => {
    expect(Object.values(actual["function-plot"] ?? {})).toEqual(["root", "extremum", "intersection", "slope", "area", "default", "copy", "shown", "tohome", "mode"]); // R785: Mode is the next free row of every app view's ☰
    // Mode keeps its tenth place with no answer too: To Home is there, off (docs/06 3b: a key never moves)
    expect(Object.values(ids(new FunctionApp(appHost()).menu("plot")))).toEqual(Object.values(actual["function-plot"] ?? {}));
    expect(Object.values(actual["function-num"] ?? {})).toEqual(["start", "step", "csv", "paste", "mode"]);
    expect(Object.values(actual["solve-num"] ?? {})).toEqual(["solve", "poly", "copy", "shown", "tohome", "paste", "mode"]);
    for (const l of ["function-symb", "solve-symb"]) expect(Object.values(actual[l] ?? {}).at(-1)).toBe("mode");
    expect(Object.values(actual["stat-linreg"] ?? {})).toEqual(["stat.slope", "stat.intercept", "stat.r2"]);
    expect(Object.values(actual["stat-stats1"] ?? {})).toHaveLength(6);
    expect(Object.values(actual["matrix"] ?? {}).at(-1)).toBe("matrix:new");
  });
  it("a matrix row whose Find item is missing from the index renumbers the sheet and fails the lock", async () => {
    const byId = new Map(findItems());
    byId.delete("fn:cross");
    const p = compareLayout(await built(keyboard, byId), lock, decisions);
    expect(p[0]).toBe('matrix/3: pinned "fn:cross", now "fn:norm" ("fn:cross" is gone)'.replace(' ("fn:cross" is gone)', ""));
    expect(p.some((l) => l.startsWith("matrix/9:") || l.startsWith("matrix/8:"))).toBe(true);
  });
});

describe("a pinned key layer cannot change unnoticed (altered copies of the spec)", () => {
  it("a changed action names the entry", () => {
    const p = problems(spec((k) => (key(k, "undo")["primary"] = { special: "esc" })));
    expect(p).toEqual(['layers/undo.primary: pinned "cmd undo", now "special esc"']);
  });
  it("a layer taken away names the entry", () => {
    const p = problems(spec((k) => drop(k, "select", "shift")));
    expect(p.join("\n")).toContain('layers/select.shift: pinned "special copy" is gone');
  });
  it("a layer copied into a reserved cell names that cell", () => {
    const p = problems(
      spec((k) => {
        key(k, "frac")["shift"] = key(k, "select")["shift"];
        (key(k, "frac")["label"] as Record<string, string>)["shift"] = "$key.copy";
      }),
    );
    expect(p).toEqual(['layers/frac.shift: reserved in the lock but live ("special copy"): record the fill in the lock']); // (Shift + a b/c is reserved; R871 filled Shift + Fmt)
  });
  it("a reserved cell turned live is not in the lock yet", () => {
    const p = problems(
      spec((k) => {
        key(k, "d7")["shift"] = { special: "memory" };
        (key(k, "d7")["label"] as Record<string, string>)["shift"] = "$key.memory";
      }),
    );
    expect(p).toEqual(['layers/d7.shift: reserved in the lock but live ("special memory"): record the fill in the lock']);
  });
  it("a layer that was dead and is live has no line in the lock", () => {
    const p = problems(
      spec((k) => {
        key(k, "d0")["alpha"] = { type: "Q" };
        (key(k, "d0")["label"] as Record<string, string>)["alpha"] = "Q";
      }),
    );
    expect(p).toEqual(['layers/d0.alpha: "type Q" is live but not in the lock']);
  });
  it("a key moved to the other layer reads as gone and new", () => {
    const p = problems(
      spec((k) => {
        const pad = key(k, "d5");
        pad["alpha"] = pad["shift"];
        delete pad["shift"];
        (pad["label"] as Record<string, string>)["alpha"] = "[ ]";
        delete (pad["label"] as Record<string, string>)["shift"];
      }),
    );
    expect(p.join("\n")).toContain("layers/d5.shift: pinned");
    expect(p.join("\n")).toContain("layers/d5.alpha:");
  });
});

describe("a numbered list cannot change unnoticed (altered copies of the lists)", () => {
  const rows = (section: string): string[] => Object.values(actual[section] ?? {});
  it("a row gone names its slot, and the rows after it shift into the gap", () => {
    const p = problems(with_("home-menu", (s) => listSlots(rows("home-menu").filter((r) => r !== "share"))));
    expect(p[0]).toBe('home-menu/2: pinned "share", now "clear"');
    expect(p.length).toBeGreaterThan(1);
  });
  it("a row inserted before a pinned row moves it", () => {
    const p = problems(with_("settings", () => listSlots(["extra", ...rows("settings")])));
    expect(p[0]).toBe('settings/1: pinned "mode", now "extra" ("mode" is at 2)'); // (R927: Mode is Settings' row 1)
  });
  it("two rows swapped", () => {
    const r = rows("mode");
    const p = problems(with_("mode", () => listSlots([r[1] as string, r[0] as string, ...r.slice(2)])));
    expect(p).toEqual([`mode/1: pinned "${r[0]}", now "${r[1]}" ("${r[0]}" is at 2)`, `mode/2: pinned "${r[1]}", now "${r[0]}" ("${r[1]}" is at 1)`]);
  });
  it("a row that is the last one goes: its line is gone", () => {
    const r = rows("apps");
    const p = problems(with_("apps", () => listSlots(r.slice(0, -1))));
    expect(p).toEqual([`apps/${r.length}: pinned "${r.at(-1)}" is gone`]);
  });
  it("a row appended after the last fixed row is not in the lock yet", () => {
    const n = rows("base").length + 1;
    expect(problems(with_("base", (s) => ({ ...s, [n]: "bin16" })))).toEqual([`base/${n}: "bin16" is live but not in the lock`]);
  });
  it("a palette cell changed or moved to another place names its place", () => {
    const first = Object.keys(actual["tmpl"] ?? {})[0] as string;
    const p = problems(with_("tmpl", (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => (k === first ? ["9,9", v] : [k, v])))));
    expect(p.join("\n")).toContain(`tmpl/${first}: pinned`);
    expect(p.join("\n")).toContain('tmpl/9,9: ');
  });
  it("a whole list gone or new is named row by row", () => {
    const { matrix: _m, ...rest } = actual;
    expect(problems(rest)[0]).toBe('matrix/1: pinned "fn:tran" is gone');
    expect(problems({ ...actual, extra: { "1": "x" } })).toEqual(['extra/1: "x" is live but not in the lock']);
  });
});

describe("the modifiers are in the lock (R726)", () => {
  it("a second Shift tap that no longer locks names its entry", () => {
    expect(problems(with_("modifiers", (m) => ({ ...m, "shift.tap2": "off" })))).toEqual([expect.stringContaining('modifiers/shift.tap2: pinned "lock", now "off"')]);
  });
  it("the lock holds what a Session does: Shift taps arm, lock, end; the flicks lock; the sign ends a lock", () => {
    const m = lock.pins["modifiers"] ?? {};
    expect([m["shift.tap"], m["shift.tap2"], m["shift.tap3"], m["shift.flickUp"], m["slot.tap"]]).toEqual(["arm", "lock", "off", "lock", "off"]);
  });
});

describe("growth into blank space passes once the lock records it", () => {
  it("a reserved layer that turns live: the lock's line goes from reserved to the action", () => {
    const a = spec((k) => {
      key(k, "d7")["shift"] = { special: "memory" };
      (key(k, "d7")["label"] as Record<string, string>)["shift"] = "$key.memory";
    });
    expect(problems(a, pinned("layers", "d7.shift", "special memory"))).toEqual([]);
  });
  it("a row appended after a list's last fixed row: its line is appended", () => {
    const n = Object.keys(actual["base"] ?? {}).length + 1;
    expect(problems(with_("base", (s) => ({ ...s, [n]: "bin16" })), pinned("base", String(n), "bin16"))).toEqual([]);
  });
});

describe("growth passes whatever the lock held before", () => {
  it("a reserved cell filled and a Settings section appended, each recorded in the lock", () => {
    const filled = spec((k) => {
      key(k, "d7")["shift"] = { special: "memory" };
      (key(k, "d7")["label"] as Record<string, string>)["shift"] = "$key.memory";
    });
    const n = Object.keys(actual["settings"] ?? {}).length + 1;
    const grown: Pins = { ...filled, settings: { ...actual["settings"], [n]: "extra" } };
    expect(problems(grown, { ...lock, pins: { ...lock.pins, layers: { ...lock.pins["layers"], "d7.shift": "special memory" }, settings: { ...lock.pins["settings"], [n]: "extra" } } })).toEqual([]);
    expect(problems(grown).length).toBe(2); // not recorded: both are named
  });
});

describe("a move is a line the owner's decision backs", () => {
  // a decisions text of its own, in the bold-title form of decisions.md: the real file is trimmed and rewritten
  const title = "Fixture layout move";
  const fixture = `# Decisions\n\n- **${title} (owner, 2026-01-01):** the owner moved Menu to Esc.\n- **Fixture colon title:** another entry.\n\n### Fixture heading (milestone 9)\n`;
  const edited = (): Pins => spec((k) => (key(k, "undo")["primary"] = { special: "esc" }));
  const move = { entry: "layers/undo.primary", from: "cmd undo", to: "special esc", version: "0.2.0", decision: title };
  /** The real lock with its own moves applied (they name entries of the real decisions.md, not of the fixture). */
  const settled = (): Lock => ({ pins: applyMoves(lock, decisions).pins, moves: [] });
  const check = (decision: string): string[] => compareLayout(edited(), { ...settled(), moves: [{ ...move, decision }] }, fixture);
  it("is applied on top of the pinned line, which stays as it was", () => {
    expect(check(title)).toEqual([]);
    expect(lock.pins["layers"]?.["undo.primary"]).toBe("cmd undo");
  });
  it("a removal moves the line to reserved: the layer must be gone", () => {
    const gone = spec((k) => drop(k, "select", "shift"));
    const m = { ...move, entry: "layers/select.shift", from: "special copy", to: "reserved" };
    expect(compareLayout(gone, { ...settled(), moves: [m] }, fixture)).toEqual([]);
  });
  it("a later fill of the removed cell is a move from reserved", () => {
    const m1 = { ...move, entry: "layers/select.shift", from: "special copy", to: "reserved" };
    const m2 = { ...m1, from: "reserved", to: "special find" };
    const a = spec((k) => (key(k, "select")["shift"] = { special: "find" }));
    expect(compareLayout(a, { ...settled(), moves: [m1, m2] }, fixture)).toEqual([]);
  });
  it("must start from the line as it is", () => {
    expect(compareLayout(edited(), { ...settled(), moves: [{ ...move, from: "special esc" }] }, fixture)[0]).toBe('move layers/undo.primary: the line is "cmd undo", the move says "special esc"');
  });
  it("needs a decisions.md entry of that title", () => {
    expect(check("Nobody decided this")).toEqual(['move layers/undo.primary: decisions.md has no entry titled "Nobody decided this"']);
  });
  it("takes a whole title only: the title ends at the colon or the bracket, so a prefix of it is no decision", () => {
    const refused = (d: string): string[] => [`move layers/undo.primary: decisions.md has no entry titled "${d}"`];
    expect(check("Fi")).toEqual(refused("Fi"));
    expect(check("Fixture layout")).toEqual(refused("Fixture layout"));
    expect(check("Fixture layout move (owner")).toEqual(refused("Fixture layout move (owner"));
    expect(check("Fixture colon title")).toEqual([]);
    expect(check("Fixture colon")).toEqual(refused("Fixture colon"));
  });
  it("takes a whole heading only: the text after the hashes ends or goes on with a bracket, so a word of it is no decision", () => {
    const refused = (d: string): string[] => [`move layers/undo.primary: decisions.md has no entry titled "${d}"`];
    expect(check("Fixture heading")).toEqual([]);
    expect(check("Fixture")).toEqual(refused("Fixture"));
    expect(check("heading")).toEqual(refused("heading"));
  });
  it("the real lock's moves (if any) name entries of the real decisions.md or its archive", () => {
    expect(problems().filter((p) => p.startsWith("move "))).toEqual([]);
  });
  it("an entry moved to the archive still backs a move (pass 249 archived Settings over Mode)", () => {
    const archive = read("docs/archive/decisions-2026-10.md");
    const m = lock.moves.find((x) => x.decision === "Settings over Mode");
    expect(archive).toContain("**Settings over Mode (owner, R927):**");
    if (m === undefined) throw new Error("the lock has no move of Settings over Mode");
    expect(applyMoves({ pins: lock.pins, moves: [m] }, archive).problems).toEqual([]);
    expect(applyMoves({ pins: lock.pins, moves: [m] }, decisionsText(root)).problems).toEqual([]);
  });
  it("decisionsText reads docs/decisions.md and each docs/archive/decisions-*.md, nothing else of the archive", () => {
    const d = mkdtempSync(join(tmpdir(), "decisions-"));
    try {
      mkdirSync(join(d, "docs/archive"), { recursive: true });
      writeFileSync(join(d, "docs/decisions.md"), "**Kept (owner):** now\n");
      writeFileSync(join(d, "docs/archive/decisions-2026-10.md"), "**Moved (owner):** then\n");
      writeFileSync(join(d, "docs/archive/brief-2026-10.md"), "**Elsewhere (owner):** not a decision\n");
      const text = decisionsText(d);
      const move = (decision: string): Lock => ({ pins: { layers: { "undo.primary": "a" } }, moves: [{ entry: "layers/undo.primary", from: "a", to: "b", version: "v0.2", decision }] });
      expect(applyMoves(move("Kept"), text).problems).toEqual([]);
      expect(applyMoves(move("Moved"), text).problems).toEqual([]);
      expect(applyMoves(move("Elsewhere"), text).problems).toEqual(['move layers/undo.primary: decisions.md has no entry titled "Elsewhere"']);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
  it("R863: Settings and Help swapped at row 0, col 4 are two moves; the pinned lines stay, and without the moves the lock fails", () => {
    expect(lock.pins["layers"]?.["help.primary"]).toBe("special help");
    expect(lock.pins["layers"]?.["help.shift"]).toBe("special settings");
    const r863 = lock.moves.filter((m) => m.entry === "layers/help.primary" || m.entry === "layers/help.shift");
    expect(r863.map((m) => `${m.entry} ${m.from} → ${m.to} ${m.version}`)).toEqual([
      "layers/help.primary special help → special settings v0.1.1",
      "layers/help.shift special settings → special help v0.1.1",
    ]);
    expect(problems(actual, { ...lock, moves: lock.moves.filter((m) => !r863.includes(m)) })).toEqual([
      'layers/help.primary: pinned "special help", now "special settings"',
      'layers/help.shift: pinned "special settings", now "special help"',
    ]);
  });
  it("needs a version and an existing line", () => {
    expect(compareLayout(edited(), { ...settled(), moves: [{ ...move, version: "soon" }] }, fixture)[0]).toContain('version "soon" is no version');
    expect(compareLayout(actual, { ...settled(), moves: [{ ...move, entry: "layers/nokey.shift" }] }, fixture)[0]).toBe("move layers/nokey.shift: no such line in the lock");
  });
  it("a move that the layout does not show is still a pinned line that is gone or changed", () => {
    expect(compareLayout(actual, { ...settled(), moves: [move] }, fixture)).toEqual(['layers/undo.primary: pinned "special esc", now "cmd undo"']);
  });
});

describe("the last release's lock (altered copies of the lock)", () => {
  it("passes when the lock only grew", () => {
    const grown = pinned("base", "5", "bin16");
    expect(compareToRelease("v0.1.0", lock, grown)).toEqual([]);
    const filled = pinned("layers", "d7.shift", "special memory");
    expect(compareToRelease("v0.1.0", lock, filled)).toEqual([]);
  });
  it("fails for a live line edited in place, whatever the layout shows", () => {
    const p = compareToRelease("v0.1.0", lock, pinned("layers", "help.primary", "special esc"));
    expect(p).toEqual(['layers/help.primary: pinned "special help" in v0.1.0, edited to "special esc" now']);
  });
  it("fails for a live line deleted, and for a recorded move changed or dropped", () => {
    expect(compareToRelease("v0.1.0", lock, pinned("mode", "1", undefined))).toEqual([`mode/1: pinned "${lock.pins["mode"]?.["1"]}" in v0.1.0, missing now`]);
    const m = { entry: "layers/help.primary", from: "special help", to: "special esc", version: "0.2.0", decision: "x" };
    expect(compareToRelease("v0.1.0", { ...lock, moves: [m] }, lock)).toEqual(["move 1 (layers/help.primary) of v0.1.0 is changed or missing"]);
  });
  it("reads the newest v* tag that holds a lock with git show, and says nothing without one", () => {
    const dir = mkdtempSync(join(tmpdir(), "n62-lock-"));
    const git = (...a: string[]): void => void execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.org", "-c", "commit.gpgsign=false", ...a], { cwd: dir, stdio: "ignore" });
    try {
      git("init", "-q");
      writeFileSync(join(dir, "a.txt"), "a");
      git("add", ".");
      git("commit", "-q", "-m", "one");
      git("tag", "v0.0.1"); // a tag without the lock
      expect(releaseLock(dir, LOCK)).toBeNull();
      mkdirSync(join(dir, "spec"));
      writeFileSync(join(dir, LOCK), read(LOCK));
      git("add", ".");
      git("commit", "-q", "-m", "two");
      git("tag", "v0.1.0");
      const rel = releaseLock(dir, LOCK);
      expect(rel?.tag).toBe("v0.1.0");
      expect(rel?.lock.pins["layers"]?.["help.primary"]).toBe("special help");
      expect(releaseLock(join(dir, "nowhere"), LOCK)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("skips a pre-release tag: it never pins the lock and never shadows its release (R744)", () => {
    const dir = mkdtempSync(join(tmpdir(), "n62-lock-pre-"));
    const git = (...a: string[]): void => void execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.org", "-c", "commit.gpgsign=false", ...a], { cwd: dir, stdio: "ignore" });
    const lockText = (menu: string): string => read(LOCK).replace('"help.primary": "special help"', `"help.primary": "${menu}"`);
    try {
      git("init", "-q");
      mkdirSync(join(dir, "spec"));
      writeFileSync(join(dir, "a.txt"), "a");
      git("add", ".");
      git("commit", "-q", "-m", "one");
      // only a beta holds a lock: nothing is pinned
      writeFileSync(join(dir, LOCK), lockText("special esc"));
      git("add", ".");
      git("commit", "-q", "-m", "two");
      git("tag", "v0.1.0-beta.1");
      expect(releaseLock(dir, LOCK)).toBeNull();
      // the release below the beta wins, whatever the sort says
      git("tag", "v0.1.0", "HEAD~1");
      git("rm", "-q", "--cached", LOCK);
      writeFileSync(join(dir, LOCK), lockText("special help"));
      git("add", ".");
      git("commit", "-q", "-m", "three");
      git("tag", "-f", "v0.1.0");
      git("tag", "-f", "v0.1.0-beta.1", "HEAD~1");
      writeFileSync(join(dir, LOCK), lockText("special find"));
      git("add", ".");
      git("commit", "-q", "-m", "four");
      git("tag", "v0.1.0-beta.2");
      git("tag", "v0.1.1-rc.1");
      const rel = releaseLock(dir, LOCK);
      expect(rel?.tag).toBe("v0.1.0");
      expect(rel?.lock.pins["layers"]?.["help.primary"]).toBe("special help");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
