// SPDX-License-Identifier: GPL-3.0-or-later
// R820: while a sheet is open a key's face, pop and dimming are what a tap on it does there (sheetKeys.ts sheetFace), the case it types
// included. The control: sheetFace says dead exactly when the sheet's job for the key (sheetJob, the one route.ts calls) is `none`.
import { describe, expect, it } from "vitest";
import { keyboard, type Key, type Layer } from "../keyboard/keyboard.ts";
import { pastedName, sheetFace, sheetJob, type SheetCtx } from "./sheetKeys.ts";
import { Sheet } from "./sheet.svelte.ts";

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
  it("Vars a, sin g, Tmpl c, x x; the flick down a", () => {
    const s = ctx("find");
    expect(face("vars", s).text).toBe("a");
    expect(face("sin", s).text).toBe("g");
    expect(face("tmpl", s).text).toBe("c");
    expect(face("x", s).text).toBe("x"); // R889: the x key types x in a search (its letter d by Alpha or a flick down)
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

describe("R889: Alpha armed in Find, Vars or Memory types the key's letter; the x key types x", () => {
  const ALPHA = { shift: false, alpha: true };
  it("Alpha + 7 is q on an empty query and after a letter; R S U V W Y Z on 8 9 4 5 6 1 2 too", () => {
    expect(face("d7", ctx("find"), ALPHA)).toEqual({ text: "q", dead: false });
    expect(face("d7", ctx("find", { empty: false }), ALPHA)).toEqual({ text: "q", dead: false });
    const letters: Record<string, string> = { d8: "r", d9: "s", d4: "u", d5: "v", d6: "w", d1: "y", d2: "z" };
    for (const [id, ch] of Object.entries(letters)) expect(sheetJob(key(id), ctx("find"), ALPHA, undefined), id).toEqual({ kind: "letter", ch });
    expect(face("vars", ctx("find"), ALPHA).text).toBe("a"); // a key that types its letter anyway: the same letter
    expect(face("x", ctx("find"), ALPHA).text).toBe("d"); // Alpha + x is its letter d
    expect(face("x", ctx("find"), { shift: true, alpha: true }).text).toBe("d"); // Shift + Alpha: still lower case
    expect(face("enter", ctx("find"), ALPHA)).toEqual({ dead: false }); // a key with no letter keeps its job
  });
  it("the x key types x in a search; its flick down types d", () => {
    expect(face("x", ctx("find"))).toEqual({ text: "x", dead: false });
    expect(face("x", ctx("find", { empty: false }))).toEqual({ text: "x", dead: false });
    expect(face("x", ctx("find"), NO, "alpha")).toEqual({ text: "d", dead: false });
  });
  it("controls: without Alpha a digit picks on an empty query and types itself after a letter; a flick down types its letter", () => {
    expect(sheetJob(key("d7"), ctx("find"), NO, undefined)).toEqual({ kind: "pick", n: 7 });
    expect(face("d7", ctx("find", { empty: false }))).toEqual({ text: "7", dead: false });
    expect(face("d7", ctx("find"), NO, "alpha")).toEqual({ text: "q", dead: false });
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

describe("R887: the ⚙ key keeps its job in Find, Vars, ☰ and Mode (Settings as the sheet's next level), lit", () => {
  it("a tap is `pass` in Find and in the other lists, with or without letters, and stays a `line` key in Store", () => {
    for (const s of [ctx("find"), ctx("find", { empty: false }), ctx("other"), ctx("other", { filter: false })]) {
      expect(sheetJob(key("help"), s, NO, undefined), s.kind).toEqual({ kind: "pass" });
      expect(face("help", s), s.kind).toEqual({ dead: false });
    }
    expect(sheetJob(key("help"), ctx("store"), NO, undefined)).toEqual({ kind: "line" }); // R281: it opens Settings from the line, as before
    // R863: Shift + ⚙ is Help, dead in a sheet; R869: in Find (Vars and Memory too) it explains the highlighted row
    expect(sheetJob(key("help"), ctx("other"), SHIFT, undefined), "other: Shift + ⚙ is Help").toEqual({ kind: "none" });
    expect(sheetJob(key("help"), ctx("other"), NO, "shift"), "other: the flick up").toEqual({ kind: "none" });
    expect(sheetJob(key("help"), ctx("find"), SHIFT, undefined), "find: Shift + ⚙ is Help").toEqual({ kind: "help" });
    expect(sheetJob(key("help"), ctx("find"), NO, "shift"), "find: the flick up").toEqual({ kind: "help" });
    const held: Key = { ...key("u2"), actions: { primary: { kind: "special", name: "settings" } } }; // R15b: a free key that holds Settings
    for (const s of [ctx("find"), ctx("other")]) expect(sheetJob(held, s, NO, undefined), s.kind).toEqual({ kind: "none" });
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

describe("R900: the Paste key (Shift + Deselect) in a list whose filter takes a pasted name (Find, Vars, Store in; not Memory)", () => {
  it("a tap with Shift and a flick up are `paste`, drawn lit; without `paste` (Memory, the other sheets) Find dims it and Store in sends it to the line", () => {
    for (const kind of ["find", "store"] as const) {
      expect(sheetJob(key("deselect"), ctx(kind, { paste: true }), SHIFT, undefined), kind).toEqual({ kind: "paste" });
      expect(sheetJob(key("deselect"), ctx(kind, { paste: true }), NO, "shift"), kind).toEqual({ kind: "paste" });
      expect(face("deselect", ctx(kind, { paste: true }), SHIFT, "shift"), kind).toEqual({ dead: false });
    }
    expect(sheetJob(key("deselect"), ctx("find"), SHIFT, undefined)).toEqual({ kind: "none" }); // Memory: R816's to come
    expect(sheetJob(key("deselect"), ctx("store"), SHIFT, undefined)).toEqual({ kind: "line" }); // the store sheet before R900
    expect(sheetJob(key("deselect"), ctx("find", { paste: true }), NO, undefined)).not.toEqual({ kind: "paste" }); // Deselect alone is no Paste
  });
  it("pastedName: the first line, trimmed, when it is a name (a letter, then letters, digits, _; at most 32 characters)", () => {
    expect(pastedName("ZZ")).toBe("ZZ");
    expect(pastedName(" erfc \nmore")).toBe("erfc");
    expect(pastedName("T_1\r\n")).toBe("T_1");
    expect(pastedName("ΔT2")).toBe("ΔT2");
    expect(pastedName("a".repeat(32))).toBe("a".repeat(32));
    for (const no of ["a".repeat(33), "1+2", "12", "_x", "a b", "", "x²", "2.5"]) expect(pastedName(no), no).toBeUndefined();
  });
});

describe("R815: the Copy key (Shift + Select) in Find, Vars and Memory", () => {
  it("is the copy job there, by a tap with Shift on or by its layer; plain Select is not", () => {
    expect(sheetJob(key("select"), ctx("find"), SHIFT, undefined)).toEqual({ kind: "copy" });
    expect(sheetJob(key("select"), ctx("find"), NO, "shift")).toEqual({ kind: "copy" });
    expect(sheetJob(key("select"), ctx("find"), NO, undefined).kind).not.toBe("copy");
  });
  it("is no copy job in the store sheet or another list", () => {
    expect(sheetJob(key("select"), ctx("store"), SHIFT, undefined).kind).not.toBe("copy");
    expect(sheetJob(key("select"), ctx("other"), SHIFT, undefined).kind).not.toBe("copy");
  });
  it("its face is dead without a highlighted row that copies, lit with one", () => {
    const sheet = (copy: boolean): Sheet => new Sheet("find", "Vars", () => [{ id: "var:A", label: "A", run: () => {}, ...(copy ? { copy: () => {} } : {}) }], { remember: false });
    expect(sheetFace(key("select"), { ...ctx("find"), of: sheet(true) }, SHIFT).dead).toBe(false);
    expect(sheetFace(key("select"), { ...ctx("find"), of: sheet(false) }, SHIFT).dead).toBe(true);
  });
});
