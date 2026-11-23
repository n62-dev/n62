// SPDX-License-Identifier: GPL-3.0-or-later
// R916 (layers study 2026-11-23; the owner's layer contract, docs/04 5.5): a layer over Home owns four channels while it is up:
// keys, taps on the screen, what follows the focus (hardware keys, paste, typing, cut) and back. This sweep opens the unit view
// (on a typed line; on a picked row) and fires every channel at it. One invariant: Home's line and its history change only
// through the view's own list: Enter files the view's row (a unit row), Store ▶ stores its result (unitresultstore.spec.ts), Esc,
// back and a key that changes place leave with the line as it was taken (its slots kept), the focus back on the line. A sheet
// the view opens over itself (Mode, Find on units, ☰) is the view's; it is closed again with Esc and the sweep goes on.
// Each case is checked against the state just before it, so one leak does not hide the next. KNOWN holds today's failures:
// a line comes out with the package that removes it (red first: the case must then pass); a case that leaks and is not listed
// fails, and so does a listed case that no longer leaks. Real engine (Enter must file a unit row), 412 × 915.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

/** Today's failures: the case, its finding and the package that removes it. */
const KNOWN: readonly { case: string; f: string; by: string }[] = [
  { case: "typed tap:row", f: "F367", by: "R918" }, // a tap on a history row picks it under the view (the rule: a dead press)
  { case: "typed rowbar:copy", f: "F366", by: "R918" }, // the row bar is up under the view: its Copy opens a sheet over the view
  { case: "typed rowbar:store", f: "F366", by: "R918" }, // the row bar's Store ▶ writes 72[5]▶ into the lent line, "Store 725 in" opens
  { case: "typed tap:row2", f: "R888's case (F366's family)", by: "R918" }, // a second tap puts the row's chip into the lent line
  { case: "picked tap:row", f: "F367", by: "R918" },
  { case: "picked esc:pick", f: "F367", by: "R918" }, // a row picked under the view outlives it: Enter then puts the row on the line
  { case: "window tap:row2", f: "F370", by: "R917" }, // two row taps while the units chunk loads edit the line the view is built on
  { case: "window esc", f: "F370", by: "R917" }, // after Esc the line is 72[5] and the focus is on body
];

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
  constructor(private readonly page: Page, private readonly name: string) {}

  /** Fire one channel; `allow` says what the view's list lets it do (default: nothing but the view's own state). */
  async fire(id: string, act: () => Promise<unknown>, allow: { leaves?: boolean; sheet?: boolean } = {}): Promise<Snap> {
    const before = await snap(this.page);
    await act();
    let after = await settle(this.page);
    const why: string[] = [];
    if (after.line !== before.line) why.push(`line ${before.line} → ${after.line}`);
    if (after.rows !== before.rows) why.push(`rows ${before.rows} → ${after.rows}`);
    if (after.prompt) why.push("a name prompt opened");
    if (after.pick && !before.pick) why.push("a row is picked");
    if (after.sheet !== null && !allow.sheet && after.sheet !== before.sheet) why.push(`sheet ${after.sheet}`);
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

test.describe("R916: every input channel against the unit view", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
  });

  test("on a typed line: every key, every control on the screen and the bar, paste, hardware keys, back", async ({ page }) => {
    test.setTimeout(60_000);
    await open(page, "");
    await ready(page);
    await tap(page, ["d5", "enter"]);
    await done(page, 1);
    await tap(page, ["d7", "d2", "shift", "tmpl"]);
    await viewUp(page);
    const s = new Sweep(page, "typed");
    const taken = (await snap(page)).line;
    expect(taken).toBe("72");

    // the view's own list: k m, Enter files the view's row (72 km) and nothing else
    await s.fire("enter", () => tap(page, ["d4", "d9", "enter"]));
    await expect.poll(() => page.evaluate(() => window.n62.session.home.filter((r) => r.units !== undefined).length)).toBe(1);
    // keys: every key of the keypad (the unit pad's cells in their place), one press each
    const ids = await page.locator("[data-key]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-key") ?? ""))]);
    expect(ids.length).toBeGreaterThan(40);
    for (const id of ids.filter((k) => k !== "esc")) {
      await s.fire(`key:${id}`, () => tap(page, [id]), { sheet: true });
      if (id === "shift" || id === "alpha") await page.evaluate(() => window.n62.session.clearModifiers());
    }
    await s.leave("key:esc", taken, () => tap(page, ["esc"]));

    // the screen and the bar
    await tap(page, ["shift", "tmpl"]);
    await viewUp(page);
    await s.fire("tap:angle", () => page.getByTestId("chip-angle").tap());
    await s.fire("tap:angle2", () => page.getByTestId("chip-angle").tap());
    await s.fire("tap:format", () => page.getByTestId("chip-format").tap(), { sheet: true });
    await s.fire("tap:menu", () => page.getByTestId("menu-button").tap(), { sheet: true });
    await s.fire("tap:fold", () => page.getByTestId("fold-chevron").tap());
    await s.fire("tap:unfold", () => page.getByTestId("fold-slice").tap());
    await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");
    await focusChannels(s, page);
    // the tabs and APP▾ change place: the view leaves first, Home's line is kept with its slots
    for (const [id, sel] of [["tab:home", "tab-home"], ["tab:slot", "tab-slot"], ["place", "place"]] as const) {
      await tap(page, ["shift", "tmpl"]);
      await viewUp(page);
      await s.fire(id, () => page.getByTestId(sel).tap(), { leaves: true, sheet: true });
      if ((await snap(page)).place !== "home") await page.getByTestId("tab-home").tap();
      const home = await settle(page);
      if (home.line !== taken || home.view) s.bad.set(`typed ${id}`, `${s.bad.get(`typed ${id}`) ?? ""} Home's line ${taken} → ${home.line}`);
    }

    // Android back is Esc for the view
    await tap(page, ["shift", "tmpl"]);
    await viewUp(page);
    await s.leave("back", taken, () => page.goBack());

    // last, as they edit the lent line today: a history row, then each button of the row bar it brings (Store ▶ last)
    await tap(page, ["shift", "tmpl"]);
    await viewUp(page);
    await s.fire("tap:row", () => row(page, 0).tap());
    const items = await page.getByTestId("row-actions").locator("button").evaluateAll((els) => els.map((e) => e.getAttribute("data-item") ?? ""));
    for (const item of items.filter((i) => i !== "store").concat(items.includes("store") ? ["store"] : [])) {
      if (!(await snap(page)).pick) await row(page, 0).tap();
      await s.fire(`rowbar:${item}`, () => page.getByTestId("row-actions").locator(`[data-item="${item}"]`).tap());
    }
    // (a leak above left its edit on the line: it is set back, so the next case starts from the line as typed)
    await tap(page, ["esc"]);
    await settle(page);
    await page.evaluate((l) => window.n62.entry.set(l), taken);
    await tap(page, ["shift", "tmpl"]);
    await viewUp(page);
    await s.fire("tap:row2", async () => {
      await row(page, 0).tap();
      await row(page, 0).tap();
    });
    s.check();
  });

  test("on a picked row: the view's result follows the angle word; taps, paste, hardware keys; a pick does not outlive it", async ({ page }) => {
    test.setTimeout(45_000);
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
    await s.fire("key:enter", () => tap(page, ["enter"]));
    const unitRow = page.locator("article.item").last().locator(".result");
    await expect(unitRow).toContainText("0.988");
    // F368 (R915): the bar's angle word asks again: sin(30°) = 0.5 (derived), the row too
    await s.fire("tap:angle", () => page.getByTestId("chip-angle").tap());
    await expect(unitRow).toContainText("0.5");
    await s.fire("tap:angle2", () => page.getByTestId("chip-angle").tap());
    await expect(unitRow).toContainText("0.988");
    await focusChannels(s, page);
    await s.fire("tap:row", () => row(page, 0).tap());
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
