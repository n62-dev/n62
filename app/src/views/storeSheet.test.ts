// SPDX-License-Identifier: GPL-3.0-or-later
// R281 (sd-3, docs/research/store-design.md design A): the store sheet's model. The letters A–Z as cells, a filled one
// with its value and mark; the other names after them, newest first; a tap on a free letter stores at once, a tap on a
// filled one arms it and a second tap stores, any other press disarms; letters typed filter and Enter stores the typed
// name (digits too). A real Session over the fake engine; `store` records the name the sheet types after ▶.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { UserName } from "../engine/defs.ts";
import { Session } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import type { Sheet } from "./sheet.svelte.ts";
import { showStore, STORE_SHEET, storedText, typedLatex } from "./storeSheet.svelte.ts";

const kv = (): Kv => ({ get: () => Promise.resolve(undefined), set: () => Promise.resolve() });
const name = (n: string, preview: string, time: number, kind: UserName["kind"] = "var"): UserName => ({ name: n, kind, preview, view: "home", time, mark: "=" });

function setup(names: UserName[] = [name("A", "5", 1), name("C", "299792458", 2), name("rate", "0.0425", 3), name("R2", "10000", 4)]) {
  const session = new Session(new FakeCalc(), kv());
  session.userNames = names;
  const stored: string[] = [];
  const shell: { sheet: Sheet | null } = { sheet: null };
  showStore({ shell, session, store: (latex) => void stored.push(latex) }, "≈ 0.333333333333");
  const sheet = shell.sheet as unknown as Sheet;
  /** A tap on the item `id` (Sheet.svelte's ontap: shell.picked(sheet.activate(i))). */
  const tap = (id: string): void => {
    const p = sheet.activate(sheet.level.items.findIndex((x) => x.id === id));
    if (p.kind === "run") p.item.run?.();
  };
  return { session, sheet, stored, tap };
}

