// SPDX-License-Identifier: GPL-3.0-or-later
// R916 (layers study 2026-11-23; the owner's layer contract, docs/04 5.5): a layer over Home owns four channels while it is up:
// keys, taps on the screen, what follows the focus (hardware keys, paste, typing, cut) and back. This sweep opens the unit view
// (on a typed line; on a picked row) and fires every channel at it. One invariant: Home's line and its history change only
// through the view's own list: Enter files the view's row (a unit row), Store ▶ stores its result (unitresultstore.spec.ts), Esc,
// back and a key that changes place leave with the line as it was taken (its slots kept), the focus back on the line. A sheet
// the view opens over itself is the view's only for the keys and taps named in SHEET_KEYS and SHEET_TAPS (Mode, Find on units,
// ☰, APP▾'s places); any other sheet is a leak. A sheet is closed again with Esc and the sweep goes on.
// Each case is checked against the state just before it, so one leak does not hide the next. KNOWN holds today's failures:
// a line comes out with the package that removes it (red first: the case must then pass); a case that leaks and is not listed
// fails, and so does a listed case that no longer leaks. Real engine (Enter must file a unit row), 412 × 915.
import { expect, test, type Page } from "@playwright/test";
import { historyPoint, open, tap } from "./helpers.ts";

/** Today's failures: the case, its finding and the package that removes it. F368 (the angle word, R915) has no line: R915
 *  closed it, and the picked test checks it. F370 F371 (R917): a tap waits for the units load, Esc gives the lent line back
 *  with the focus on it (test/unitopen.spec.ts). F366 F367 (R918): a tap on a history row under the view is a dead press
 *  (test/unittap.spec.ts). */
const KNOWN: readonly { case: string; f: string; by: string }[] = [];

type Snap = {
  line: string;
  /** Home's rows that are not the view's own (a unit row is the view's: Enter files it, a later result takes its place). */
  rows: string;
  view: boolean;
  sheet: string | null;
  prompt: boolean;
  pick: boolean;
  focus: string;
  angle: string;
  place: string;
};
const snap = (page: Page): Promise<Snap> =>
  page.evaluate(() => {
    const n = window.n62;
    const sh = n.shell.sheet as unknown as { id?: string } | null;
    const a = document.activeElement;
    return {
      line: n.entry.value,
      rows: n.session.home.filter((r) => r.units === undefined).map((r) => `${r.id}:${r.status}:${r.latex}=${r.text}`).join(" | "),
      view: n.unitView !== undefined,
      sheet: sh ? (sh.id ?? "?") : null,
      prompt: n.shell.prompt !== null && n.shell.prompt !== undefined,
      pick: document.querySelector('article.item[data-selected="true"]') !== null,
      focus: a === n.unitView?.element ? "view" : a?.tagName === "MATH-FIELD" ? "line" : (a?.tagName.toLowerCase() ?? "none"),
      angle: n.session.settings.angle,
      place: n.shell.app === null ? n.session.view : `app:${String(n.shell.app)}`,
    };
  });

/** Wait until the state reads the same three times in a row (a sheet, a lazy chunk or an evaluation settles). */
async function settle(page: Page): Promise<Snap> {
  let last = "";
  let same = 0;
  for (let i = 0; i < 60 && same < 3; i++) {
    await page.waitForTimeout(40);
    const s = JSON.stringify(await snap(page));
    same = s === last ? same + 1 : 0;
    last = s;
  }
  return JSON.parse(last) as Snap;
}

const viewUp = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const ready = (page: Page): Promise<unknown> => page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
const done = (page: Page, n: number): Promise<void> => expect(page.locator('article.item[data-status="done"]')).toHaveCount(n);
const row = (page: Page, i: number) => page.locator("article.item").nth(i).locator(".result");

/** The cases that broke the invariant in one test, against KNOWN at its end. */
class Sweep {
  readonly bad = new Map<string, string>();
  constructor(private readonly page: Page, readonly name: string) {}

