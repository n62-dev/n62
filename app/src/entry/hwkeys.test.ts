// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: one map from a hardware control key to the keypad key and layer it presses, for the entry line and the unit
// view's field (units/open.ts), so Delete is Shift + ⌫ (Del) in both (it was plain ⌫ on the unit view).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { FindIndex } from "../find/finder.ts";
import { makeIndex } from "../find/testIndex.ts";
import type { IndexItem } from "../find/types.ts";
import { FUNCS } from "../input/parseTables.ts";
import { keyboard, type ActionBody } from "../keyboard/keyboard.ts";
import { controlKey, hardwareKey, keypadKeyOf, undoKey, type HwTarget } from "./hwkeys.ts";

// R198: the Find index arrives when the test says so (the app fetches it, finder.ts loadIndex)
const index = vi.hoisted(() => {
  let give: (ix: FindIndex) => void = () => {};
  const promise = new Promise<FindIndex>((r) => (give = r));
  return { promise, give: (ix: FindIndex) => give(ix), asked: 0 };
});
vi.mock("../find/finder.ts", () => ({ loadIndex: () => (index.asked++, index.promise) }));

const k = (key: string, shiftKey = false) => controlKey({ key, shiftKey });

describe("controlKey", () => {
  it("maps Backspace to ⌫ and Delete to Shift + ⌫ (Del)", () => {
    expect(k("Backspace")).toEqual(["bksp", "primary"]);
    expect(k("Delete")).toEqual(["bksp", "shift"]);
  });
  it("maps the arrows to the pad's arrow keys, and Shift + an arrow to none (MathLive's selection)", () => {
    expect(k("ArrowLeft")).toEqual(["left", "primary"]);
    expect(k("ArrowRight")).toEqual(["right", "primary"]);
    expect(k("ArrowUp")).toEqual(["up", "primary"]);
    expect(k("ArrowDown")).toEqual(["down", "primary"]);
    expect(k("ArrowLeft", true)).toBeUndefined();
  });
  it("maps Enter and Escape to Enter and Esc, and nothing else", () => {
    expect(k("Enter")).toEqual(["enter", "primary"]);
    expect(k("Escape")).toEqual(["esc", "primary"]);
    expect(k("Home")).toBeUndefined();
    expect(k("a")).toBeUndefined();
  });
});

describe("undoKey (R119): Ctrl+Z is the Undo key, Ctrl+Y and Ctrl+Shift+Z the Redo key", () => {
  const u = (key: string, m: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean } = { ctrl: true }) =>
    undoKey({ key, ctrlKey: m.ctrl ?? false, metaKey: m.meta ?? false, altKey: m.alt ?? false, shiftKey: m.shift ?? false });
  it("maps the three combinations (and Cmd for Ctrl) to the Undo and Redo keys (R146: Redo is a key of its own)", () => {
    expect(u("z")).toBe("undo");
    expect(u("Z", { ctrl: true, shift: true })).toBe("redo");
    expect(u("y")).toBe("redo");
    expect(u("z", { meta: true })).toBe("undo");
  });
  it("leaves every other combination alone", () => {
    expect(u("z", {})).toBeUndefined();
    expect(u("z", { ctrl: true, alt: true })).toBeUndefined();
    expect(u("Y", { ctrl: true, shift: true })).toBeUndefined();
    expect(u("a")).toBeUndefined();
    expect(u("c")).toBeUndefined();
  });
  it("reads a real KeyboardEvent, whose key and modifiers are getters on its prototype (a spread copies none of them)", () => {
    class Ev {
      readonly #k: string;
      readonly #shift: boolean;
      constructor(k: string, shift = false) {
        this.#k = k;
        this.#shift = shift;
      }
      get key(): string {
        return this.#k;
      }
      get code(): string {
        return `Key${this.#k.toUpperCase()}`;
      }
      get ctrlKey(): boolean {
        return true;
      }
      get metaKey(): boolean {
        return false;
      }
      get altKey(): boolean {
        return false;
      }
      get shiftKey(): boolean {
        return this.#shift;
      }
    }
    expect(undoKey(new Ev("z"))).toBe("undo");
    expect(undoKey(new Ev("Z", true))).toBe("redo");
    expect(undoKey(new Ev("y"))).toBe("redo");
    expect(undoKey(new Ev("c"))).toBeUndefined();
  });
});