describe("the store sheet (R281)", () => {
  it("lists A–Z as cells, a filled one with its value and mark, then the other names newest first", () => {
    const { sheet } = setup();
    expect(sheet.id).toBe(STORE_SHEET);
    expect(sheet.letters).toBe(true); // it takes letters: above the keypad, whose Alpha and letters still type
    expect(sheet.path).toBe("Store ≈ 0.333333333333 in");
    const items = sheet.level.items;
    expect(items.filter((x) => x.cell).map((x) => x.label).join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(items[0]).toMatchObject({ label: "A", value: "= 5" });
    expect(items[1]?.value).toBeUndefined(); // B is free
    expect(items.slice(26).map((x) => [x.label, x.value])).toEqual([["R2", "= 10000"], ["rate", "= 0.0425"]]);
    expect(sheet.level.cells).toBe(7);
    expect(sheet.level.rows.every((r) => r.n === undefined)).toBe(true); // no numbers: a digit types into the name
    expect(sheet.level.current?.label).toBe("B"); // it opens on the first free letter
  });

  it("a tap on a free letter stores into it at once", () => {
    const { sheet, stored, tap } = setup();
    tap("name:B");
    expect(stored).toEqual(["B"]);
    expect(sheet.armed).toBeNull();
  });

  it("a tap on a filled letter arms it; the second tap stores", () => {
    const { sheet, stored, tap } = setup();
    tap("name:A");
    expect(stored).toEqual([]);
    expect(sheet.armed).toBe("name:A");
    expect(sheet.level.items[0]?.confirm).toEqual({ cell: "5 · again?", note: "A holds 5. Tap A again to replace it with ≈ 0.333333333333" });
    tap("name:A");
    expect(stored).toEqual(["A"]);
  });

  it("any other press disarms: a tap on another filled name arms that one, a key disarms", () => {
    const { sheet, stored, tap } = setup();
    tap("name:A");
    tap("name:C");
    expect(sheet.armed).toBe("name:C");
    tap("name:A");
    expect(sheet.armed).toBe("name:A");
    sheet.disarm(); // route.ts: any key but Enter
    tap("name:A");
    expect(stored).toEqual([]);
    expect(sheet.armed).toBe("name:A");
  });

  it("a longer name asks first too and stores as one name", () => {
    const { stored, tap } = setup();
    tap("name:rate");
    tap("name:rate");
    expect(stored).toEqual(["\\operatorname{rate}"]);
  });

  it("Enter on a highlighted filled letter asks as a tap does; on a free one it stores", () => {
    const { sheet, stored } = setup();
    const run = (): void => {
      const p = sheet.enter();
      if (p.kind === "run") p.item.run?.();
    };
    sheet.level.highlight = 0;
    run();
    expect(stored).toEqual([]);
    run();
    expect(stored).toEqual(["A"]);
    sheet.level.highlight = 1;
    run();
    expect(stored).toEqual(["A", "B"]);
  });

  it("letters typed filter; Enter stores the typed name, filled or new, with no question (the G2's typed path)", () => {
    const { sheet, stored } = setup();
    const enter = (): void => {
      const p = sheet.enter();
      if (p.kind === "run") p.item.run?.();
    };
    sheet.level.type("A");
    expect(sheet.level.rows.map((r) => r.item.label)).toEqual(["A"]);
    enter();
    expect(stored).toEqual(["A"]);
    sheet.level.filter = "";
    sheet.level.type("R");
    expect(sheet.level.rows.map((r) => r.item.label)).toEqual(["R", "R2", "rate"]);
    sheet.level.type("1");
    expect(sheet.level.rows).toEqual([]);
    enter();
    expect(stored).toEqual(["A", "\\operatorname{R1}"]);
  });

  it("◀ ▶ step a cell, ▲ ▼ a row of cells; from the grid's last row ▼ goes on to the names", () => {
    const { sheet } = setup();
    const at = (): string | undefined => sheet.level.current?.label;
    sheet.level.highlight = 0;
    sheet.right();
    expect(at()).toBe("B");
    expect(sheet.left()).toBe(true); // steps, does not close
    expect(at()).toBe("A");
    sheet.level.move(1);
    expect(at()).toBe("H");
    sheet.level.highlight = 23; // X, the grid's last row (V W X Y Z)
    sheet.level.move(1);
    expect(at()).toBe("R2"); // past Z: on to the names, the newest first
  });
});

describe("the name typed after ▶ (R281)", () => {
  const names = [name("e_", "2", 1), name("rate", "1", 2)];
  it("a stored name as Vars inserts it; one new letter as its key types it; else one name", () => {
    expect(typedLatex("A", names)).toBe("A");
    expect(typedLatex("e", names)).toBe("e"); // the stand-in e_ is typed as e (the parser renames it, as typed)
    expect(typedLatex("x", [])).toBe("x");
    expect(typedLatex("rate", names)).toBe("\\operatorname{rate}");
    expect(typedLatex("A1", names)).toBe("\\operatorname{A1}"); // digits after a letter belong to the name here
    expect(typedLatex("ab", [])).toBe("\\operatorname{ab}");
  });
});

describe("the title's value (R281)", () => {
  it("the line's text before ▶ when no row is stored (not worked out yet: no mark), put in the title when it comes", async () => {
    const session = new Session(new FakeCalc(), kv());
    expect(await storedText(session, undefined, "7\\blacktriangleright")).toBe("7");
    expect(await storedText(session, undefined, "\\blacktriangleright")).toBe("");
    session.userNames = [name("A", "5", 1)]; // (after the session's own start has read its names)
    const shell: { sheet: Sheet | null } = { sheet: null };
    const text = storedText(session, undefined, "2+3\\blacktriangleright");
    showStore({ shell, session, store() {} }, text);
    expect(shell.sheet?.path).toBe("Store in");
    const sheet = shell.sheet as Sheet;
    sheet.activate(0); // A, filled: armed before the text came
    await text;
    expect(shell.sheet?.path).toBe("Store 2+3 in");
    expect(sheet.level.items[0]?.confirm?.note).toBe("A holds 5. Tap A again to replace it with 2+3"); // the question has it too
  });
});