  /** Fire one channel; `allow` says what the view's list lets it do (default: nothing but the view's own state). */
  async fire(id: string, act: () => Promise<unknown>, allow: { leaves?: boolean; sheet?: string | undefined } = {}): Promise<Snap> {
    const before = await snap(this.page);
    await act();
    let after = await settle(this.page);
    const why: string[] = [];
    if (after.line !== before.line) why.push(`line ${before.line} → ${after.line}`);
    if (after.rows !== before.rows) why.push(`rows ${before.rows} → ${after.rows}`);
    if (after.prompt) why.push("a name prompt opened");
    if (after.pick && !before.pick) why.push("a row is picked");
    if (after.sheet !== null && after.sheet !== allow.sheet && after.sheet !== before.sheet) why.push(`sheet ${after.sheet}`);
    if (!allow.leaves && !after.view) why.push("the view left");
    if (allow.leaves && !after.view && after.place === "home" && after.focus !== "line" && after.sheet === null) why.push(`focus on ${after.focus}`);
    if (after.view && after.sheet === null && after.focus !== "view") why.push(`focus on ${after.focus}`);
    if (why.length > 0) this.bad.set(`${this.name} ${id}`, why.join("; "));
    // a sheet over the view (the view's, or a leak) is closed again so the next case starts from the view
    for (let i = 0; i < 3 && after.sheet !== null; i++) {
      await tap(this.page, ["esc"]);
      after = await settle(this.page);
    }
    return after;
  }

  /** The leave: Esc (or back) gives the line back as it was taken, the focus on it. */
  async leave(id: string, taken: string, act: () => Promise<unknown>): Promise<void> {
    await act();
    const s = await settle(this.page);
    const why: string[] = [];
    if (s.view) why.push("the view stays");
    if (s.line !== taken) why.push(`line ${taken} → ${s.line}`);
    if (s.pick) why.push("a row is still picked");
    if (s.focus !== "line") why.push(`focus on ${s.focus}`);
    if (why.length > 0) this.bad.set(`${this.name} ${id}`, why.join("; "));
  }

  /** The cases that leaked are exactly this test's KNOWN lines. */
  check(): void {
    const known = KNOWN.filter((k) => k.case.startsWith(`${this.name} `)).map((k) => k.case).sort();
    const seen = [...this.bad.keys()].sort();
    expect(seen, `leaks: ${JSON.stringify(Object.fromEntries(this.bad), null, 1)}`).toEqual(known);
  }
}

/** A system paste as Ctrl+V, Shift+Insert or the context menu deliver it: a `paste` event on what has the focus. */
const paste = (page: Page, text: string): Promise<void> =>
  page.evaluate((t) => {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    const d = new DataTransfer();
    d.setData("text/plain", t);
    (el ?? document.body).dispatchEvent(new ClipboardEvent("paste", { clipboardData: d, bubbles: true, cancelable: true, composed: true }));
  }, text);

/** The hardware channels: a paste (its event and its keys), a symbol MathLive types itself (`!`), a character from an IME, Select all + cut. */
async function focusChannels(s: Sweep, page: Page): Promise<void> {
  await s.fire("paste", () => paste(page, "5"));
  await s.fire("hw:ctrl+v", () => page.keyboard.press("Control+V")); // the keydown of a paste (the Paste key's path, R895)
  await s.fire("hw:!", () => page.keyboard.press("!"));
  await s.fire("hw:ime", () => page.keyboard.insertText("µ"));
  await s.fire("hw:cut", async () => {
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Control+X");
  });
}

/** The keys whose press may open a sheet over the view (the view's own list): key id → the sheet it opens. A sheet any other
 *  key opens is a leak. */
const SHEET_KEYS: Readonly<Record<string, string>> = { help: "list:Mode", math: "find" }; // ⚙ = Mode; Math = Find on units

/** The sheets a tap on the bar may open over the view: the format chip's, ☰'s, APP▾'s (the place picker). */
const SHEET_TAPS: Readonly<Record<string, string>> = { format: "list:Mode", menu: "list:Units", place: "apps" };

/** Opens the view again as the test first opened it (on the typed line; on the picked row). */
type Reopen = () => Promise<void>;

/** The keys a picked history row takes (keyboard/route.ts historyKey): fired after a tap on a row under the view (R918: it picks nothing). */
const PICK_KEYS = ["up", "down", "left", "right", "bksp", "select", "deselect"] as const;

/** The channels both tests fire at the view: every key of the keypad (Esc last), the bar's controls, the tabs and APP▾,
 *  Android back; last a history row, and the keys a pick takes after a tap on it. */
