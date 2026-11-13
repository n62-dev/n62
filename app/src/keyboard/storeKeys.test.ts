// SPDX-License-Identifier: GPL-3.0-or-later
// R281 (sd-3): the keys in the store sheet, through the real route.press. Alpha and a letter key type the letter the
// line would (lower case in CAS, R58) and the one-shot Alpha is used up; a digit after a letter belongs to the name, before
// one it does nothing; Enter stores the typed name; Esc closes the sheet and stores nothing; any key but Enter disarms.
import { beforeAll, describe, expect, test } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { UserName } from "../engine/defs.ts";
import { Session } from "../state/session.svelte.ts";
import type { Kv } from "../state/storage.ts";
import type { Sheet } from "../views/sheet.svelte.ts";
import { sheetChunk } from "../views/sheetView.svelte.ts";
import { showStore } from "../views/storeSheet.svelte.ts";
import type { Layer } from "./keyboard.ts";

const route = await import("./route.ts");
const { keyboard } = await import("./keyboard.ts");

beforeAll(async () => {
  sheetChunk.keys = await import("../views/sheetKeys.ts");
  sheetChunk.C = {} as never; // drawn (route.ts sheetUndrawn)
});

const kv = (): Kv => ({ get: () => Promise.resolve(undefined), set: () => Promise.resolve() });

function ctx(cas = false) {
  const session = new Session(new FakeCalc(), kv());
  session.userNames = [{ name: "A", kind: "var", preview: "5", view: "home", time: 1, mark: "=" } satisfies UserName];
  const stored: string[] = [];
  const shell = { app: null, sheet: null as Sheet | null, sheetPending: null, loading: null, prompt: null, opening: Promise.resolve(), showsEntry: true, closeSheet: () => void (shell.sheet = null), picked: (p: { kind: string; item?: { run?: () => void } }) => void (p.kind === "run" && ((shell.sheet = null), p.item?.run?.())) };
  showStore({ shell, session, store: (latex) => void stored.push(latex) }, "7");
  const c = { session, shell, entry: {}, picked: null, sheetLoad: null, waiting: [], casKeys: cas, dead() {} };
  const key = (id: string) => {
    const k = keyboard.byId.get(id);
    if (!k) throw new Error(`no key ${id}`);
    return k;
  };
  const press = (id: string, layer?: Layer): void => route.press(c as never, key(id), layer);
  const alpha = (id: string): void => {
    press("alpha");
    press(id);
  };
  const sheet = (): Sheet => shell.sheet as Sheet;
  return { c, key, session, shell, sheet, stored, press, alpha };
}

describe("the store sheet's keys (R281)", () => {
  test("Alpha, A, Enter: the typed path stores A, and the one-shot Alpha is used up", () => {
    const { session, shell, stored, alpha, press } = ctx();
    alpha("vars");
    expect(session.alpha).toBe(false);
    expect(shell.sheet?.level.filter).toBe("A");
    press("enter");
    expect(stored).toEqual(["A"]);
    expect(shell.sheet).toBeNull();
  });
  test("digits after a letter belong to the name; before one they do nothing", () => {
    const { sheet, stored, alpha, press } = ctx();
    press("d1");
    expect(sheet().level.filter).toBe("");
    alpha("vars");
    press("d1");
    expect(sheet().level.filter).toBe("A1");
    press("enter");
    expect(stored).toEqual(["\\operatorname{A1}"]);
  });
  test("in CAS Alpha types lower case, as on the line (R58)", () => {
    const { sheet, alpha } = ctx(true);
    alpha("vars");
    expect(sheet().level.filter).toBe("a");
  });
  test("a key that types a letter on the line types it here too: x, Shift + x is y (the typed path as before)", () => {
    const { session, sheet, press } = ctx();
    press("x");
    session.shift = true;
    press("x");
    expect(sheet().level.filter).toBe("xy");
    expect(session.shift).toBe(false);
  });
  test("Alpha + x² types L (core c58)", () => {
    const { sheet, alpha } = ctx();
    alpha("sq");
    expect(sheet().level.filter).toBe("L");
  });
  test("a flick down types the key's letter in one press", () => {
    const { sheet, press } = ctx();
    press("sq", "alpha");
    expect(sheet().level.filter).toBe("L");
  });
  test("⌫ deletes a typed letter; with nothing typed it closes the sheet and goes on to the line (the ▶ goes)", () => {
    const { c, key, shell, alpha, press } = ctx();
    alpha("vars");
    press("bksp");
    expect(shell.sheet?.level.filter).toBe("");
    expect(route.sheetPress(c as never, key("bksp"), undefined)).toBe(false); // press() then runs ⌫ on the line
    expect(shell.sheet).toBeNull();
  });
  test("a key that types no name closes the sheet and does its job on the line, Shift kept: Shift + 9 (Greek), +", () => {
    const { c, key, session, shell } = ctx();
    session.shift = true;
    expect(route.sheetPress(c as never, key("d9"), undefined)).toBe(false); // press() then opens the Greek palette
    expect(shell.sheet).toBeNull();
    expect(session.shift).toBe(true);
    const plus = ctx();
    expect(route.sheetPress(plus.c as never, plus.key("add"), undefined)).toBe(false);
    expect(plus.shell.sheet).toBeNull();
  });
  test("Esc closes the sheet and stores nothing (the line keeps value ▶)", () => {
    const { shell, stored, press } = ctx();
    press("esc");
    expect(shell.sheet).toBeNull();
    expect(stored).toEqual([]);
  });
  test("a filled letter armed by a tap: Enter stores it, any other key disarms", () => {
    const { sheet, stored, press } = ctx();
    sheet().activate(0); // the first tap on A
    expect(sheet().armed).toBe("name:A");
    press("right");
    expect(sheet().armed).toBeNull();
    sheet().level.highlight = 0;
    sheet().activate(0);
    press("enter");
    expect(stored).toEqual(["A"]);
  });
});
