// SPDX-License-Identifier: GPL-3.0-or-later
// R820: while a sheet is open a key's face, pop and dimming are what a tap on it does there (sheetKeys.ts sheetFace), the case it types
// included. The control: sheetFace says dead exactly when the sheet's job for the key (sheetJob, the one route.ts calls) is `none`.
import { describe, expect, it } from "vitest";
import { keyboard, type Key, type Layer } from "../keyboard/keyboard.ts";
import { sheetFace, sheetJob, type SheetCtx } from "./sheetKeys.ts";

const key = (id: string): Key => {
  const k = keyboard.byId.get(id);
  if (!k) throw new Error(`no key ${id}`);
  return k;
};
const NO = { shift: false, alpha: false };
const SHIFT = { shift: true, alpha: false };
const ctx = (kind: SheetCtx["kind"], extra: Partial<SheetCtx> = {}): SheetCtx => ({ kind, filter: true, numbered: 10, empty: true, cas: false, ...extra });
const face = (id: string, s: SheetCtx, mods = NO, layer?: Layer) => sheetFace(key(id), s, mods, layer);

describe("sheetFace: a filtered list (Vars, Find, Memory share one sheet; the others type the Alpha letter in capitals)", () => {
  it("Vars: Vars shows A, sin G, Tmpl C, x D; a flick down types the same letter", () => {
    const s = ctx("other");
    expect(face("vars", s)).toEqual({ text: "A", dead: false });
    expect(face("sin", s)).toEqual({ text: "G", dead: false });
    expect(face("tmpl", s)).toEqual({ dead: false }); // Tmpl toggles its sheet: its own face
    expect(face("x", s)).toEqual({ text: "D", dead: false });
    expect(face("vars", s, NO, "alpha")).toEqual({ text: "A", dead: false });
    expect(face("vars", s, NO, "shift")).toEqual({ dead: true }); // a flick up does nothing in these lists
  });
  it("a list that takes no letters keeps every face and dims the keys that do nothing", () => {
    const s = ctx("other", { filter: false });
    expect(face("vars", s)).toEqual({ dead: true });
    expect(face("d7", s)).toEqual({ dead: false });
  });
  it("a pick digit, ▲, Enter, ⌫, Shift keep their face, lit", () => {
    const s = ctx("other");
    for (const id of ["d7", "up", "enter", "bksp", "shift", "alpha"]) expect(face(id, s), id).toEqual({ dead: false });
  });
});

describe("sheetFace: Find (lower case, Shift types the key's own character)", () => {
  it("Vars a, sin g, Tmpl c, x d; the flick down a", () => {
    const s = ctx("find");
    expect(face("vars", s).text).toBe("a");
    expect(face("sin", s).text).toBe("g");
    expect(face("tmpl", s).text).toBe("c");
    expect(face("x", s).text).toBe("d");
    expect(face("vars", s, { shift: false, alpha: true }, "alpha")).toEqual({ text: "a", dead: false });
  });
  it("a digit picks on an empty query (its own face) and types itself after a letter", () => {
    expect(face("d7", ctx("find"))).toEqual({ dead: false });
    expect(face("d7", ctx("find", { empty: false }))).toEqual({ text: "7", dead: false });
  });
  it("under Shift: Vars is dimmed, sub shows -, dot shows . (the red side finding: dead() agrees with the tap)", () => {
    const s = ctx("find");
    expect(face("vars", s, SHIFT)).toEqual({ dead: true });
    expect(face("sin", s, SHIFT)).toEqual({ dead: true });
    expect(face("sub", s, SHIFT)).toEqual({ text: "-", dead: false });
    expect(face("dot", s, SHIFT)).toEqual({ text: ".", dead: false });
    expect(face("enter", s, SHIFT)).toEqual({ dead: false });
    expect(face("shift", s, SHIFT)).toEqual({ dead: false });
  });
});

describe("sheetFace: Store", () => {
  it("in Home: Vars A, x x; a plain digit is dimmed before a letter and shows itself after one", () => {
    const s = ctx("store");
    expect(face("vars", s)).toEqual({ text: "A", dead: false });
    expect(face("x", s)).toEqual({ text: "x", dead: false });
    expect(face("d7", s)).toEqual({ dead: true });
    expect(face("d7", ctx("store", { empty: false }))).toEqual({ text: "7", dead: false });
  });
  it("sin under Shift is a `line` key: its own face, lit", () => {
    expect(face("sin", ctx("store"), SHIFT)).toEqual({ dead: false });
  });
  it("in CAS it is the answer of storeKey", () => {
    const s = ctx("store", { cas: true });
    for (const id of ["vars", "x", "sin", "d7", "enter"]) {
      const job = sheetJob(key(id), s, NO, undefined);
      const f = face(id, s);
      expect(f.dead, id).toBe(job.kind === "none");
      expect(f.text, id).toBe(job.kind === "letter" ? job.ch : undefined);
    }
    expect(face("d2", s, { shift: false, alpha: true }).text).toBe("z"); // CAS: Alpha alone types lower case
  });
});

describe("control: dimmed exactly when the sheet's job is none", () => {
  const kinds: SheetCtx["kind"][] = ["find", "store", "other"];
  it("every key, sheet kind, layer and empty or filled query", () => {
    const mods = [NO, SHIFT, { shift: false, alpha: true }, { shift: true, alpha: true }];
    const layers: (Layer | undefined)[] = [undefined, "primary", "shift", "alpha"];
    let n = 0;
    for (const k of keyboard.keys)
      for (const kind of kinds)
        for (const empty of [true, false])
          for (const cas of [false, true])
            for (const filter of [true, false])
              for (const m of mods)
                for (const layer of layers) {
                  const s = ctx(kind, { empty, cas, filter, numbered: 12 });
                  const job = sheetJob(k, s, m, layer);
                  const f = sheetFace(k, s, m, layer);
                  expect(f.dead, `${k.id} ${kind} ${JSON.stringify(m)} ${layer}`).toBe(job.kind === "none");
                  expect(f.text !== undefined, `${k.id} ${kind}`).toBe(job.kind === "letter");
                  n++;
                }
    expect(n).toBeGreaterThan(1000);
  });
});
