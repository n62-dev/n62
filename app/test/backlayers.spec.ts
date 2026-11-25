// SPDX-License-Identifier: GPL-3.0-or-later
// R700 (F381): Android back (the WebView's goBack(), here `page.goBack()`) closes what is open before it leaves the app:
// a picked history row, the unit view, an armed or locked Shift or Alpha, each as Esc would, in the order they opened
// (app/src/input/backLayer.ts). With nothing open back leaves. The fake engine, 412 × 839.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, sheet, tap, touch } from "./helpers.ts";

test.use({ viewport: { width: 412, height: 839 } });

const picked = (p: Page) => p.locator('[data-selected="true"]');
const bar = (p: Page) => p.getByTestId("row-actions");
const layer = (p: Page) => p.evaluate(() => (history.state as { n62Layer?: number } | null)?.n62Layer);
const inLine = (p: Page): Promise<boolean> => p.evaluate(() => document.activeElement?.tagName === "MATH-FIELD");
const gone = (p: Page) => expect.poll(() => p.url()).toBe("about:blank"); // back left the app
const stays = (p: Page) => expect(p.url()).toContain("engine=fake");
const mods = (p: Page) => p.evaluate(() => ({ s: window.n62.session.shift, a: window.n62.session.alpha, sl: window.n62.session.shiftLock, al: window.n62.session.alphaLock }));
/** What the outline says (App.svelte data-ring: "shift" armed, "alpha", "error", else none) and the colour it is drawn in (--ring-c on the field: --shift armed, --ring at rest). */
const ring = (p: Page) =>
  p.evaluate(() => {
    const e = document.querySelector<HTMLElement>('[data-testid="entry"]') as HTMLElement;
    const f = e.querySelector("math-field") as HTMLElement;
    return { state: e.dataset["ring"] ?? "", colour: getComputedStyle(f).getPropertyValue("--ring-c").trim(), w: getComputedStyle(f).getPropertyValue("--ring-w").trim() };
  });
const fold = async (p: Page): Promise<void> => {
  const f = await touch(p, '[data-testid="entry"]'); // R283: a swipe down on the line
  await f.move(0, 40, 4);
  await f.end();
  await expect(p.getByTestId("keys")).toHaveAttribute("data-folded", "true");
};

test.beforeEach(async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-fold-ready", "true");
});

test("(a) a picked row: back drops the pick, the line is empty and focused; a second back leaves", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["up"]);
  await expect(picked(page)).toHaveCount(1);
  await expect(bar(page)).toBeVisible();
  await page.goBack();
  await expect(picked(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
  await expect.poll(() => inLine(page)).toBe(true);
  stays(page);
  expect(await layer(page)).toBeUndefined();
  await page.goBack();
  await gone(page);
});

test("(b) the unit view: back closes it as Esc does, and the line is as it was", async ({ page }) => {
  await tap(page, ["d7"]);
  await tap(page, ["shift", "tmpl"]);
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element);
  await tap(page, ["d5"]);
  await page.goBack();
  await page.waitForFunction(() => window.n62.unitView === undefined);
  stays(page);
  expect(await entryValue(page)).toBe("7");
  expect(await layer(page)).toBeUndefined();
  await page.goBack();
  await gone(page);
});

test("(c) Shift armed: back disarms it and the outline goes back to --ring", async ({ page }) => {
  const before = await ring(page);
  expect(before.state).not.toBe("shift");
  await tap(page, ["shift"]);
  expect((await mods(page)).s).toBe(true);
  await expect.poll(async () => (await ring(page)).state).toBe("shift");
  const armed = await ring(page);
  expect(armed.colour).not.toBe(before.colour); // --shift, not --ring
  await page.goBack();
  await expect.poll(async () => (await mods(page)).s).toBe(false);
  await expect.poll(async () => (await ring(page)).state).not.toBe("shift");
  expect(await ring(page)).toEqual(before); // --ring again, at its resting width
  stays(page);
  await page.goBack();
  await gone(page);
});

test("(d) Alpha lock: back unlocks", async ({ page }) => {
  await tap(page, ["alpha", "alpha"]);
  expect((await mods(page)).al).toBe(true);
  await page.goBack();
  await expect.poll(async () => await mods(page)).toEqual({ s: false, a: false, sl: false, al: false });
  stays(page);
  await flick(page, "shift", "up"); // a Shift lock too
  expect((await mods(page)).sl).toBe(true);
  await page.goBack();
  await expect.poll(async () => (await mods(page)).sl).toBe(false);
  stays(page);
});

