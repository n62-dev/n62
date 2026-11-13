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
  session.userNames = [{ ...name("A", "var", "5", 1), mark: "=" }, { ...name("b_1", "var", "7", 2), mark: "=" }, name("p", "fn", "done", 3), name("area", "fn", "done", 4)];
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

describe("R258: a stored value of more than one letter", () => {
  it("goes on the line as one name, \\operatorname{…} with \\_ for _ (as functionInsert writes a function)", () => {
    const ins = (n: string): string => liveItem(name(n, "var", "1", 0)).insert ?? "";
    expect(ins("rate")).toBe("\\operatorname{rate}");
    expect(ins("A1")).toBe("\\operatorname{A1}");
    expect(ins("ab")).toBe("\\operatorname{ab}");
    expect(ins("pi2")).toBe("\\operatorname{pi2}");
    expect(ins("g0")).toBe("\\operatorname{g0}");
    expect(ins("beam_w")).toBe("\\operatorname{beam\\_w}");
  });
  it("controls: one letter, a letter with a subscript and a Greek stand-in keep today's form", () => {
    const ins = (n: string): string => liveItem(name(n, "var", "1", 0)).insert ?? "";
    expect(ins("A")).toBe("A");
    expect(ins("x_1")).toBe("x_{1}");
    expect(ins("k_B")).toBe("k_{B}");
    expect(ins("theta")).toBe("\\theta ");
    expect(ins("beta_")).toBe("\\beta ");
  });
});

