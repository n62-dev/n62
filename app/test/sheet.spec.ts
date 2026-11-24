// SPDX-License-Identifier: GPL-3.0-or-later
// One sheet for every list (R7, docs/05 3.1 with section 7): one test per key of the 3.1 table, plus last pick, the
// scroll cue, disabled rows with their reason, touch, and no key going through the sheet.
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, open, sheet, sheetKey, tap, tapHistory, closeSheet } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

type Spec = { label: string; sub?: { title: string; items: string[] } };

/** Open a test list on the sheet (as a long press on a history row does); picking item `label` records it in `ran`. */
async function list(page: Page, title: string, items: (string | Spec)[]): Promise<void> {
  await page.evaluate(
    ([title, items]) => {
      const w = window as unknown as { ran: string[] };
      w.ran = [];
      const leaf = (label: string) => ({ id: label, label, run: () => void w.ran.push(label) });
      window.n62.shell.showMenu(
        title,
        items.map((x) =>
          typeof x === "string" ? leaf(x) : { id: x.label, label: x.label, submenu: x.sub ? { title: x.sub.title, items: x.sub.items.map(leaf) } : undefined },
        ),
      );
    },
    [title, items] as const,
  );
  await expect(sheet(page)).toBeVisible();
}
const ran = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { ran: string[] }).ran);
const active = (page: Page) => sheet(page).locator('[role="menuitem"][data-active="true"]');
const title = (page: Page) => page.getByTestId("sheet-title");
const FIVE = ["one", "two", "three", "four", "five"];
const TWELVE = Array.from({ length: 12 }, (_, i) => `item ${i + 1}`);

test("▲ ▼ move the highlight round the ends; Enter picks the highlighted row and closes the sheet", async ({ page }) => {
  await list(page, "Test", FIVE);
  await expect(active(page)).toHaveAttribute("data-id", "one");
  await sheetKey(page, ["down", "down"]); // (R144: the hardware arrows; an on-screen tap closes the sheet)
  await expect(active(page)).toHaveAttribute("data-id", "three");
  await sheetKey(page, ["up", "up", "up"]);
  await expect(active(page)).toHaveAttribute("data-id", "five");
  await tap(page, ["enter"]);
  expect(await ran(page)).toEqual(["five"]);
  await expect(sheet(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
});

test("the arrow trackpad moves the highlight and picks nothing (R770: the keys stay live below the sheet)", async ({ page }) => {
  await list(page, "Test", FIVE);
  await drag(page, "down", 0, 30); // two 12 px steps: ▼ ▼
  await expect(sheet(page)).toBeVisible();
  await expect(active(page)).toHaveAttribute("data-id", "three");
  expect(await ran(page)).toEqual([]);
});

test("digits pick rows 1…9 and 0 the tenth, with Shift or Alpha on (ignored, and left as they are)", async ({ page }) => {
  await list(page, "Test", TWELVE);
  await tap(page, ["shift", "d0"]);
  expect(await ran(page)).toEqual(["item 10"]);
  await expect(page.locator('[data-key="shift"]')).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.n62.session.clearModifiers());
  await list(page, "Test", TWELVE);
  await tap(page, ["alpha", "d3"]);
  expect(await ran(page)).toEqual(["item 3"]);
  expect(await entryValue(page)).toBe("");
});

test("▶ opens a submenu (path in the title), ◀ and Esc go back a level, Esc at the top closes", async ({ page }) => {
  await list(page, "Test", ["plain", { label: "more", sub: { title: "More", items: ["x", "y"] } }]);
  await sheetKey(page, ["right"]); // "plain" has no submenu: nothing happens
  await expect(title(page)).toHaveText("Test");
  await expect(sheet(page).getByRole("menuitem", { name: "2 more" })).toContainText("›");
  await sheetKey(page, ["down", "right"]);
  await expect(title(page)).toHaveText("Test › More");
  await expect(sheet(page).getByRole("menu")).toHaveAttribute("aria-label", "More");
  await sheetKey(page, ["left"]);
  await expect(title(page)).toHaveText("Test");
  await expect(active(page)).toHaveAttribute("data-id", "more");
  await sheetKey(page, ["enter"]); // Enter opens a submenu too
  await expect(title(page)).toHaveText("Test › More");
  await tap(page, ["esc"]);
  await expect(title(page)).toHaveText("Test");
  await tap(page, ["esc"]);
  await expect(sheet(page)).toHaveCount(0);
  expect(await ran(page)).toEqual([]);
  expect(await entryValue(page)).toBe("");
});

const UNITS = ["hour", "hertz", "henry", "gauss", "coulomb", "candela", "kelvin", "kilogram", "joule", "lux", "lumen", "newton", "ohm", "pascal"];

test("letters filter a long list: a tap on a non-digit key types its letter; ⌫ takes it back; digits pick among the matches", async ({ page }) => {
  await list(page, "Units", UNITS);
  await tap(page, ["cos"]); // H
  await expect(page.getByTestId("sheet-filter")).toHaveText("H");
  await expect(sheet(page).getByRole("menuitem")).toHaveText(["1hour", "2hertz", "3henry"]);
  await tap(page, ["frac"]); // E
  await expect(sheet(page).getByRole("menuitem")).toHaveText(["1hertz", "2henry"]);
  await tap(page, ["bksp"]);
  await expect(sheet(page).getByRole("menuitem")).toHaveCount(3);
  await tap(page, ["frac", "d2"]);
  expect(await ran(page)).toEqual(["henry"]);
  expect(await entryValue(page)).toBe("");
});

test("a filter with no match says so; Enter does nothing", async ({ page }) => {
  await list(page, "Units", UNITS);
  await tap(page, ["vars", "vars"]); // AA
  await expect(page.getByTestId("sheet-empty")).toBeVisible();
  await tap(page, ["enter"]);
  await expect(sheet(page)).toBeVisible();
  expect(await ran(page)).toEqual([]);
});

test("in a short list a letter key does nothing and looks dead; nothing reaches the entry line", async ({ page }) => {
  await list(page, "Test", FIVE);
  await expect(page.locator('[data-key="sin"]')).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="d1"]')).not.toHaveAttribute("data-dead", "true");
  await sheetKey(page, ["sin", "d7", "add", "x", "dot"]); // d7: no seventh row (the key path; an on-screen tap closes the sheet, R144)
  await expect(sheet(page)).toBeVisible();
  expect(await entryValue(page)).toBe("");
  expect(await ran(page)).toEqual([]);
  await tap(page, ["esc"]);
  await expect(page.locator('[data-key="sin"]')).not.toHaveAttribute("data-dead", "true");
});

