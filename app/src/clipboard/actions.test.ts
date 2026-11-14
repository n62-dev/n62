// SPDX-License-Identifier: GPL-3.0-or-later
// F100: a Copy then a Paste, started without waiting, act in that order even when the write is slower than the read.
import { describe, expect, it } from "vitest";
import type { EntryController } from "../entry/controller.ts";
import type { AppShell } from "../apps/shell.svelte.ts";
import type { Session } from "../state/session.svelte.ts";
import { ClipActions } from "./actions.svelte.ts";
import type { ClipboardPort } from "./port.ts";

describe("ClipActions order", () => {
  it("pastes the value a just-started copy wrote, not the old clipboard", async () => {
    let clip = "7";
    const port: ClipboardPort = {
      writeText: async (t) => {
        await new Promise((r) => setTimeout(r, 30));
        clip = t;
        return true;
      },
      readText: async () => clip,
      share: async () => false,
    };
    const item = { status: "done", latex: "2", facts: {} };
    const session = { items: [item], display: () => ({ text: "2", latex: "2" }), displayContext: () => ({}) } as unknown as Session;
    const inserted: string[] = [];
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    const entry = { insert: (l: string) => void inserted.push(l) } as unknown as EntryController;
    const c = new ClipActions(session, shell, entry, { insert() {}, recall() {} }, port);
    const copied = c.copyShown();
    const pasted = c.paste();
    await Promise.all([copied, pasted]);
    expect(clip).toBe("2");
    expect(inserted).toEqual(["2"]);
  });
});

// R100 fix 1: Copy exact follows the comma rule Copy follows: an exact list separates its elements by `;`.
describe("ClipActions Copy exact with the decimal comma", () => {
  const run = async (item: object, comma: boolean): Promise<{ clip: string; inserted: string[] }> => {
    let clip = "";
    const port: ClipboardPort = { writeText: async (t) => ((clip = t), true), readText: async () => clip, share: async () => false };
    const session = { items: [item] } as unknown as Session;
    const inserted: string[] = [];
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    const entry = { insert: (l: string) => void inserted.push(l) } as unknown as EntryController;
    const c = new ClipActions(session, shell, entry, { insert() {}, recall() {} }, port, () => comma);
    await c.copyExact();
    await c.paste();
    return { clip, inserted };
  };
  const list = (drawn: string, full: string) => ({ status: "done", latex: drawn, full, fullExact: true, drawn });

  it("an exact list {3/2,2} copies as {3/2;2} in comma mode, {3/2,2} in point mode", async () => {
    expect((await run(list("{3/2,2}", "list[3/2,2]"), true)).clip).toBe("{3/2;2}");
    expect((await run(list("{3/2,2}", "list[3/2,2]"), false)).clip).toBe("{3/2,2}");
  });
  it("an exact list of integers copied in comma mode pastes back as the same list", async () => {
    expect(await run(list("{3,2}", "list[3,2]"), true)).toEqual({ clip: "{3;2}", inserted: ["\\left\\{3;2\\right\\}"] });
  });
  it("a rational is unchanged by the rule", async () => {
    expect((await run({ status: "done", latex: "3/2", rational: { n: "3", d: "2" }, full: "3/2", fullExact: true }, true)).clip).toBe("3/2");
  });
});

// R114: a system paste (Ctrl+V, Shift+Insert, the context menu) brings its own text: the Paste key's path, no clipboard read.
describe("ClipActions paste of a given text", () => {
  const make = (comma: boolean) => {
    let reads = 0;
    const port: ClipboardPort = { writeText: async () => true, readText: async () => (reads++, "9"), share: async () => false };
    const inserted: string[] = [];
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    const entry = { insert: (l: string) => void inserted.push(l) } as unknown as EntryController;
    const c = new ClipActions({ items: [] } as unknown as Session, shell, entry, { insert() {}, recall() {} }, port, () => comma);
    return { c, inserted, reads: () => reads };
  };
  it("enters the given text as the Paste key would, without reading the clipboard", async () => {
    const m = make(true);
    expect(await m.c.paste("1,5e-3")).toBe(true);
    expect(m.inserted).toEqual(["1{,}5\\emark-3"]);
    expect(m.reads()).toBe(0);
  });
  it("refuses an expression with the Paste key's notice and enters nothing", async () => {
    const m = make(false);
    expect(await m.c.paste("2*x+1")).toBe(false);
    expect(m.inserted).toEqual([]);
    expect(m.c.notice).toBe("Paste: not a number");
    expect(m.reads()).toBe(0);
  });
});