describe("Vars", () => {
  const stored = (sheet: Sheet) => sheet.level.items.filter((r) => !r.id.startsWith("name:")).map((r) => r.id);
  it("draws the store sheet's grid (R282): A–Z as cells with a stored one's value, then the other names newest first; it opens on the newest", () => {
    const { sheet } = setup(false);
    expect(sheet.id).toBe("find");
    expect(sheet.level.cells).toBe(7);
    const cells = sheet.level.items.filter((r) => r.cell);
    expect(cells.map((r) => r.label).join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(cells[0]).toMatchObject({ id: "var:A", value: "= 5", preview: "A = 5" });
    expect(cells[1]).toMatchObject({ id: "name:B", preview: "B is free; a tap puts it on the line" }); // free: no value
    expect(cells[1]?.value).toBeUndefined();
    expect(stored(sheet)).toEqual(["var:A", "userfn:area", "userfn:p", "var:b_1"]); // the cell, then the rest newest first
    expect(sheet.level.rows.every((r) => r.n === undefined)).toBe(true); // a grid has no numbers
    expect(sheet.level.current?.id).toBe("userfn:area"); // the newest name, as before
  });
  it("a tap on a letter inserts its name, a stored one or a free one; the sheet closes, then the name goes in", () => {
    const { sheet, inserted } = setup(false);
    for (const id of ["var:A", "name:B", "var:b_1", "userfn:p"]) {
      const p = sheet.activate(sheet.level.items.findIndex((r) => r.id === id));
      expect(p.kind).toBe("run");
      if (p.kind === "run") p.item.run?.();
    }
    expect(inserted).toEqual(["A", "B", "b_{1}", "\\operatorname{p}\\left(#0\\right)"]);
  });
  it("a typed letter searches the names as before: the hits are rows, without the grid or numbers", () => {
    const { sheet, inserted } = setup(false);
    sheet.level.type("a");
    expect(sheet.level.items.map((r) => r.id)).toEqual(["var:A", "userfn:area"]);
    expect(sheet.level.items.some((r) => r.cell)).toBe(false);
    expect(sheet.level.items[0]?.preview).toBe("A = 5");
    const p = sheet.activate(0);
    expect(p.kind).toBe("run");
    if (p.kind === "run") p.item.run?.();
    expect(inserted).toEqual(["A"]);
  });
  it("with no names every letter is a free cell", () => {
    const session = new Session(new FakeCalc(), kv());
    const shell: { sheet: Sheet | null } = { sheet: null };
    showNames(shell, { run: () => undefined } as unknown as EntryController, session, false);
    const items = (shell.sheet as Sheet).level.items;
    expect(items).toHaveLength(26);
    expect(items.every((r) => r.cell && r.id.startsWith("name:"))).toBe(true);
  });
});

describe("marks (S53f1, store-bu-1)", () => {
  const rowOf = (n: UserName, memory = false) => {
    const session = new Session(new FakeCalc(), kv());
    session.userNames = [n];
    const shell: { sheet: Sheet | null } = { sheet: null };
    showNames(shell, { run: () => undefined } as unknown as EntryController, session, memory);
    return (shell.sheet as Sheet).level.items.find((r) => !r.id.startsWith("name:"));
  };
  const third = { ...name("A", "var", "0.333333333333", 1), facts: { exact: false, reliableDigits: null } };
  it("a name stored from 1/3 reads ≈, in the row and its details line, as History would draw it", () => {
    expect(rowOf(third)?.preview).toBe("A ≈ 0.333333333333");
    expect(rowOf(third)?.value).toBe("≈ 0.333333333333");
    expect(rowOf(third, true)?.preview).toBe("A ≈ 0.333333333333");
  });
  it("an exact name carries the mark the engine noted when it was stored (1/3 stores no facts)", () => {
    expect(rowOf({ ...name("A", "var", "0.333333333333", 1), mark: "≈" })?.preview).toBe("A ≈ 0.333333333333");
    expect(rowOf({ ...name("A", "var", "[0.333333333333,1]", 1), mark: "≈" })?.value).toBe("≈ [0.333333333333,1]");
  });
  it("a name with no facts and no mark (an old saved log) shows no mark, not =", () => {
    expect(rowOf(name("A", "var", "0.333333333333", 1))?.preview).toBe("A 0.333333333333");
    expect(rowOf(name("A", "var", "0.333333333333", 1))?.value).toBe("0.333333333333");
  });
  it("the mark is worked out for the preview as drawn, not for the Digits now (reliable 7, a 12-digit preview: ⚠ 7)", () => {
    const wrong = { ...third, facts: { exact: false, reliableDigits: 7 } };
    const rows = (digits: number) => {
      const session = new Session(new FakeCalc(), kv());
      session.userNames = [wrong];
      session.settings.digits = digits;
      const shell: { sheet: Sheet | null } = { sheet: null };
      showNames(shell, { run: () => undefined } as unknown as EntryController, session, false);
      return (shell.sheet as Sheet).level.items.find((r) => !r.id.startsWith("name:"));
    };
    expect(rows(6)?.value).toBe("⚠ 7 0.333333333333");
    expect(rows(6)?.preview).toBe("A ⚠ 7 0.333333333333");
    expect(rows(12)?.value).toBe("⚠ 7 0.333333333333");
  });
  it("a name whose confirmed digits are fewer than shown reads ⚠ n; an un-audited float a bare ⚠", () => {
    expect(rowOf({ ...third, facts: { exact: false, reliableDigits: 7 } })?.value).toBe("⚠ 7 0.333333333333");
    expect(rowOf({ ...third, facts: { exact: false, reliableDigits: null, warn: "unaudited" } })?.value).toBe("⚠ 0.333333333333");
  });
  it("a value that is not one decimal (a list) still takes ≈ from its facts, never =", () => {
    expect(rowOf({ ...third, preview: "[1,2]" })?.preview).toBe("A ≈ [1,2]");
  });
  it("control: an exact name keeps =", () => {
    expect(rowOf({ ...name("A", "var", "5", 1), mark: "=" })?.preview).toBe("A = 5");
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

// R260 (vr-2): the engine's stand-in never reaches the user: Vars' row, its details line and the Find item read the
// name as typed (render/home.ts typedName), while a pick still inserts and deletes the stored name.
describe("R260: a stand-in shown as the letter typed", () => {
  it("beta_ and e_ are drawn β and e in the row, the details line and the live item's title", () => {
    const session = new Session(new FakeCalc(), kv());
    session.userNames = [{ ...name("beta_", "var", "2", 1), mark: "=" }, name("e_", "fn", "done", 2)];
    const shell: { sheet: Sheet | null } = { sheet: null };
    const entry = { run: () => {} } as unknown as EntryController;
    for (const memory of [false, true]) {
      showNames(shell, entry, session, memory); // Vars (the grid) and Memory (the list)
      const rows = (shell.sheet as Sheet).level.items.filter((r) => !r.id.startsWith("name:") && r.id !== "clearall");
      expect(rows.map((r) => r.label)).toEqual(["e", "β"]);
      expect(rows.map((r) => r.preview)).toEqual(["e(…)", "β = 2"]);
    }
    expect(liveItem(name("beta_", "var", "2", 0)).title).toBe("β");
    expect(liveItem(name("e_", "fn", "", 0)).title).toBe("e");
  });

  it("control: a name without a stand-in is shown as stored", () => {
    expect(liveItem(name("rate", "var", "2", 0)).title).toBe("rate");
    expect(liveItem(name("A", "var", "2", 0)).title).toBe("A");
  });
});