describe("hardwareKey passes KeyboardEvent.repeat on (R70f1: a held key counts once, docs/04 5.2)", () => {
  const ev = (key: string, repeat: boolean) =>
    ({ key, repeat, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, getModifierState: () => false }) as unknown as KeyboardEvent;
  const target = () => {
    const keys: [string, string, boolean][] = [];
    const t: HwTarget = {
      field: {} as HwTarget["field"],
      decimalComma: false,
      onSymbol: () => {},
      onKey: (id, layer, repeat) => void keys.push([id, layer, repeat]),
      onLetter: () => {},
      onDead: () => {},
      onPress: () => {},
      onDesk: () => {},
    };
    return { t, keys };
  };
  it("a first press goes on with repeat false, its auto-repeats with repeat true; each still presses the key", () => {
    const { t, keys } = target();
    expect(hardwareKey(ev("Backspace", false), t)).toBe(true);
    expect(hardwareKey(ev("Backspace", true), t)).toBe(true);
    expect(hardwareKey(ev("7", true), t)).toBe(true);
    expect(keys).toEqual([["bksp", "primary", false], ["bksp", "primary", true], ["d7", "primary", true]]);
  });
  it("Ctrl+Z presses Undo, Ctrl+Y and Ctrl+Shift+Z press Redo, both on their tap layer (R146)", () => {
    const { t, keys } = target();
    const ctrl = (key: string, shiftKey: boolean) => ({ ...ev(key, false), ctrlKey: true, shiftKey }) as unknown as KeyboardEvent;
    for (const [key, sh] of [["z", false], ["y", false], ["Z", true]] as const) expect(hardwareKey(ctrl(key, sh), t)).toBe(true);
    expect(keys).toEqual([["undo", "primary", false], ["redo", "primary", false], ["redo", "primary", false]]);
  });
  it("a letter's repeat flag reaches onLetter", () => {
    const { t } = target();
    const letters: [string, boolean][] = [];
    t.onLetter = (ch, repeat) => void letters.push([ch, repeat]);
    hardwareKey(ev("x", false), t);
    hardwareKey(ev("x", true), t);
    expect(letters).toEqual([["x", false], ["x", true]]);
  });
  it("a palette symbol (< > !) goes to onSymbol with the repeat flag, and nothing else runs", () => {
    const { t, keys } = target();
    const symbols: [string, boolean][] = [];
    t.onSymbol = (ch, repeat) => void symbols.push([ch, repeat]);
    for (const ch of ["<", ">", "!"]) hardwareKey(ev(ch, false), t);
    hardwareKey(ev("<", true), t);
    expect(symbols).toEqual([["<", false], [">", false], ["!", false], ["<", true]]);
    expect(keys).toEqual([]);
  });
  it("a dead key's repeat flag reaches onDead", () => {
    const { t } = target();
    const dead: boolean[] = [];
    t.onDead = (repeat) => void dead.push(repeat);
    hardwareKey(ev("$", false), t);
    hardwareKey(ev("$", true), t);
    expect(dead).toEqual([false, true]);
  });
});

