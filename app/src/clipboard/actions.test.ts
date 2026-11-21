// SPDX-License-Identifier: GPL-3.0-or-later
// F100: a Copy then a Paste, started without waiting, act in that order even when the write is slower than the read.
import { afterEach, describe, expect, it, vi } from "vitest";
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
    const c = new ClipActions(session, shell, entry, { insert() {} }, port);
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
    const c = new ClipActions(session, shell, entry, { insert() {} }, port, () => comma);
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
    const c = new ClipActions({ items: [] } as unknown as Session, shell, entry, { insert() {} }, port, () => comma);
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

// R276: the picked row's buttons are Store ▶ and Copy › (its five on a sheet; R830: ☰ has neither); a hold copies the input as plain text
// or the result as Copy does, each a row action (R53's count).
describe("ClipActions row buttons and the hold", () => {
  const make = () => {
    let clip = "";
    const port: ClipboardPort = { writeText: async (t) => ((clip = t), true), readText: async () => clip, share: async () => false };
    const item = { id: 1, status: "done", latex: "\\frac{1}{3}", full: "1/3", fullExact: true, rational: { n: "1", d: "3" } };
    const session = { items: [item], display: () => ({ text: "0.333333333333", latex: "0.333333333333" }), mark: () => null, displayContext: () => ({}) } as unknown as Session;
    const menus: { title: string; ids: string[] }[] = [];
    const shell = { app: null, showsEntry: true, showMenu: (title: string, items: { id: string }[]) => void menus.push({ title, ids: items.map((i) => i.id) }) } as unknown as AppShell;
    const entry = { insert() {} } as unknown as EntryController;
    const acted: string[] = [];
    const c = new ClipActions(session, shell, entry, { insert() {}, acted: (id) => void acted.push(id) }, port);
    return { c, item: item as never, menus, acted, clip: () => clip, port };
  };
  it("the bar holds Store ▶ and Copy ›; Copy › opens Full value, As shown, Exact, LaTeX, Python (R181, R720)", () => {
    const { c, item, menus } = make();
    const buttons = c.rowButtons(item);
    expect(buttons.map((b) => [b.id, b.label])).toEqual([["store", "Store ▶"], ["copy", "Copy ›"]]);
    buttons[1]?.run?.();
    expect(menus).toEqual([{ title: "Copy", ids: ["full", "shown", "exact", "latex", "python"] }]);
  });
  it("☰ has four rows in this order, Export › the fourth; Store ▶, Copy › and Paste are not rows (R830)", () => {
    const { c, item } = make();
    expect(c.menu(item).map((m) => m.id)).toEqual(["delete", "share", "clear", "export"]);
  });
  it("Copy › Full value writes what a hold on the result does and counts as copy (R720)", async () => {
    const { c, item, acted, clip, port } = make();
    await port.writeText("x"); // (a sentinel: only the run's own write can change it)
    const full = c.copyItem(item).submenu?.items[0];
    expect(full).toMatchObject({ id: "full", label: "Full value" });
    full?.run?.();
    await vi.waitFor(() => expect(clip()).toBe("1/3"));
    expect(acted).toEqual(["copy"]);
  });
  // R832 round 2: each of Copy ›'s first three rows names what it copied in the notice (the shown text, grouped as the row draws it)
  it("Copy › Full value, As shown and Exact each name the copy in the notice", async () => {
    const { c, item } = make();
    const rows = c.copyItem(item).submenu?.items ?? [];
    const say = async (id: string): Promise<string | null> => {
      rows.find((r) => r.id === id)?.run?.();
      await vi.waitFor(() => expect(c.notice).not.toBeNull());
      const n = c.notice;
      c.notice = null;
      return n;
    };
    expect(await say("full")).toBe("Copied: 0.333\u2009333\u2009333\u2009333"); // (what the row shows; the clipboard holds 1/3)
    expect(await say("shown")).toBe("Copied: 0.333\u2009333\u2009333\u2009333");
    expect(await say("exact")).toBe("Copied: 1/3");
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

// R723: Shift + Select (keyCopy) writes what a hold on the row's result does: the given row, else the last finished one;
// with none, or in an app, nothing is written and it is a dead press.
describe("ClipActions keyCopy (Shift + Select, R723)", () => {
  const make = (items: object[], app: string | null = null, mark: object | null = null) => {
    let clip = "untouched";
    const port: ClipboardPort = { writeText: async (t) => ((clip = t), true), readText: async () => clip, share: async () => false };
    const shell = { app, showsEntry: true } as unknown as AppShell;
    const acted: string[] = [];
    // (R832: the notice names the copy by the row's shown text, so the session shows the row)
    const session = { items, display: (r: { full?: string }) => ({ text: r.full ?? "", latex: "" }), mark: () => mark, input: (r: { latex: string }) => r.latex, displayContext: () => ({}) } as unknown as Session;
    const c = new ClipActions(session, shell, {} as EntryController, { insert() {}, acted: (id) => void acted.push(id) }, port);
    return { c, clip: () => clip, acted, say: () => c.notice };
  };
  const row = (full: string, status = "done") => ({ status, latex: full, full, fullExact: true, rational: undefined, facts: {} });
  it("copies the given row's full value, as a hold on its result, and counts as copy", async () => {
    const rows = [row("1/3"), row("2/3")];
    const m = make(rows);
    const dead = vi.fn();
    m.c.keyCopy(dead, rows[0] as never);
    expect(dead).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(m.clip()).toBe("1/3"));
    expect(m.acted).toEqual(["copy"]);
  });
  it("R832: the notice names the copy (one line); the lit input is copied as a hold on it does, the result lit or the row as before", async () => {
    const rows = [{ ...row("1/3"), latex: "\\frac{2}{3}" }];
    const m = make(rows);
    m.c.keyCopy(vi.fn(), rows[0] as never);
    await vi.waitFor(() => expect(m.clip()).toBe("1/3"));
    expect(m.say()).toBe("Copied: 1/3");
    expect(m.c.noticeOne).toBe(true);
    m.c.keyCopy(vi.fn(), rows[0] as never, undefined, "input");
    await vi.waitFor(() => expect(m.clip()).toBe("2/3")); // (the input \frac{2}{3} as plain text)
    expect(m.say()).toBe("Copied: 2/3");
    const long = [row("0.3333333333333333333333333333333333333333")];
    const l = make(long);
    l.c.keyCopy(vi.fn(), long[0] as never);
    await vi.waitFor(() => expect(l.say()).toBe("Copied: 0.333\u2009333\u2009333\u2009333\u2009333\u200933…")); // grouped as the row draws it (thin spaces, U+2009), 24 characters, then …
  });
  it("R832: a row drawn as ⚠ (no digit confirmed) is named ⚠ in the notice, not by the digit it hides", async () => {
    const rows = [row("0.001")];
    const m = make(rows, null, { mark: "⚠", n: 0, warn: false });
    m.c.keyCopy(vi.fn(), rows[0] as never);
    await vi.waitFor(() => expect(m.say()).toContain("Copied"));
    expect(m.say()).toBe("Copied: ⚠");
  });
  it("with no row given, the last finished row", async () => {
    const m = make([row("1/3"), row("2/3"), row("x", "error")]);
    m.c.keyCopy(() => {
      throw new Error("dead");
    });
    await vi.waitFor(() => expect(m.clip()).toBe("2/3"));
  });
  it("no finished row, a given row without a result, or an app: the dead press, and nothing written", async () => {
    const pending = row("5", "pending");
    const dead = vi.fn();
    for (const m of [make([]), make([row("x", "error")]), make([row("1/3")], "function")]) m.c.keyCopy(dead);
    const m = make([row("1/3"), pending]);
    m.c.keyCopy(dead, pending as never);
    expect(dead).toHaveBeenCalledTimes(4);
    await new Promise((r) => setTimeout(r, 20));
    expect([m.clip(), m.acted]).toEqual(["untouched", []]);
  });
});

// R130, R830: ☰ Home/CAS has four rows (their digits are learned); item 4 is Export ›, with the work report in it.
describe("ClipActions menu: Export › is item 4", () => {
  const menuOf = (items: object[]) => {
    const session = { items } as unknown as Session;
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    return new ClipActions(session, shell, {} as EntryController, { insert() {} }).menu();
  };
  it("the four rows keep their ids and order; the fourth opens Export › with the work report", () => {
    const m = menuOf([{ status: "done", latex: "2", text: "2", facts: {} }]);
    expect(m.map((i) => i.id)).toEqual(["delete", "share", "clear", "export"]);
    const exp = m[3]!;
    expect(exp.label).toBe("Export");
    expect(exp.disabled).toBe(false);
    expect(exp.submenu?.items.map((i) => [i.id, i.label, i.disabled])).toEqual([
      ["work", "Work report", false],
      ["csv", "CSV", false],
      ["latex", "LaTeX", false],
      ["python", "Python", false],
    ]);
  });
  it("with nothing finished Export › is off, and an empty history gives it no reason line (fit.spec.ts)", () => {
    expect(menuOf([])[3]).toMatchObject({ id: "export", disabled: true, reason: undefined });
    expect(menuOf([{ status: "pending", latex: "2", text: "" }])[3]).toMatchObject({ id: "export", disabled: true, reason: "No result yet" });
  });
});

// R130 fix 2: the export ends in a notice when its code does not load (an offline PWA after an update), and a second
// press waits for the first save (the clipboard chain), as Report a problem does.
describe("ClipActions export of the work", () => {
  const actions = () => {
    const session = { items: [], view: "home", decimalComma: false } as unknown as Session;
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    return new ClipActions(session, shell, {} as EntryController, { insert() {} });
  };
  afterEach(() => {
    vi.doUnmock("./workReport.ts");
  });
  it("says the report could not be saved when its code fails to load", async () => {
    vi.doMock("./workReport.ts", () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const c = actions();
    await expect(c.exportWork()).resolves.toBeUndefined();
    expect(c.notice).toBe("The work report could not be saved");
  });
  it("runs a second press after the first save has ended, never beside it", async () => {
    const log: string[] = [];
    let release = (): void => {};
    const first = new Promise<void>((r) => (release = r));
    let n = 0;
    vi.doMock("./workReport.ts", () => ({
      saveWork: async () => {
        const k = ++n;
        log.push(`start ${k}`);
        if (k === 1) await first;
        log.push(`end ${k}`);
        return `saved ${k}`;
      },
    }));
    const c = actions();
    const a = c.exportWork();
    const b = c.exportWork();
    await vi.waitFor(() => expect(log).toEqual(["start 1"]), { timeout: 5000 }); // the first save waits; the second has not started
    await new Promise((r) => setTimeout(r, 50));
    expect(log).toEqual(["start 1"]);
    release();
    await Promise.all([a, b]);
    expect(log).toEqual(["start 1", "end 1", "start 2", "end 2"]);
    expect(c.notice).toBe("saved 2");
  });
});

// R200: ☰ › Export › CSV and LaTeX: the open session as a file through the save port (files.ts), named n62-<date>.<ext>.
describe("ClipActions exportCsv and exportLatex", () => {
  const saved: { name: string; mime: string; text: string }[] = [];
  const actions = (items: object[]) => {
    const session = { items, view: "home", decimalComma: false, displayContext: () => ({ format: "std", digits: 12, fixDecimals: 4, angle: "rad" }) } as unknown as Session;
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    return new ClipActions(session, shell, {} as EntryController, { insert() {} });
  };
  const half = { status: "done", latex: "\\frac12", resultLatex: "0.5", text: "0.5", full: "1/2", fullExact: true, facts: { exact: true, reliableDigits: null }, rational: { n: "1", d: "2" } };
  afterEach(() => {
    vi.doUnmock("./files.ts");
    saved.length = 0;
  });
  const fake = (result: string) =>
    vi.doMock("./files.ts", () => ({
      saveFile: async (name: string, mime: string, text: string) => {
        saved.push({ name, mime, text });
        return result;
      },
    }));
  it("exportCsv saves n62-<date>.csv through saveFile and says so", async () => {
    fake("saved");
    const c = actions([half]);
    await c.exportCsv();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toMatch(/^n62-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(saved[0]?.mime).toBe("text/csv");
    expect(saved[0]?.text.split("\r\n")[0]).toBe("input,value,mark,unit,sigma");
    expect(c.notice).toBe("CSV saved");
  });
  it("exportLatex saves n62-<date>.tex through saveFile and says so", async () => {
    fake("offered");
    const c = actions([half]);
    await c.exportLatex();
    expect(saved[0]?.name).toMatch(/^n62-\d{4}-\d{2}-\d{2}\.tex$/);
    expect(saved[0]?.text).toContain("\\begin{align*}");
    expect(c.notice).toBe("LaTeX offered as a download");
  });
  it("nothing to export says so and saves nothing", async () => {
    fake("saved");
    const c = actions([{ status: "pending", latex: "2", text: "" }]);
    await c.exportCsv();
    expect(c.notice).toBe("Nothing to export");
    await c.exportLatex();
    expect(c.notice).toBe("Nothing to export");
    expect(saved).toEqual([]);
  });
  it("a cancelled or failed save is the notice", async () => {
    fake("cancelled");
    const c = actions([half]);
    await c.exportCsv();
    expect(c.notice).toBe("CSV not saved");
    vi.doUnmock("./files.ts");
    fake("failed");
    await c.exportLatex();
    expect(c.notice).toBe("The LaTeX could not be saved");
  });
});

// R181: Copy › Python puts the row's sympy text on the clipboard; ☰ › Export › Python saves the session as n62-<date>.py.
describe("ClipActions copyPython and savePython", () => {
  const saved: { name: string; mime: string; text: string }[] = [];
  let clip = "";
  const port: ClipboardPort = { writeText: async (t) => ((clip = t), true), readText: async () => clip, share: async () => false };
  const third = { status: "done", view: "home", latex: "\\frac{1}{3}", text: "0.333333333333", full: "1/3", fullExact: true, facts: { exact: true, reliableDigits: null }, rational: { n: "1", d: "3" } };
  const actions = (items: object[]) => {
    const session = { items, view: "home", decimalComma: false, displayContext: () => ({ format: "std", digits: 12, fixDecimals: 4, angle: "rad" }) } as unknown as Session;
    const shell = { app: null, showsEntry: true } as unknown as AppShell;
    return new ClipActions(session, shell, {} as EntryController, { insert() {} }, port);
  };
  afterEach(() => {
    vi.doUnmock("./files.ts");
    saved.length = 0;
    clip = "";
  });
  it("copyPython puts translateRows of the row on the clipboard", async () => {
    const c = actions([third]);
    expect(await c.copyPython()).toBe(true);
    expect(clip).toContain("Rational(1, 3)");
    expect(clip.split("\n")[0]).toMatch(/^# N62 .*Copy as Python/);
    expect(c.notice).toBe("Copied");
  });
  it("copyPython of a picked row copies that row, not the last", async () => {
    const four = { ...third, latex: "2^2", full: "4", rational: { n: "4", d: "1" } };
    const c = actions([third, four]);
    await c.copyPython(third as never);
    expect(clip).toContain("Rational(1, 3)");
    expect(clip).not.toContain("Integer(4)");
  });
  it("savePython saves n62-<date>.py through saveFile with every finished row", async () => {
    vi.doMock("./files.ts", () => ({ saveFile: async (name: string, mime: string, text: string) => (saved.push({ name, mime, text }), "saved") }));
    const c = actions([third, { status: "pending", latex: "2", text: "" }, third]);
    await c.savePython();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toMatch(/^n62-\d{4}-\d{2}-\d{2}\.py$/);
    expect(saved[0]?.mime).toBe("text/x-python");
    expect(saved[0]?.text.match(/Rational\(1, 3\)/g)).toHaveLength(2);
    expect(c.notice).toBe("Python saved");
  });
  it("nothing finished says so and saves nothing; a cancelled or failed save is the notice", async () => {
    vi.doMock("./files.ts", () => ({ saveFile: async (name: string, mime: string, text: string) => (saved.push({ name, mime, text }), "failed") }));
    const c = actions([{ status: "pending", latex: "2", text: "" }]);
    await c.savePython();
    expect(c.notice).toBe("Nothing to export");
    expect(saved).toEqual([]);
    const d = actions([third]);
    await d.savePython();
    expect(d.notice).toBe("The Python could not be saved");
  });
});