async function sweep(s: Sweep, page: Page, taken: string, reopen: Reopen): Promise<void> {
  // keys: every key of the keypad (the unit pad's cells in their place), one press each
  const ids = await page.locator("[data-key]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-key") ?? ""))]);
  expect(ids.length).toBeGreaterThan(40);
  for (const id of ids.filter((k) => k !== "esc")) {
    await s.fire(`key:${id}`, () => tap(page, [id]), { sheet: SHEET_KEYS[id] });
    if (id === "shift" || id === "alpha") await page.evaluate(() => window.n62.session.clearModifiers());
  }
  await s.leave("key:esc", taken, () => tap(page, ["esc"]));

  // the bar: the format chip and ☰ open their sheets over the view; ⌄ folds the keys (F369: nothing is lost), ⌃ unfolds them
  await reopen();
  await s.fire("tap:format", () => page.getByTestId("chip-format").tap(), { sheet: SHEET_TAPS.format });
  await s.fire("tap:menu", () => page.getByTestId("menu-button").tap(), { sheet: SHEET_TAPS.menu });
  await s.fire("tap:fold", () => page.getByTestId("fold-chevron").tap());
  await s.fire("tap:unfold", () => page.getByTestId("fold-slice").tap());
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");

  // the tabs and APP▾ change place: the view leaves first, Home's line is kept with its slots
  for (const [id, sel] of [["tab:home", "tab-home"], ["tab:slot", "tab-slot"], ["place", "place"]] as const) {
    if (!(await snap(page)).view) await reopen();
    await s.fire(id, () => page.getByTestId(sel).tap(), { leaves: true, sheet: SHEET_TAPS[id] });
    if ((await snap(page)).place !== "home") await page.getByTestId("tab-home").tap();
    const home = await settle(page);
    if (home.line !== taken || home.view) s.bad.set(`${s.name} ${id}`, `${s.bad.get(`${s.name} ${id}`) ?? ""} Home's line ${taken} → ${home.line}`);
  }

  // Android back is Esc for the view
  await reopen();
  await s.leave("back", taken, () => page.goBack());

  // last: a history row (R918: a dead press, no pick and no row bar under the view), then the keys a pick would take, each
  // after a tap on the row
  await reopen();
  await s.fire("tap:row", () => row(page, 0).tap());
  await expect(page.getByTestId("row-actions")).toHaveCount(0);
  for (const id of PICK_KEYS) {
    if (!(await snap(page)).pick) await row(page, 0).tap();
    await s.fire(`pick:${id}`, () => tap(page, [id]));
  }
  // (a leak above left its edit on the line: it is set back, so the next case starts from the line as taken)
  await tap(page, ["esc"]);
  await settle(page);
  await tap(page, ["esc"]); // (Home's Esc: a pick left over is let go, the line cleared)
  await settle(page);
  await page.evaluate((l) => window.n62.entry.set(l), taken);
  await reopen();
  await s.fire("tap:row2", async () => {
    await row(page, 0).tap();
    await row(page, 0).tap();
  });
}

