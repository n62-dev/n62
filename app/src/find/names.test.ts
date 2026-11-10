// SPDX-License-Identifier: GPL-3.0-or-later
// R4b: Vars and Memory over the session's names (docs/04 3.4, 5.1): live items, Vars' insert, Memory's delete and
// clear all, and the search that is read again after a deletion.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { UserName } from "../engine/defs.ts";
import type { EntryController } from "../entry/controller.ts";
import { Session } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import { Sheet } from "../views/sheet.svelte.ts";
import { liveItem, showNames } from "./names.svelte.ts";

const kv = (): Kv => ({ get: () => Promise.resolve(undefined), set: () => Promise.resolve() });
const name = (n: string, kind: UserName["kind"], preview: string, time: number): UserName => ({ name: n, kind, preview, view: "home", time });

function setup(memory: boolean) {
  const session = new Session(new FakeCalc(), kv());
  session.userNames = [name("A", "var", "5", 1), name("b_1", "var", "7", 2), name("p", "fn", "done", 3), name("area", "fn", "done", 4)];
  const inserted: string[] = [];
  const entry = { run: (a: { kind: string; latex?: string }) => void inserted.push(a.latex ?? "") } as unknown as EntryController;
  const shell: { sheet: Sheet | null } = { sheet: null };
  showNames(shell, entry, session, memory);
  return { session, inserted, sheet: shell.sheet as Sheet };
}

describe("live items", () => {
  it("a variable inserts its name as the keys type it, a function a call with the cursor in the argument", () => {
    expect(liveItem(name("A", "var", "5", 0))).toMatchObject({ id: "var:A", kind: "var", insert: "A", names: ["A"], desc: "5" });
    expect(liveItem(name("b_1", "var", "7", 0)).insert).toBe("b_{1}");
    expect(liveItem(name("p", "fn", "", 0))).toMatchObject({ id: "userfn:p", kind: "userfn", insert: "\\operatorname{p}\\left(#0\\right)" });
    expect(liveItem(name("area", "fn", "", 0)).insert).toBe("\\operatorname{area}\\left(#0\\right)");
  });
});

describe("Vars", () => {
  it("lists the names newest first, searches them by name, and a pick inserts", () => {
    const { sheet, inserted } = setup(false);
    expect(sheet.id).toBe("find");
    expect(sheet.level.items.map((r) => r.id)).toEqual(["userfn:area", "userfn:p", "var:b_1", "var:A"]);
    sheet.level.type("a");
    expect(sheet.level.items.map((r) => r.id)).toEqual(["var:A", "userfn:area"]);
    expect(sheet.level.items[0]?.preview).toBe("A = 5");
    const p = sheet.activate(0);
    expect(p.kind).toBe("run"); // a Vars row closes the sheet, then runs
    if (p.kind === "run") p.item.run?.();
    expect(inserted).toEqual(["A"]);
  });
});

describe("marks (S53f1, store-bu-1)", () => {
  const rowOf = (n: UserName, memory = false) => {
    const session = new Session(new FakeCalc(), kv());
    session.userNames = [n];
    const shell: { sheet: Sheet | null } = { sheet: null };
    showNames(shell, { run: () => undefined } as unknown as EntryController, session, memory);
    return (shell.sheet as Sheet).level.items[0];
  };
  const third = { ...name("A", "var", "0.333333333333", 1), facts: { exact: false, reliableDigits: null } };
  it("a name stored from 1/3 reads ≈, in the row and its details line, as History would draw it", () => {
    expect(rowOf(third)?.preview).toBe("A ≈ 0.333333333333");
    expect(rowOf(third)?.value).toBe("≈ 0.333333333333");
    expect(rowOf(third, true)?.preview).toBe("A ≈ 0.333333333333");
  });
  it("an exact name whose preview is rounded (the engine says so: 1/3 stores no facts) reads ≈", () => {
    expect(rowOf({ ...name("A", "var", "0.333333333333", 1), rounded: true })?.preview).toBe("A ≈ 0.333333333333");
    expect(rowOf(name("A", "var", "0.333333333333", 1))?.preview).toBe("A = 0.333333333333");
  });
  it("a name whose confirmed digits are fewer than shown reads ⚠ n; an un-audited float a bare ⚠", () => {
    expect(rowOf({ ...third, facts: { exact: false, reliableDigits: 7 } })?.value).toBe("⚠ 7 0.333333333333");
    expect(rowOf({ ...third, facts: { exact: false, reliableDigits: null, warn: "unaudited" } })?.value).toBe("⚠ 0.333333333333");
  });
  it("a value that is not one decimal (a list) still takes ≈ from its facts, never =", () => {
    expect(rowOf({ ...third, preview: "[1,2]" })?.preview).toBe("A ≈ [1,2]");
  });
  it("control: an exact name keeps =", () => {
    expect(rowOf(name("A", "var", "5", 1))?.preview).toBe("A = 5");
    expect(rowOf({ ...name("A", "var", "5", 1), facts: { exact: true, reliableDigits: null } })?.preview).toBe("A = 5");
  });
  it("a function has no mark", () => {
    expect(rowOf(name("p", "fn", "done", 1))?.preview).toBe("p(…)");
  });
});

describe("Memory", () => {
  it("a pick deletes the name and the sheet stays; the hits are read again", () => {
    const { sheet, session } = setup(true);
    expect(sheet.level.items.at(-1)?.id).toBe("clearall");
    sheet.level.type("a");
    expect(sheet.level.items.map((r) => r.id)).toEqual(["var:A", "userfn:area"]);
    expect(sheet.activate(0)).toEqual({ kind: "stay" });
    expect(session.userNames.map((u) => u.name)).toEqual(["b_1", "p", "area"]);
    expect(sheet.level.items.map((r) => r.id)).toEqual(["userfn:area"]);
    expect(sheet.level.highlight).toBe(0);
  });

  it("Clear all asks once, clears on the second pick, and is gone with the last name", () => {
    const { sheet, session } = setup(true);
    const last = () => sheet.level.items.length - 1;
    expect(sheet.level.items[last()]?.label).toBe("Clear all");
    sheet.activate(last());
    expect(sheet.level.items[last()]?.label).toBe("Enter again clears 4");
    expect(session.userNames).toHaveLength(4);
    sheet.activate(last());
    expect(session.userNames).toEqual([]);
    expect(sheet.level.items).toEqual([]);
  });

  it("deleting a row disarms Clear all", () => {
    const { sheet } = setup(true);
    sheet.activate(sheet.level.items.length - 1);
    sheet.activate(0);
    expect(sheet.level.items.at(-1)?.label).toBe("Clear all");
  });
});
