// SPDX-License-Identifier: GPL-3.0-or-later
// R800: in Memory a digit key only moves the highlight to the numbered row; it never deletes a name nor arms Clear all
// (owner's walk 2026-11-20, B1). Enter keeps its job. Vars and Find are unchanged.
import { describe, expect, it, vi } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { UserName } from "../engine/defs.ts";
import type { EntryController } from "../entry/controller.ts";
import { Session } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import { Sheet } from "../views/sheet.svelte.ts";
import { showNames } from "./names.svelte.ts";

const kv = (): Kv => ({ get: () => Promise.resolve(undefined), set: () => Promise.resolve() });
const name = (n: string, preview: string, time: number): UserName => ({ name: n, kind: "var", preview, view: "home", time, mark: "=" });

function setup(memory: boolean) {
  const session = new Session(new FakeCalc(), kv());
  session.userNames = [name("A", "5", 1), name("B", "7", 2)];
  const forget = vi.spyOn(session.calc, "home"); // Memory's delete (names.svelte.ts forget) purges through the engine
  const shell: { sheet: Sheet | null } = { sheet: null };
  showNames(shell, { run: () => undefined } as unknown as EntryController, session, memory);
  return { session, forget, sheet: shell.sheet as Sheet };
}

describe("R800: Memory's digits highlight", () => {
  it("1 highlights the newest name's row and deletes nothing", () => {
    const { sheet, forget, session } = setup(true);
    sheet.level.highlight = 1; // away from row 1, so the move is seen
    expect(sheet.pickNumber(1)).toEqual({ kind: "stay" });
    expect(forget).not.toHaveBeenCalled();
    expect(session.userNames.map((u) => u.name)).toEqual(["A", "B"]);
    expect(sheet.level.current?.id).toBe("var:B");
  });
  it("3 highlights Clear all without arming it, and a second 3 changes nothing", () => {
    const { sheet, forget } = setup(true);
    expect(sheet.pickNumber(3)).toEqual({ kind: "stay" });
    expect(sheet.level.current?.id).toBe("clearall");
    expect(sheet.level.current?.label).toBe("Clear all");
    expect(sheet.pickNumber(3)).toEqual({ kind: "stay" });
    expect(sheet.level.current?.label).toBe("Clear all");
    expect(forget).not.toHaveBeenCalled();
  });
  it("Enter on the highlighted name still deletes it", () => {
    const { sheet, forget } = setup(true);
    sheet.pickNumber(3);
    sheet.pickNumber(1);
    expect(forget).not.toHaveBeenCalled();
    sheet.enter();
    expect(forget).toHaveBeenCalledTimes(1);
    expect(forget).toHaveBeenCalledWith("purge(B)", expect.anything());
  });
  it("a digit past the last row does nothing", () => {
    const { sheet, forget } = setup(true);
    sheet.pickNumber(2);
    expect(sheet.pickNumber(9)).toEqual({ kind: "stay" });
    expect(sheet.level.current?.id).toBe("var:A");
    expect(forget).not.toHaveBeenCalled();
  });
  it("control: Vars' digit on the grid does nothing", () => {
    const { sheet } = setup(false);
    const at = sheet.level.highlight;
    expect(sheet.pickNumber(1)).toEqual({ kind: "stay" });
    expect(sheet.level.highlight).toBe(at);
  });
});