test.describe("R916: every input channel against the unit view", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
  });

  test("on a typed line: every key, every control on the screen and the bar, paste, hardware keys, back", async ({ page }) => {
    test.setTimeout(80_000);
    await open(page, "");
    await ready(page);
    await tap(page, ["d5", "enter"]);
    await done(page, 1);
    await tap(page, ["d7", "d2", "shift", "tmpl"]);
    await viewUp(page);
    const s = new Sweep(page, "typed");
    const taken = (await snap(page)).line;
    expect(taken).toBe("72");
    const reopen = async (): Promise<void> => {
      await tap(page, ["shift", "tmpl"]);
      await viewUp(page);
    };

    // the view's own list: k m, Enter files the view's row (72 km) and nothing else
    await s.fire("enter", () => tap(page, ["d4", "d9", "enter"]));
    await expect.poll(() => page.evaluate(() => window.n62.session.home.filter((r) => r.units !== undefined).length)).toBe(1);
    await s.fire("tap:angle", () => page.getByTestId("chip-angle").tap());
    await s.fire("tap:angle2", () => page.getByTestId("chip-angle").tap());
    await focusChannels(s, page);
    await sweep(s, page, taken, reopen);
    s.check();
  });

  test("on a picked row: the view's result follows the angle word; every channel as on a typed line; a pick does not outlive it", async ({ page }) => {
    test.setTimeout(80_000);
    await open(page, "");
    await ready(page);
    await tap(page, ["d5", "enter"]);
    await done(page, 1);
    await tap(page, ["sin", "d3", "d0", "enter"]);
    await done(page, 2);
    await tap(page, ["up", "shift", "tmpl"]); // ▲ picks the last row; the units key opens the view on its input
    await viewUp(page);
    const s = new Sweep(page, "picked");
    const taken = await snap(page);
    expect(taken.angle).toBe("rad");
    expect(taken.pick).toBe(false);
    // the view opens again on the same row: picked by a tap (▲ would pick the view's own row once Enter filed it)
    const reopen = async (): Promise<void> => {
      await row(page, 1).tap();
      await expect.poll(async () => (await snap(page)).pick).toBe(true);
      await tap(page, ["shift", "tmpl"]);
      await viewUp(page);
    };
    await s.fire("key:enter", () => tap(page, ["enter"]));
    const unitRow = page.locator("article.item").last().locator(".result");
    await expect(unitRow).toContainText("0.988");
    // F368 (R915): the bar's angle word asks again: sin(30°) = 0.5 (derived), the row too
    await s.fire("tap:angle", () => page.getByTestId("chip-angle").tap());
    await expect(unitRow).toContainText("0.5");
    await s.fire("tap:angle2", () => page.getByTestId("chip-angle").tap());
    await expect(unitRow).toContainText("0.988");
    await focusChannels(s, page);
    await sweep(s, page, taken.line, reopen);
    await s.leave("esc:pick", taken.line, () => tap(page, ["esc"]));
    s.check();
  });

  test("while the view opens: taps on a row wait for it or do nothing; Esc gives the line back", async ({ page }) => {
    // window (a): the units chunk still loading (keys wait for a load, R8; taps do not)
    await page.route(/\/src\/units\/open\.ts/, async (r) => {
      await new Promise((d) => setTimeout(d, 1500));
      await r.continue();
    });
    await open(page);
    await tap(page, ["d5", "enter"]);
    await done(page, 1);
    await tap(page, ["d7", "d2"]);
    const s = new Sweep(page, "window");
    const before = await snap(page);
    await tap(page, ["shift", "tmpl"]);
    await row(page, 0).tap();
    await row(page, 0).tap();
    await viewUp(page);
    const after = await settle(page);
    if (after.line !== before.line) s.bad.set("window tap:row2", `line ${before.line} → ${after.line}`);
    await s.leave("esc", before.line, () => tap(page, ["esc"]));
    s.check();
  });
});

// R921 (part 2): the same rule for the other layers over Home: the sheets (Mode, ☰, Apps, Settings, Find, Vars, Memory, "Store 7 in")
// and the name prompt (Mode › Presets › Save). Each is opened on Home's line with one history row and every channel of part 1 is
// fired at it: every key of the keypad, the taps (the history row, the line, the bar's controls), a system paste and Ctrl+V,
// a hardware `!`, µ (MathLive's own text input), Ctrl+A Ctrl+X, Undo (the key and Ctrl+Z), Esc and back. One invariant: Home's
// line and its history change only through the layer's own list (LayerDef.acts: its picks, Enter, ▶ and the keys that keep their
// job in a sheet, sheetKeys.ts; Store's keys that type no name go on to the line, R281; a key the prompt does not take ends it
// first). Any other channel leaves the layer where it is and the line and the history as they were; a leave (Esc, back, a tap on
// the history, a bar control) leaves Home's line as it was taken. A name prompt's line is the name: it never shows Home's line
// (F374, R898's undo boundary). After a case that moved the layer, the test opens it again as at the start. The fake engine
// (Enter echoes), 412 × 915. KNOWN2: today's failures as in part 1 (F372 F373 by R922, F374 by R898, F375 by R919 are closed).

const KNOWN2: readonly { case: string; f: string; by: string }[] = [
  // a tap on a history row under the name prompt picks the row and shows its bar; the prompt stays (askName's comment: a tap that
  // goes elsewhere ends the prompt first). Nothing is lost: the bar's Store ▶ ends the prompt, the line comes back. No package yet.
  { case: "prompt tap:row", f: "new (R921)", by: "decisions.md, Needs the user (R921)" },
];

/** A layer's state: Home's line (the name while a prompt is up) and rows, the layer (`where`: the sheet's id and title, or the
 *  prompt's label; "" for none), the place, a picked row, the focus and Alpha. */