test("Menu opens and closes the view's menu; Apps switches to the Apps sheet and back", async ({ page }) => {
  await tap(page, ["@menu"]);
  await expect(sheet(page)).toBeVisible();
  await tap(page, ["@menu"]);
  await expect(sheet(page)).toHaveCount(0);
  await tap(page, ["@menu", "@place"]);
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("apps")).toBeVisible();
  await tap(page, ["@menu"]);
  await expect(sheet(page)).toBeVisible();
  await tap(page, ["@place", "@place"]);
  await expect(page.getByTestId("apps")).toHaveCount(0);
});

test("a key that changes place closes the sheet and goes there (CAS)", async ({ page }) => {
  await tap(page, ["@menu", "@cas"]);
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "cas");
});

test("the last pick is remembered per sheet: Apps + Enter opens the app picked last", async ({ page }) => {
  await tap(page, ["@place", "d4"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  // back to Home without the Apps sheet (a user key that holds Home), so its last pick stays Solve
  await page.evaluate(() => window.n62.userKeys.set("u2", "primary", { label: "Home", action: { special: "home" } }));
  await tap(page, ["u2", "@place"]);
  await expect(page.getByTestId("apps").locator('[data-active="true"]')).toHaveAttribute("data-id", "solve");
  await sheetKey(page, ["enter"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
});

test("a list that does not fit shows its item count and a fade at the cut edge, and keeps the highlight in view", async ({ page }) => {
  await list(page, "Units", UNITS);
  await expect(page.getByTestId("sheet-count")).toHaveText("14 items");
  const box = sheet(page).locator(".list");
  await expect(box).toHaveClass(/cut-bottom/);
  await expect(box).not.toHaveClass(/cut-top/);
  await sheetKey(page, ["up"]); // round to the last row
  await expect(active(page)).toHaveAttribute("data-id", "pascal");
  await expect(box).toHaveClass(/cut-top/);
  const [b, r] = await Promise.all([box.boundingBox(), active(page).boundingBox()]);
  expect(r && b && r.y >= b.y - 1 && r.y + r.height <= b.y + b.height + 1).toBe(true);
});

test("a short list that fits shows no count", async ({ page }) => {
  await list(page, "Test", ["one", "two"]);
  await expect(page.getByTestId("sheet-count")).toHaveCount(0);
});

test("disabled rows stay in place with their number and say why; picking one does nothing", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["@plot", "@menu"]); // no function defined
  const rows = sheet(page).getByRole("menuitem");
  await expect(rows).toHaveCount(10); // R145: Settings is the ⚙ in the title row, not a row; R785: To Home is off, Mode is the tenth row
  await expect(rows.first()).toBeDisabled();
  // neighbouring rows share their reason, said once under the last of them (R21a, R7 open point 5): the five from Root to
  // Signed area "Define a function first"; Copy, As shown and To Home (R785: always the ninth row) "No result yet"
  await expect(sheet(page).locator(".reason")).toHaveText(["Define a function first", "No result yet"]);
  await expect(rows.nth(4).locator(".reason")).toHaveText("Define a function first");
  await expect(rows.nth(8).locator(".reason")).toHaveText("No result yet");
  await expect(rows.nth(6).locator(".reason")).toHaveCount(0);
  await expect(rows.nth(7).locator(".reason")).toHaveCount(0);
  await expect(sheet(page).getByRole("menuitem", { name: "6 Default window" })).toBeEnabled();
  await expect(active(page)).toHaveAttribute("data-id", "default"); // the highlight starts on the first live row
  await tap(page, ["d1"]);
  await expect(sheet(page)).toBeVisible();
});

test("touch: a tap on a row picks it, ‹ goes back, a tap beside the sheet closes it", async ({ page }) => {
  await list(page, "Test", ["plain", { label: "more", sub: { title: "More", items: ["x", "y"] } }]);
  await sheet(page).getByRole("menuitem", { name: "2 more" }).click();
  await expect(title(page)).toHaveText("Test › More");
  await sheet(page).getByRole("button", { name: "Back" }).click();
  await expect(title(page)).toHaveText("Test");
  await sheet(page).getByRole("menuitem", { name: "2 more" }).click();
  await sheet(page).getByRole("menuitem", { name: "2 y" }).click();
  expect(await ran(page)).toEqual(["y"]);
  await expect(sheet(page)).toHaveCount(0);
  await page.setViewportSize({ width: 412, height: 915 }); // room for history above a 5-row list
  await list(page, "Test", FIVE);
  await tapHistory(page); // a point of the history, computed outside the sheet's box
  await expect(sheet(page)).toHaveCount(0);
  await list(page, "Units", UNITS); // a list that takes letters, over the view: the dimmed area above it
  await closeSheet(page); // a history tap where the list leaves room, else its × (docs/05 3.1)
  await expect(sheet(page)).toHaveCount(0);
  expect(await ran(page)).toEqual([]);
});

test("every list sits on the bar, over the entry line, and never over the keypad (R770, R891)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // no rise animation: the boxes are final at once
  const boxes = async () => {
    const [s, e, b, k, h] = await Promise.all([
      sheet(page).getByRole("menu").boundingBox(),
      page.locator(".entry").boundingBox(),
      page.getByTestId("bar").boundingBox(),
      page.locator(".pad").boundingBox(),
      page.locator("section.history").first().boundingBox(),
    ]);
    if (!s || !e || !b || !k || !h) throw new Error("no box");
    return { top: s.y, bottom: s.y + s.height, entryBottom: e.y + e.height, barTop: b.y, keypadTop: k.y, historyTop: h.y };
  };
  await list(page, "Test", ["one", "two"]);
  let b = await boxes();
  expect(Math.abs(b.bottom - b.barTop)).toBeLessThanOrEqual(4); // a short list: its bottom on the bar (its own 4 px margin)
  expect(b.bottom).toBeGreaterThan(b.entryBottom - 1); // over the whole entry line
  expect(b.bottom).toBeLessThanOrEqual(b.keypadTop + 1); // never over the keypad
  expect(b.top).toBeGreaterThan(b.historyTop + 4); // and keeps its height: its top below the history's top
  await tap(page, ["esc"]);
  await list(page, "Units", UNITS);
  b = await boxes();
  expect(Math.abs(b.bottom - b.barTop)).toBeLessThanOrEqual(4); // a long list the same
  expect(b.bottom).toBeLessThanOrEqual(b.keypadTop + 1);
});