test("(e) stacked: the keypad folded, then Shift armed: Shift, then the fold, then leave; Copy › ends the pick, so no pick lies under it", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["up"]);
  await bar(page).getByRole("button", { name: /Copy ›/ }).tap();
  await expect(sheet(page)).toBeVisible();
  await expect(picked(page)).toHaveCount(0); // (the bar's button ends the pick before the sheet opens)
  await page.goBack();
  await expect(sheet(page)).toBeHidden();
  stays(page);
  await fold(page);
  await page.evaluate(() => window.n62.session.toggleShift()); // (the keys are down: Shift is armed from the hardware's side)
  expect((await mods(page)).s).toBe(true);
  await page.goBack();
  await expect.poll(async () => (await mods(page)).s).toBe(false);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
  await page.goBack();
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");
  stays(page);
  await page.goBack();
  await gone(page);
});

test("(f) folded with a picked row: the pick, then the fold, then leave", async ({ page }) => {
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await fold(page);
  await page.locator('[data-testid="result"] .result').last().tap();
  await expect(picked(page)).toHaveCount(1);
  await page.goBack();
  await expect(picked(page)).toHaveCount(0);
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
  await page.goBack();
  await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "false");
  stays(page);
  await page.goBack();
  await gone(page);
});

test("control: back with nothing open leaves; a typed line does not stop it", async ({ page }) => {
  await tap(page, ["d4"]);
  await page.goBack();
  await gone(page);
});

// R919 (F375): a name prompt (askName, views/presetsView.svelte.ts) is a layer of its own, on top of the Alpha lock it
// starts (R776): one back ends both, as Esc would; the line is what it was, Alpha is off, the app stays, and no entry is
// left for a second back to use up.
const label = (p: Page) => p.getByTestId("entry-label");
const menuRow = (p: Page, id: string) => sheet(p).locator(`[role="menuitem"][data-id="${id}"]`);
async function backEnds(p: Page, name: string, after?: () => Promise<void>): Promise<void> {
  await expect(label(p)).toHaveText(name);
  await expect.poll(async () => (await mods(p)).al).toBe(true);
  await tap(p, ["d2"]); // z (Alpha is locked in lower case)
  expect(await entryValue(p)).toContain("z");
  await p.goBack();
  await expect(label(p)).toHaveCount(0);
  expect(await entryValue(p)).toBe("7+1");
  await expect.poll(async () => await mods(p)).toEqual({ s: false, a: false, sl: false, al: false });
  stays(p);
  await expect.poll(() => layer(p)).toBeUndefined();
  if (after) await after(); // checks of its own; it leaves nothing open
  await p.goBack();
  await gone(p);
}

test("(g) Mode › Presets › Save: back ends the name prompt and its Alpha lock at once; a second back leaves", async ({ page }) => {
  await tap(page, ["d7", "add", "d1"]);
  await tap(page, ["@mode", "d1", "d1"]);
  await backEnds(page, "Preset name");
});

test("(h) a preset's Rename: back ends the prompt as Esc would; the name is kept", async ({ page }) => {
  await tap(page, ["@mode", "d1", "d1"]); // Save, as Lab
  await expect(label(page)).toHaveText("Preset name");
  await page.keyboard.type("Lab");
  await page.keyboard.press("Enter");
  await expect(label(page)).toHaveCount(0);
  await tap(page, ["d7", "add", "d1"]);
  await tap(page, ["@mode", "d1", "d3", "d1", "d7", "d1"]); // Edit › Lab › Rename or delete › Rename
  await backEnds(page, "Preset name", async () => {
    await tap(page, ["@mode", "d1", "d3"]); // Edit: the preset is still Lab (not Labz, not gone)
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Presets › Edit");
    await expect(sheet(page).getByRole("menuitem").locator(".label")).toHaveText(["Lab"]);
    await tap(page, ["esc", "esc", "esc"]);
    await expect(sheet(page)).toHaveCount(0);
    await expect.poll(() => layer(page)).toBeUndefined();
  });
});

test("(i) Settings › Sync › Device name: back ends the prompt", async ({ page }) => {
  await page.addInitScript(() => {
    const cap = {}; // (as nameprompt.spec.ts: the Sync rows are the Android ones)
    Object.defineProperty(cap, "isNativePlatform", { get: () => () => true, set: () => {} });
    (window as unknown as { Capacitor: unknown }).Capacitor = cap;
  });
  await open(page);
  await tap(page, ["d7", "add", "d1"]);
  await tap(page, ["help", "d6"]);
  await menuRow(page, "sync").tap();
  await menuRow(page, "device").tap();
  await backEnds(page, "Device name");
});