// R131: `%` and the desktop key map (spec/keyboard.yaml `desktop:`)
describe("R131: % and the desktop keys", () => {
  type Mods = { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean; altGraph?: boolean };
  const ev = (key: string, code = "", m: Mods = {}) =>
    ({
      key,
      code,
      repeat: false,
      isComposing: false,
      ctrlKey: m.ctrl ?? false,
      metaKey: m.meta ?? false,
      altKey: m.alt ?? false,
      shiftKey: m.shift ?? false,
      getModifierState: (s: string) => s === "AltGraph" && (m.altGraph ?? false),
    }) as unknown as KeyboardEvent;
  /** `got`: what ran; `counts`: the count name App.svelte gives each press (onKey "<key id>:hw", onDesk "hw:<desktop name>"). */
  const target = () => {
    const got: string[] = [];
    const counts: string[] = [];
    const t: HwTarget = {
      field: {} as HwTarget["field"],
      decimalComma: false,
      onSymbol: (latex) => void got.push(`symbol ${latex}`),
      onKey: (id, layer) => void (got.push(`${id}:${layer}`), counts.push(`${id}:hw`)),
      onLetter: (ch) => void got.push(`letter ${ch}`),
      onDead: () => void got.push("dead"),
      onPress: () => void got.push("press"),
      // a keypad key as "<id>:<layer>"; a status-line control (keyboard.ts specialKey, no keypad key) and the fold (no key) as actions
      onDesk: (as, key, layer) =>
        void (got.push(!key ? "action fold" : keyboard.byId.has(key.id) ? `${key.id}:${layer}` : `action ${key.id}`), counts.push(as)),
    };
    return { t, got, counts };
  };
  const run = (...evs: KeyboardEvent[]): { handled: boolean[]; got: string[] } => {
    const { t, got } = target();
    return { handled: evs.map((e) => hardwareKey(e, t)), got };
  };
  const countsOf = (...evs: KeyboardEvent[]): string[] => {
    const { t, counts } = target();
    for (const e of evs) hardwareKey(e, t);
    return counts;
  };

  it("% inserts the percent sign as the Shift + 9 palette's % cell does (\\%; a bare % is a LaTeX comment), not a dead press", () => {
    expect(run(ev("%", "Digit5", { shift: true }))).toEqual({ handled: [true], got: ["symbol \\%"] });
  });
  it("< > ! insert their own symbols", () => {
    expect(run(ev("<"), ev(">"), ev("!")).got).toEqual(["symbol <", "symbol >", "symbol !"]);
  });
  it("Alt + a letter is a key's tap, Alt + Shift + the letter its Shift layer (by the layout's letter, by place on a Mac)", () => {
    const r = run(ev("s", "KeyS", { alt: true }), ev("S", "KeyS", { alt: true, shift: true }), ev("ß", "KeyS", { alt: true }), ev("Dead", "KeyE", { alt: true }));
    expect(r).toEqual({ handled: [true, true, true, true], got: ["sin:primary", "sin:shift", "sin:primary", "emark:primary"] });
  });
  it("Alt + a digit is a user key's tap, Alt + Shift + the digit its Shift slot (by place: Shift + 1 is !)", () => {
    expect(run(ev("1", "Digit1", { alt: true }), ev("!", "Digit1", { alt: true, shift: true })).got).toEqual(["u1:primary", "u1:shift"]);
  });
  it("Home and End are ⇤ and ⇥; Shift + Home stays MathLive's selection", () => {
    expect(run(ev("Home", "Home"), ev("End", "End"), ev("Home", "Home", { shift: true }))).toEqual({
      handled: [true, true, false],
      got: ["undo:shift", "redo:shift"],
    });
  });
  it("F1 is Help, Shift+Enter ≈, Alt+Shift+Backspace Clear, Alt+ArrowUp and Alt+ArrowDown Select and Deselect", () => {
    const r = run(ev("F1", "F1"), ev("Enter", "Enter", { shift: true }), ev("Backspace", "Backspace", { alt: true, shift: true }), ev("ArrowUp", "ArrowUp", { alt: true }), ev("ArrowDown", "ArrowDown", { alt: true }));
    expect(r.got).toEqual(["select:shift", "enter:shift", "esc:shift", "select:primary", "deselect:primary"]);
  });
  it("a plain Enter and Escape stay with the controller's own listener", () => {
    expect(run(ev("Enter", "Enter"), ev("Escape", "Escape"))).toEqual({ handled: [false, false], got: [] });
  });
  it("{ and [ are the list braces and the matrix (Shift + 8, Shift + 5); the unit view's characters stay R24c's", () => {
    expect(run(ev("{"), ev("[")).got).toEqual(["d8:shift", "d5:shift"]);
    expect(keypadKeyOf("{", false)).toBeUndefined();
    expect(keypadKeyOf("[", false)).toBeUndefined();
    expect(keypadKeyOf("7", false)).toEqual(["d7", "primary"]);
  });
  it("the status line's controls and folding are actions: Alt+A Apps, Alt+H the switch, F2 to F4 the views, Alt+K the fold", () => {
    const r = run(ev("a", "KeyA", { alt: true }), ev("h", "KeyH", { alt: true }), ev("F2", "F2"), ev("F3", "F3"), ev("F4", "F4"), ev("k", "KeyK", { alt: true }));
    expect(r.got).toEqual(["action apps", "action switch", "action symb", "action plot", "action num", "action fold"]);
  });
  it("Ctrl+C, Ctrl+V, Ctrl+A and an unmapped Alt chord stay with the field and the browser", () => {
    expect(run(ev("c", "KeyC", { ctrl: true }), ev("v", "KeyV", { ctrl: true }), ev("a", "KeyA", { ctrl: true }), ev("z", "KeyZ", { alt: true }), ev("F5", "F5"))).toEqual({
      handled: [false, false, false, false, false],
      got: [],
    });
  });
  it("a key the table adds counts under its desktop name, apart from the key's tap and from R45's and R119's keys", () => {
    // Home and Ctrl+Z, Shift+Enter and Enter's key, Alt+Shift+Backspace and Backspace, { and 8, Alt+E and ᴇ's key: each
    // pair presses one keypad key, and the removal test (docs/03 rule 11) reads the table's own presses apart
    expect(countsOf(ev("Home", "Home"), ev("z", "KeyZ", { ctrl: true }), ev("y", "KeyY", { ctrl: true }), ev("Z", "KeyZ", { ctrl: true, shift: true }))).toEqual([
      "hw:Home",
      "undo:hw",
      "redo:hw",
      "redo:hw",
    ]);
    expect(countsOf(ev("Enter", "Enter", { shift: true }), ev("Backspace", "Backspace", { alt: true, shift: true }), ev("Backspace", "Backspace"), ev("Delete", "Delete"))).toEqual([
      "hw:Shift+Enter",
      "hw:Alt+Shift+Backspace",
      "bksp:hw",
      "bksp:hw",
    ]);
    expect(countsOf(ev("{"), ev("8"), ev("["), ev("e", "KeyE", { alt: true }), ev("ArrowLeft", "ArrowLeft"), ev("ArrowUp", "ArrowUp", { alt: true }))).toEqual([
      "hw:{",
      "d8:hw",
      "hw:[",
      "hw:Alt+E",
      "left:hw",
      "hw:Alt+ArrowUp",
    ]);
    expect(countsOf(ev("k", "KeyK", { alt: true }), ev("F2", "F2"))).toEqual(["hw:Alt+K", "hw:F2"]);
  });
  it("R131f1: a Mac's Option character that is ASCII punctuation is typed, as AltGr's are (German Mac: Option + 5 is [, Option + L is @)", () => {
    expect(run(ev("[", "Digit5", { alt: true })).got).toEqual(["d5:shift"]);
    expect(run(ev("@", "KeyL", { alt: true })).got).toEqual(["dead"]);
    expect(run(ev("~", "KeyN", { alt: true })).got).toEqual(["dead"]);
    expect(countsOf(ev("[", "Digit5", { alt: true }))).toEqual(["hw:["]);
  });
  it("R131f1: Alt + Shift + a digit stays the user key's Shift slot (Windows, Linux: the key is !), and Option's ß stays Alt+S", () => {
    expect(run(ev("!", "Digit1", { alt: true, shift: true }), ev("ß", "KeyS", { alt: true })).got).toEqual(["u1:shift", "sin:primary"]);
  });
  it("AltGr's characters count as typed (Windows: Ctrl + Alt with AltGraph)", () => {
    expect(run(ev("{", "Digit7", { ctrl: true, alt: true, altGraph: true })).got).toEqual(["d8:shift"]);
  });
});