// R276: the picked row's buttons are Store ▶ and Copy as › (its three on a sheet); a hold copies the input as plain text
// or the result as Copy does, each a row action (R53's count).
describe("ClipActions row buttons and the hold", () => {
  const make = () => {
    let clip = "";
    const port: ClipboardPort = { writeText: async (t) => ((clip = t), true), readText: async () => clip, share: async () => false };
    const item = { id: 1, status: "done", latex: "\\frac{1}{3}", full: "1/3", fullExact: true, rational: { n: "1", d: "3" } };
    const session = { items: [item], display: () => ({ text: "0.333333333333", latex: "0.333333333333" }) } as unknown as Session;
    const menus: { title: string; ids: string[] }[] = [];
    const shell = { app: null, showsEntry: true, showMenu: (title: string, items: { id: string }[]) => void menus.push({ title, ids: items.map((i) => i.id) }) } as unknown as AppShell;
    const entry = { insert() {} } as unknown as EntryController;
    const acted: string[] = [];
    const c = new ClipActions(session, shell, entry, { insert() {}, recall() {}, acted: (id) => void acted.push(id) }, port);
    return { c, item: item as never, menus, acted, clip: () => clip };
  };
  it("the bar holds Store ▶ and Copy as ›; Copy as opens As shown, Exact, LaTeX", () => {
    const { c, item, menus } = make();
    const buttons = c.rowButtons(item);
    expect(buttons.map((b) => [b.id, b.label])).toEqual([["store", "Store ▶"], ["copyAs", "Copy as ›"]]);
    buttons[1]?.run?.();
    expect(menus).toEqual([{ title: "Copy as", ids: ["shown", "exact", "latex"] }]);
  });
  it("☰ keeps its nine in the same order, then Export › (R130)", () => {
    const { c, item } = make();
    expect(c.menu(item).map((m) => m.id)).toEqual(["insert", "recall", "copy", "store", "delete", "copyAs", "paste", "share", "clear", "export"]);
  });
  it("a hold on the input copies the entry as plain text, on the result Copy's full value; each counts as copy", async () => {
    const { c, item, acted, clip } = make();
    await c.holdCopy(item, "input", "\\sqrt{2}+3"); // (the input as drawn, given by History)
    expect(clip()).toBe("sqrt(2)+3"); // (entryText, as Share session writes an entry)
    await c.holdCopy(item, "result", "");
    expect(clip()).toBe("1/3");
    expect(acted).toEqual(["copy", "copy"]);
  });
});

// R130: ☰ Home/CAS keeps items 1 to 9 (their digits are learned); item 10 (key 0) is Export ›, with the work report in it.
describe("ClipActions menu: Export › is item 10", () => {
  const menuOf = (items: object[]) => {
    const session = { items } as unknown as Session;
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    return new ClipActions(session, shell, {} as EntryController, { insert() {}, recall() {} }).menu();
  };
  it("items 1 to 9 keep their ids and order; the tenth opens Export › with the work report", () => {
    const m = menuOf([{ status: "done", latex: "2", text: "2", facts: {} }]);
    expect(m.map((i) => i.id)).toEqual(["insert", "recall", "copy", "store", "delete", "copyAs", "paste", "share", "clear", "export"]);
    const exp = m[9]!;
    expect(exp.label).toBe("Export");
    expect(exp.disabled).toBe(false);
    expect(exp.submenu?.items.map((i) => [i.id, i.label, i.disabled])).toEqual([["work", "Work report", false]]);
  });
  it("with nothing finished Export › is off, and an empty history gives it no reason line (fit.spec.ts)", () => {
    expect(menuOf([])[9]).toMatchObject({ id: "export", disabled: true, reason: undefined });
    expect(menuOf([{ status: "pending", latex: "2", text: "" }])[9]).toMatchObject({ id: "export", disabled: true, reason: "No result yet" });
  });
});
