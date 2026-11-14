// SPDX-License-Identifier: GPL-3.0-or-later
// R291, the layout lock (docs/06 section 3b): spec/layout-lock.yaml pins every live key layer and every fixed row of the
// numbered lists; this compares it with the spec and with the lists as the code builds them (no copy of either here).
// A change to a pinned line, or a live line the lock does not know, fails and names the entry. Growth into blank space
// (a reserved line turning live, a row appended after a list's last fixed row) passes once the lock records it.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { AppShell } from "../apps/shell.svelte.ts";
import type { Calc } from "../calc/port.ts";
import { FakeCalc } from "../calc/fake.ts";
import { ClipActions } from "../clipboard/actions.svelte.ts";
import type { EntryController } from "../entry/controller.ts";
import type { FindItem } from "../find/types.ts";
import { Session, type HistoryItem } from "../state/session.svelte.ts";
import { fakeKv } from "../state/fakeKv.ts";
import { baseItems } from "../views/baseSheet.ts";
import { matrixItems, MATRIX_ROWS } from "../views/matrixSheet.ts";
import { modeItems, settingsSections } from "../views/modeSheet.ts";
import { loadKeyboard, keyboard } from "./keyboard.ts";
import { UserKeys } from "./userKeys.svelte.ts";
import { compareLayout, compareToRelease, layerPins, listSlots, paletteSlots, parseLock, releaseLock, type Lock, type Pins } from "./layoutLock.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const LOCK = "spec/layout-lock.yaml";
const read = (p: string): string => readFileSync(join(root, p), "utf8");
const specDoc = (): { keys: Record<string, unknown>[] } => parse(read("spec/keyboard.yaml")) as { keys: Record<string, unknown>[] };
const decisions = read("docs/decisions.md");
const ids = (rows: readonly { id: string }[]): Record<string, string> => listSlots(rows.map((r) => r.id));

/** Every pinned list, built by the code that draws it. Settings' sections are the shipped app's (App.svelte's settingsEnv
 *  gives both userKeys and data, so none is left out). */