test("(j) a field of the unit form (no Alpha lock): back ends it, the line is as it was", async ({ page }) => {
  await tap(page, ["d7", "add", "d1"]);
  await tap(page, ["help", "d5"]);
  await menuRow(page, "units").tap();
  await menuRow(page, "new").tap();
  await menuRow(page, "name").tap();
  await expect(label(page)).toHaveText("Unit name");
  expect((await mods(page)).al).toBe(false);
  await page.keyboard.type("q");
  await page.goBack();
  await expect(label(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("7+1");
  stays(page);
  await expect.poll(() => layer(page)).toBeUndefined();
});

test("control (R919): Esc in a name prompt ends it and Alpha; back then leaves", async ({ page }) => {
  await tap(page, ["d7", "add", "d1"]);
  await tap(page, ["@mode", "d1", "d1"]);
  await expect(label(page)).toHaveText("Preset name");
  await tap(page, ["d2", "esc"]);
  await expect(label(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("7+1");
  await expect.poll(async () => await mods(page)).toEqual({ s: false, a: false, sl: false, al: false });
  await expect.poll(() => layer(page)).toBeUndefined();
  await page.goBack();
  await gone(page);
});

// R926 (F378): an app (shell.app) is a back layer, one per app session (apps/shellOpen.ts opens it, shell.close releases it):
// back closes it to where it was opened from, Home or CAS, with Home's set-aside line back (R270); what lies over it (☰,
// Shift) closes first. An app-to-app switch keeps the one layer; the Home or CAS tab inside an app takes its entry back.
const place = (p: Page) => p.evaluate(() => ({ app: window.n62.shell.app, view: window.n62.session.view }));
async function inApp(p: Page, app: "function" | "solve", view: "symb" | "plot" | "num"): Promise<void> {
  if (app === "function") await tap(p, [`@${view}`]);
  else {
    await tap(p, ["@place", "d4"]);
    await tap(p, [`@${view}`]);
  }
  await p.waitForFunction((a) => window.n62.shell.app === a && window.n62.shell.loading === null, app);
  await expect(p.getByTestId("place")).toHaveAttribute("data-view", view);
}
async function closesTo(p: Page, view: "home" | "cas", line: string): Promise<void> {
  await expect.poll(() => place(p)).toEqual({ app: null, view });
  stays(p);
  await expect(p.getByTestId("place")).toHaveAttribute("data-view", view);
  expect(await entryValue(p)).toBe(line);
  await expect.poll(() => layer(p)).toBeUndefined();
}

for (const [app, view] of [["function", "symb"], ["function", "plot"], ["function", "num"], ["solve", "symb"], ["solve", "num"]] as const)
  test(`(k) ${app} ${view}: one back closes the app to Home, with Home's line back; a second back leaves`, async ({ page }) => {
    await tap(page, ["d7"]); // Home's unentered line (R270)
    await inApp(page, app, view);
    await page.goBack();
    await closesTo(page, "home", "7");
    await page.goBack();
    await gone(page);
  });

test("(l) opened from CAS: back closes the app to CAS", async ({ page }) => {
  await tap(page, ["@cas"]);
  await expect.poll(() => place(page)).toEqual({ app: null, view: "cas" });
  await inApp(page, "function", "num");
  await page.goBack();
  await closesTo(page, "cas", "");
  await page.goBack();
  await gone(page);
});

test("(m) Plot with ☰ open: back closes ☰, a second back the app, a third leaves", async ({ page }) => {
  await inApp(page, "function", "plot");
  await tap(page, ["@menu"]);
  await expect(sheet(page)).toBeVisible();
  await page.goBack();
  await expect(sheet(page)).toHaveCount(0);
  stays(page);
  expect((await place(page)).app).toBe("function");
  await page.goBack();
  await closesTo(page, "home", "");
  await page.goBack();
  await gone(page);
});

test("(n) Plot with Shift armed: back disarms Shift, a second back closes the app", async ({ page }) => {
  await inApp(page, "function", "plot");
  await tap(page, ["shift"]);
  expect((await mods(page)).s).toBe(true);
  await page.goBack();
  await expect.poll(async () => (await mods(page)).s).toBe(false);
  stays(page);
  expect((await place(page)).app).toBe("function");
  await page.goBack();
  await closesTo(page, "home", "");
  await page.goBack();
  await gone(page);
});

test("(o) Function, then Apps › Solve: one back lands in Home", async ({ page }) => {
  await inApp(page, "function", "symb");
  await tap(page, ["@place", "d4"]);
  await page.waitForFunction(() => window.n62.shell.app === "solve" && window.n62.shell.loading === null);
  await page.goBack();
  await closesTo(page, "home", "");
  await page.goBack();
  await gone(page);
});

test("control (R926): the Home or CAS tab inside an app leaves no history entry behind", async ({ page }) => {
  await inApp(page, "function", "symb");
  await tap(page, ["@home"]);
  await expect.poll(() => place(page)).toEqual({ app: null, view: "home" });
  await expect.poll(() => page.evaluate(() => history.state)).toBeNull();
  await inApp(page, "solve", "num");
  await tap(page, ["@cas"]);
  await expect.poll(() => place(page)).toEqual({ app: null, view: "cas" });
  await expect.poll(() => page.evaluate(() => history.state)).toBeNull();
  await page.goBack();
  await gone(page);
});