type LSnap = { line: string; rows: string; where: string; place: string; pick: boolean; focus: string; mods: string };
const lsnap = (page: Page): Promise<LSnap> =>
  page.evaluate(() => {
    const n = window.n62;
    const sh = n.shell.sheet as unknown as { id?: string } | null;
    const p = n.shell.prompt as unknown as { label?: string } | null;
    const title = document.querySelector('[data-testid="sheet-title"]')?.textContent ?? "";
    const a = document.activeElement;
    return {
      line: n.entry.value,
      rows: n.session.home.map((r) => `${r.id}:${r.status}:${r.latex}`).join(" | "),
      where: p ? `prompt:${p.label ?? "?"}` : sh ? `${sh.id ?? "?"}:${title}` : "",
      place: n.shell.app === null ? n.session.view : `app:${String(n.shell.app)}`,
      pick: document.querySelector('article.item[data-selected="true"]') !== null,
      focus: a?.tagName === "MATH-FIELD" ? "line" : (a?.tagName.toLowerCase() ?? "none"),
      mods: `${n.session.shift ? "S" : ""}${n.session.alpha ? "A" : ""}`,
    };
  });

/** As `settle`, for a layer's state. */
async function lsettle(page: Page): Promise<LSnap> {
  let last = "";
  let same = 0;
  for (let i = 0; i < 90 && same < 2; i++) {
    await page.waitForTimeout(20);
    const s = JSON.stringify(await lsnap(page));
    same = s === last ? same + 1 : 0;
    last = s;
  }
  return JSON.parse(last) as LSnap;
}

/** A layer over Home: how it opens from Home's line `pre` (one history row under it), and its own list. */
type LayerDef = {
  name: string;
  pre: string;
  open: (page: Page) => Promise<void>;
  /** The keys of the layer's list: they may move or close it, and then act on the line and the history (a pick, Enter). */
  acts: (id: string) => boolean;
  /** A name prompt: the line is the name (it may change while the prompt stays, never to Home's line). */
  prompt?: boolean;
};

/** A sheet's own keys (sheetKeys.ts): ▲ ▼ ◀ ▶ Enter Esc ⌫, the picks (the digits, `.` and the space bar, R780), the ⚙ key (Settings
 *  as the sheet's next level, R887) and Tmpl (its sheet). Shift and Alpha keep their state (cleared after each). */
const SHEET_LIST = new Set(["up", "down", "left", "right", "enter", "esc", "bksp", "dot", "space", "help", "tmpl", "shift", "alpha"]);
const sheetActs = (id: string): boolean => SHEET_LIST.has(id) || /^d[0-9]$/.test(id);
const chip = (page: Page): Promise<void> => page.getByTestId("chip-format").tap();
const LAYERS: readonly LayerDef[] = [
  { name: "Mode", pre: "7+1", open: chip, acts: sheetActs },
  { name: "☰", pre: "7+1", open: (page) => page.getByTestId("menu-button").tap(), acts: sheetActs },
  { name: "Apps", pre: "7+1", open: (page) => page.getByTestId("place").tap(), acts: sheetActs },
  { name: "Settings", pre: "7+1", open: (page) => tap(page, ["help"]), acts: sheetActs },
  { name: "Find", pre: "7+1", open: (page) => tap(page, ["math"]), acts: sheetActs },
  { name: "Vars", pre: "7+1", open: (page) => tap(page, ["vars"]), acts: sheetActs },
  { name: "Memory", pre: "7+1", open: (page) => tap(page, ["shift", "math"]), acts: sheetActs },
  // R281: a key that types no name closes "Store in" and does its job on the line (Undo, sin, a free key's Your keys): all its list
  { name: "Store", pre: "", open: (page) => tap(page, ["d7", "shift", "emark"]), acts: () => true },
  // askName (views/presetsView.svelte.ts): a key types the name, Enter saves, a key that goes elsewhere ends the prompt first
  {
    name: "prompt",
    pre: "7+1",
    open: async (page) => {
      await chip(page);
      await tap(page, ["d5", "d1"]);
    },
    acts: () => true,
    prompt: true,
  },
];

/** A test of one layer: the cases that broke the invariant, against KNOWN2 at its end. */
class LayerSweep {
  readonly bad = new Map<string, string>();
  root!: LSnap;
  constructor(private readonly page: Page, readonly def: LayerDef) {}