// R198: a function name typed on a hardware keyboard, then `(`, becomes the function (the owner, 2026-11-12; it reverses
// R31's "letters stay letters" for this path only). The line before the cursor is a fake field of one-character atoms.
describe("R198: a typed function name and ( give the function", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const indexFile = join(here, "../find/_gen/find-index.json");
  const ev = (key: string) =>
    ({ key, code: "", repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, getModifierState: () => false }) as unknown as KeyboardEvent;
  /** A line of atoms at depth 0 with the cursor at its end (MathLive: the atom at offset o ends there). */
  const line = (atoms: readonly string[], collapsed = true) =>
    ({
      position: atoms.length,
      lastOffset: atoms.length,
      selectionIsCollapsed: collapsed,
      getElementInfo: (o: number) => (o > 0 && o <= atoms.length ? { depth: 0, latex: atoms[o - 1] } : undefined),
    }) as unknown as HwTarget["field"];
  /** `(` typed after `typed` (one atom per character): what ran (the bracket pair `paren`, or the insert's LaTeX) and
   *  the count name; `stored`, the user's names. */
  const paren = (typed: string, stored: readonly string[] = [], collapsed = true): { got: string; count: string } => {
    const out = { got: "", count: "" };
    const t: HwTarget = {
      field: line([...typed], collapsed),
      decimalComma: false,
      stored,
      onSymbol: () => {},
      onKey: (id, layer) => void ((out.got = `${id}:${layer}`), (out.count = `${id}:hw`)),
      onLetter: () => {},
      onDead: () => {},
      onPress: () => {},
      onDesk: (as, key, layer) => {
        const a = key?.actions.primary as (ActionBody & { call?: { name: string } }) | undefined;
        out.got = a?.kind === "insert" ? `${key?.id}:${layer} ${a.latex} (${a.call?.name})` : "?";
        out.count = as;
      },
    };
    hardwareKey(ev("("), t);
    return out;
  };
  const letter = (ch: string): void => void hardwareKey(ev(ch), { field: line([]), decimalComma: false, onSymbol: () => {}, onKey: () => {}, onLetter: () => {}, onDead: () => {}, onPress: () => {} });

  it("before the index arrives: a name of the parser's FUNCS is the function, with the cursor in its bracket (sin( is \\sin\\left()", async () => {
    letter("s"); // the first letter loads the names: the parser's FUNCS, then the index
    await vi.waitFor(() => expect(paren("sin").got).not.toBe("paren:primary"));
    expect(paren("sin")).toEqual({ got: "paren:primary \\sin\\left(#0\\right) (sin)", count: "hw:name" });
    expect(paren("2sin").got).toBe("paren:primary \\sin\\left(#0\\right) (sin)"); // a number before the name stays
    expect(paren("arcsin").got).toBe("paren:primary \\arcsin\\left(#0\\right) (arcsin)");
    for (const name of Object.keys(FUNCS)) expect(paren(name).got, name).toBe(`paren:primary \\${name}\\left(#0\\right) (${name})`);
    expect(paren("stddev")).toEqual({ got: "paren:primary", count: "paren:hw" }); // the index is not in yet
  });
  it("a hardware letter asks for the index, once (the tests above typed letters too)", () => {
    letter("x");
    letter("t");
    expect(index.asked).toBe(1);
  });
  it("a letter run that is no name, one letter (a user function f( as today), pi and a selection stay the bracket pair", () => {
    for (const typed of ["abc", "xsin", "f", "x", "e", "pi", "Pi", "2", "", "SIN"]) expect(paren(typed).got, typed).toBe("paren:primary");
    expect(paren("sin", [], false).got).toBe("paren:primary");
  });
  it("a name the user has defined stays the user's", () => {
    expect(paren("sin", ["sin"]).got).toBe("paren:primary");
  });

  it("once the index is in: a Find function (stddev, a tier-1 name, log10) is its insert, the user's own names stay theirs", async () => {
    if (!existsSync(indexFile)) {
      if (process.env["FIND_INDEX"] === "required") expect.fail("app/src/find/_gen/find-index.json is missing; run npm run index");
      return;
    }
    const ix = makeIndex(JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]);
    index.give(ix);
    await index.promise;
    await new Promise((r) => setTimeout(r, 0));
    const insertOf = (id: string): string => ix.byId.get(id)?.insert ?? "none";
    expect(paren("stddev").got).toBe(`paren:primary ${insertOf("fn:stddev")} (stddev)`);
    expect(paren("stdevp").got).toBe(`paren:primary ${insertOf("fn:stddev")} (stdevp)`); // an alias of it
    expect(paren("log10").got).toBe(`paren:primary ${insertOf("fn:log10")} (log10)`); // digits after the letters
    expect(paren("sin").got).toBe("paren:primary \\sin\\left(#0\\right) (sin)"); // FUNCS first
    const tier1 = ix.items.find((it) => it.kind === "fn" && it.tier === 1 && /^[a-z]{5,}$/.test(it.id.slice(3)) && !(it.id.slice(3) in FUNCS));
    if (!tier1) return expect.fail("no tier-1 function in the index");
    const name = tier1.id.slice(3);
    expect(tier1.insert).toBe(`\\operatorname{${name}}\\left(#0\\right)`);
    expect(paren(name).got).toBe(`paren:primary ${tier1.insert} (${name})`);
    expect(paren(name, [name]).got).toBe("paren:primary"); // the user's function of that name
    for (const typed of ["pi", "e", "i", "f", "abc"]) expect(paren(typed).got, typed).toBe("paren:primary");
  });
});