async function built(kb = keyboard): Promise<Record<string, Record<string, string>>> {
  const session = new Session(new FakeCalc(), fakeKv());
  const env = { userKeys: new UserKeys(fakeKv()), data: () => {} };
  const clip = new ClipActions({ items: [] } as unknown as Session, { showsEntry: true } as unknown as AppShell, {} as EntryController, { insert() {}, recall() {} });
  const menu = clip.menu();
  const shell = new AppShell({} as Calc, fakeKv(), { value: "", set() {}, clear() {} }, () => session.settings);
  shell.toggleApps();
  await shell.sheetPending;
  const item = { status: "done", value: { re: { sign: 1, digits: "255", exp: 0 }, im: { sign: 1, digits: "0", exp: 0 } }, rational: { n: "255", d: "1" } } as unknown as HistoryItem;
  const stubs = new Map(MATRIX_ROWS.map(({ id }) => [id, { id } as unknown as FindItem]));
  return {
    layers: layerPins(kb),
    tmpl: paletteSlots(kb.palette),
    relations: paletteSlots(kb.relations),
    symbols: paletteSlots(kb.symbols),
    "home-menu": ids(menu),
    "home-copy-as": ids(menu.find((r) => r.id === "copyAs")?.submenu?.items ?? []),
    mode: ids(modeItems(session, env)),
    settings: ids(settingsSections(session, env)),
    apps: ids(shell.sheet?.level.items ?? []),
    base: ids(baseItems(session, item)),
    matrix: ids(matrixItems(stubs, (it) => ({ id: it.id, label: it.id }))),
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

describe("a pinned key layer cannot change unnoticed (altered copies of the spec)", () => {
  it("a changed action names the entry", () => {
    const p = problems(spec((k) => (key(k, "menu")["primary"] = { special: "esc" })));
    expect(p).toEqual(['layers/menu.primary: pinned "special menu", now "special esc"']);
  });
  it("a layer taken away names the entry", () => {
    const p = problems(spec((k) => drop(k, "select", "shift")));
    expect(p.join("\n")).toContain('layers/select.shift: pinned "special help" is gone');
  });
  it("a layer copied into a reserved cell names that cell", () => {
    const p = problems(
      spec((k) => {
        key(k, "deselect")["shift"] = key(k, "select")["shift"];
        (key(k, "deselect")["label"] as Record<string, string>)["shift"] = "$key.help";
      }),
    );
    expect(p).toEqual(['layers/deselect.shift: reserved in the lock but live ("special help"): record the fill in the lock']);
  });
  it("a reserved cell turned live is not in the lock yet", () => {
    const p = problems(
      spec((k) => {
        key(k, "vars")["shift"] = { special: "memory" };
        (key(k, "vars")["label"] as Record<string, string>)["shift"] = "$key.memory";
      }),
    );
    expect(p).toEqual(['layers/vars.shift: reserved in the lock but live ("special memory"): record the fill in the lock']);
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
    const p = problems(with_("home-menu", (s) => listSlots(rows("home-menu").filter((r) => r !== "recall"))));
    expect(p[0]).toBe('home-menu/2: pinned "recall", now "copy"');
    expect(p.length).toBeGreaterThan(1);
  });
  it("a row inserted before a pinned row moves it", () => {
    const p = problems(with_("settings", () => listSlots(["extra", ...rows("settings")])));
    expect(p[0]).toBe('settings/1: pinned "appearance", now "extra" ("appearance" is at 2)');
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

describe("growth into blank space passes once the lock records it", () => {
  it("a reserved layer that turns live: the lock's line goes from reserved to the action", () => {
    const a = spec((k) => {
      key(k, "vars")["shift"] = { special: "memory" };
      (key(k, "vars")["label"] as Record<string, string>)["shift"] = "$key.memory";
    });
    expect(problems(a, pinned("layers", "vars.shift", "special memory"))).toEqual([]);
  });
  it("a row appended after a list's last fixed row: its line is appended", () => {
    const n = Object.keys(actual["base"] ?? {}).length + 1;
    expect(problems(with_("base", (s) => ({ ...s, [n]: "bin16" })), pinned("base", String(n), "bin16"))).toEqual([]);
  });
});

describe("growth passes whatever the lock held before", () => {
  it("a reserved cell filled and a Settings section appended, each recorded in the lock", () => {
    const filled = spec((k) => {
      key(k, "vars")["shift"] = { special: "memory" };
      (key(k, "vars")["label"] as Record<string, string>)["shift"] = "$key.memory";
    });
    const n = Object.keys(actual["settings"] ?? {}).length + 1;
    const grown: Pins = { ...filled, settings: { ...actual["settings"], [n]: "extra" } };
    expect(problems(grown, { ...lock, pins: { ...lock.pins, layers: { ...lock.pins["layers"], "vars.shift": "special memory" }, settings: { ...lock.pins["settings"], [n]: "extra" } } })).toEqual([]);
    expect(problems(grown).length).toBe(2); // not recorded: both are named
  });
});

describe("a move is a line the owner's decision backs", () => {
  // a decisions text of its own, in the bold-title form of decisions.md: the real file is trimmed and rewritten
  const title = "Fixture layout move";
  const fixture = `# Decisions\n\n- **${title} (owner, 2026-01-01):** the owner moved Menu to Esc.\n- **Fixture colon title:** another entry.\n\n### Fixture heading (milestone 9)\n`;
  const edited = (): Pins => spec((k) => (key(k, "menu")["primary"] = { special: "esc" }));
  const move = { entry: "layers/menu.primary", from: "special menu", to: "special esc", version: "0.2.0", decision: title };
  const check = (decision: string): string[] => compareLayout(edited(), { ...lock, moves: [{ ...move, decision }] }, fixture);
  it("is applied on top of the pinned line, which stays as it was", () => {
    expect(check(title)).toEqual([]);
    expect(lock.pins["layers"]?.["menu.primary"]).toBe("special menu");
  });
  it("a removal moves the line to reserved: the layer must be gone", () => {
    const gone = spec((k) => drop(k, "select", "shift"));
    const m = { ...move, entry: "layers/select.shift", from: "special help", to: "reserved" };
    expect(compareLayout(gone, { ...lock, moves: [m] }, fixture)).toEqual([]);
  });
  it("a later fill of the removed cell is a move from reserved", () => {
    const m1 = { ...move, entry: "layers/select.shift", from: "special help", to: "reserved" };
    const m2 = { ...m1, from: "reserved", to: "special find" };
    const a = spec((k) => (key(k, "select")["shift"] = { special: "find" }));
    expect(compareLayout(a, { ...lock, moves: [m1, m2] }, fixture)).toEqual([]);
  });
  it("must start from the line as it is", () => {
    expect(compareLayout(edited(), { ...lock, moves: [{ ...move, from: "special esc" }] }, fixture)[0]).toBe('move layers/menu.primary: the line is "special menu", the move says "special esc"');
  });
  it("needs a decisions.md entry of that title", () => {
    expect(check("Nobody decided this")).toEqual(['move layers/menu.primary: decisions.md has no entry titled "Nobody decided this"']);
  });
  it("takes a whole title only: the title ends at the colon or the bracket, so a prefix of it is no decision", () => {
    const refused = (d: string): string[] => [`move layers/menu.primary: decisions.md has no entry titled "${d}"`];
    expect(check("Fi")).toEqual(refused("Fi"));
    expect(check("Fixture layout")).toEqual(refused("Fixture layout"));
    expect(check("Fixture layout move (owner")).toEqual(refused("Fixture layout move (owner"));
    expect(check("Fixture colon title")).toEqual([]);
    expect(check("Fixture colon")).toEqual(refused("Fixture colon"));
  });
  it("takes a whole heading only: the text after the hashes ends or goes on with a bracket, so a word of it is no decision", () => {
    const refused = (d: string): string[] => [`move layers/menu.primary: decisions.md has no entry titled "${d}"`];
    expect(check("Fixture heading")).toEqual([]);
    expect(check("Fixture")).toEqual(refused("Fixture"));
    expect(check("heading")).toEqual(refused("heading"));
  });
  it("the real lock's moves (if any) name entries of the real decisions.md", () => {
    expect(problems().filter((p) => p.startsWith("move "))).toEqual([]);
  });
  it("needs a version and an existing line", () => {
    expect(compareLayout(edited(), { ...lock, moves: [{ ...move, version: "soon" }] }, fixture)[0]).toContain('version "soon" is no version');
    expect(compareLayout(actual, { ...lock, moves: [{ ...move, entry: "layers/nokey.shift" }] }, fixture)[0]).toBe("move layers/nokey.shift: no such line in the lock");
  });
  it("a move that the layout does not show is still a pinned line that is gone or changed", () => {
    expect(compareLayout(actual, { ...lock, moves: [move] }, fixture)).toEqual(['layers/menu.primary: pinned "special esc", now "special menu"']);
  });
});

describe("the last release's lock (altered copies of the lock)", () => {
  it("passes when the lock only grew", () => {
    const grown = pinned("base", "5", "bin16");
    expect(compareToRelease("v0.1.0", lock, grown)).toEqual([]);
    const filled = pinned("layers", "vars.shift", "special memory");
    expect(compareToRelease("v0.1.0", lock, filled)).toEqual([]);
  });
  it("fails for a live line edited in place, whatever the layout shows", () => {
    const p = compareToRelease("v0.1.0", lock, pinned("layers", "menu.primary", "special esc"));
    expect(p).toEqual(['layers/menu.primary: pinned "special menu" in v0.1.0, edited to "special esc" now']);
  });
  it("fails for a live line deleted, and for a recorded move changed or dropped", () => {
    expect(compareToRelease("v0.1.0", lock, pinned("mode", "1", undefined))).toEqual([`mode/1: pinned "${lock.pins["mode"]?.["1"]}" in v0.1.0, missing now`]);
    const m = { entry: "layers/menu.primary", from: "special menu", to: "special esc", version: "0.2.0", decision: "x" };
    expect(compareToRelease("v0.1.0", { ...lock, moves: [m] }, lock)).toEqual(["move 1 (layers/menu.primary) of v0.1.0 is changed or missing"]);
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
      expect(rel?.lock.pins["layers"]?.["menu.primary"]).toBe("special menu");
      expect(releaseLock(join(dir, "nowhere"), LOCK)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