  /** Home's line under the layer (the name prompt holds it aside). */
  taken = "";

  /** From Home with the line `pre`, the layer opens: the state every case starts from. */
  async start(): Promise<void> {
    await this.page.evaluate((l) => window.n62.entry.set(l), this.def.pre);
    await this.def.open(this.page);
    this.root = await lsettle(this.page);
    expect(this.root.where, `${this.def.name} opens`).not.toBe("");
    if (!this.def.prompt) this.taken = this.root.line;
  }

  /** Back to the layer as it opened: everything closed, Home, the line and the modifiers as they were, the layer again. */
  async reset(): Promise<void> {
    // a sheet one level deeper (a pick, ▶, ⚙): Esc goes back to the layer as it opened, Home as it was
    const s0 = await lsnap(this.page);
    const sheet = (w: string): string => w.slice(0, w.indexOf(":"));
    if (!this.def.prompt && s0.where !== this.root.where && sheet(s0.where) === sheet(this.root.where) && s0.place === "home" && s0.mods === "" && s0.line === this.taken) {
      await tap(this.page, ["esc"]);
      if (JSON.stringify(await lsettle(this.page)) === JSON.stringify(this.root)) return;
    }
    for (let i = 0; i < 5; i++) {
      const s = await lsnap(this.page);
      if (s.where === "" && s.place === "home") break;
      if (s.where !== "") await tap(this.page, ["esc"]);
      else await this.page.getByTestId("tab-home").tap();
      await lsettle(this.page);
    }
    if ((await this.page.getByTestId("keys").getAttribute("data-folded")) === "true") await this.page.getByTestId("fold-slice").tap();
    await this.page.evaluate(() => window.n62.session.clearModifiers());
    await this.start();
  }

  /** The layer's name line holds one of Home's line's own states (its undo walked out of the name, F374). */
  private homeLine(s: LSnap): boolean {
    return !!this.def.prompt && s.where === this.root.where && s.line.length >= 2 && this.taken.startsWith(s.line);
  }

  /**
   * Fire one channel. `list`: the case is the layer's own (it may move or close the layer and then act); `leave`: the layer may
   * close or give way to another (Esc, back, a tap outside it, a bar control), Home's line kept; otherwise it must stay as it is.
   */
  async fire(id: string, act: () => Promise<unknown>, how: "stay" | "list" | "leave" | "exit" = "stay", picks = false): Promise<void> {
    const before = await lsnap(this.page);
    await act();
    const after = await lsettle(this.page);
    const why: string[] = [];
    const stays = after.where === before.where && after.place === before.place;
    if (how === "exit" && stays) why.push(`the layer stays (${after.where}${after.mods !== before.mods ? `, modifiers ${before.mods || "none"} → ${after.mods || "none"}` : ""})`);
    if (how === "exit") how = "leave";
    const moved = !stays && how !== "stay";
    if (!stays && how === "stay") why.push(`the layer ${before.where} → ${after.where || "none"} (${after.place})`);
    if (after.rows !== before.rows && !(moved && how === "list")) why.push(`rows ${before.rows} → ${after.rows}`);
    if (after.pick && !before.pick && !(moved && (how === "list" || picks))) why.push("a row is picked");
    if (this.homeLine(after)) why.push(`the name line shows Home's ${after.line}`);
    const homeLine = after.where.startsWith("prompt:") ? undefined : after.place === "home" ? after.line : undefined;
    if (stays && !this.def.prompt && after.line !== before.line) why.push(`line ${before.line} → ${after.line}`);
    if (!stays && how === "leave" && homeLine !== undefined && homeLine !== this.taken) why.push(`Home's line ${this.taken} → ${homeLine}`);
    if (!stays && how === "leave" && after.where === "" && after.place === "home" && after.focus !== "line") why.push(`focus on ${after.focus}`);
    if (!stays && how === "leave" && after.place !== "home") {
      await this.page.getByTestId("tab-home").tap();
      const home = await lsettle(this.page);
      if (home.line !== this.taken && !home.where.startsWith("prompt:")) why.push(`Home's line ${this.taken} → ${home.line} (back at Home)`);
    }
    if (why.length > 0) this.bad.set(`${this.def.name} ${id}`, why.join("; "));
    const now = await lsnap(this.page);
    if (now.where !== this.root.where || now.place !== this.root.place || now.mods !== this.root.mods || (!this.def.prompt && now.line !== this.taken)) await this.reset();
    else if (this.def.prompt && now.line !== this.root.line) await this.page.evaluate((l) => window.n62.entry.set(l), this.root.line); // (a typed name is let go: the next case starts from the empty name)
  }

  check(): void {
    const known = KNOWN2.filter((k) => k.case.startsWith(`${this.def.name} `)).map((k) => k.case).sort();
    const seen = [...this.bad.keys()].sort();
    expect(seen, `leaks: ${JSON.stringify(Object.fromEntries(this.bad), null, 1)}`).toEqual(known);
  }
}

/** The line is uncovered: the point at its middle is the field's. */
const lineShows = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const f = window.n62.entry.field;
    const b = f?.getBoundingClientRect();
    return !!f && !!b && b.width > 0 && document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest("math-field") === f;
  });

/** The bar's controls a tap may reach under a layer: the format chip (Mode), ☰, APP▾ (Apps), the angle word, the fold, the tabs. */
const BAR: readonly [string, string][] = [
  ["format", "chip-format"],
  ["menu", "menu-button"],
  ["place", "place"],
  ["angle", "chip-angle"],
  ["fold", "fold-chevron"],
  ["tab:slot", "tab-slot"],
  ["tab:home", "tab-home"],
];

test.describe("R921: every input channel against the sheets and the name prompt", () => {
  test.describe.configure({ mode: "parallel" });
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
  });

  for (const def of LAYERS) {
    test(`${def.name}: keys, taps, paste, hardware keys, cut, Undo, Esc and back change Home's line and history only through its list`, async ({ page }) => {
      test.setTimeout(90_000);
      await open(page);
      await tap(page, ["d5", "enter"]);
      await done(page, 1);
      const s = new LayerSweep(page, def);
      s.taken = def.pre;
      await s.start();

      // what follows the focus: a system paste, Ctrl+V's keydown, a hardware `!`, µ, Select all + cut, Ctrl+Z
      await s.fire("paste", () => paste(page, "5"));
      await s.fire("hw:ctrl+v", () => page.keyboard.press("Control+V"));
      await s.fire("hw:!", () => page.keyboard.press("!"));
      await s.fire("hw:ime", () => page.keyboard.insertText("µ"));
      await s.fire("hw:cut", async () => {
        await page.keyboard.press("Control+A");
        await page.keyboard.press("Control+X");
      });
      await s.fire("hw:undo", () => page.keyboard.press("Control+Z"), def.acts("undo") ? "list" : "stay"); // (Ctrl+Z is the Undo key)
      if (def.prompt) {
        // F374: a name typed, then Undo more often than it has steps, never walks into Home's line
        await s.fire("undo-walk", async () => {
          await page.keyboard.press("z");
          for (let i = 0; i < 3; i++) await tap(page, ["undo"]);
        }, "list");
      }

      // keys: every key of the keypad, one press each (Esc last, as a leave)
      const ids = await page.locator("[data-key]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-key") ?? ""))]);
      expect(ids.length).toBeGreaterThan(40);
      for (const id of ids.filter((k) => k !== "esc")) await s.fire(`key:${id}`, () => tap(page, [id]), def.acts(id) ? "list" : "stay");

      // taps: the line under the layer, the bar's controls, the history row (outside the layer: it closes, nothing else)
      // (the line where the layer leaves it uncovered: under a sheet a tap there is the sheet's)
      if (await lineShows(page)) await s.fire("tap:line", () => page.locator("math-field").first().tap(), "leave");
      for (const [id, sel] of BAR) if (await page.getByTestId(sel).isVisible()) await s.fire(`tap:${id}`, () => page.getByTestId(sel).tap(), "leave");
      if (def.prompt) await s.fire("tap:row", () => row(page, 0).tap(), "leave", true); // (askName: the tap ends the prompt, then picks as on Home)
      else {
        const p = await historyPoint(page); // (outside the sheet: a tap there closes it and does nothing else, sheetoutside.spec.ts)
        if (p) await s.fire("tap:history", () => page.mouse.click(p.x, p.y), "leave");
      }

      // the leaves: Esc and Android back
      await s.fire("key:esc", () => tap(page, ["esc"]), "exit");
      await s.fire("back", () => page.goBack(), "exit");
      s.check();
    });
  }
});
