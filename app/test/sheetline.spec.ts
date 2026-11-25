// SPDX-License-Identifier: GPL-3.0-or-later
// R891 (owner, 2026-11-23, bug list 4 point 6; docs/05 3.1): every sheet opens in the viewport with its bottom on the bar
// (⌄ ⊞ Home|CAS STD ☰, or the folded bar), over the history and the entry line while it is open; a sheet shorter than the
// viewport keeps its height (its top below the history's top) and a tap on the history above it closes it. Only a matrix
// grid level keeps the line, whose cells are typed there (R189): the matrix list sits on the bar, its grid level above the
// line. At 360 × 740, the Fairphone's 372 × 767 and 412 × 915, keys open and folded. Expected values derived from the rule.
import { expect, test, type Page } from "@playwright/test";
import { flick, historyPoint, open, sheetKey, tap, touch } from "./helpers.ts";

const SIZES = [[360, 740], [372, 767], [412, 915]] as const;
/** How far the sheet's bottom may lie from the bar's top: the sheet's own margin (4 px). */
const ON_BAR = 4;

type Opener = (page: Page) => Promise<void>;
/** Each sheet as a user opens it; `folded` openers use the hardware path (the keypad is inert when folded). */
const SHEETS: Record<string, Opener> = {
  Apps: (page) => page.keyboard.press("Alt+A"),
  "☰": (page) => page.keyboard.press("Alt+M"),
  Tmpl: (page) => sheetKey(page, ["tmpl"]),
  Vars: (page) => sheetKey(page, ["vars"]),
  Chars: (page) => sheetKey(page, ["shift", "vars"]),
  Store: (page) => sheetKey(page, ["d7", "shift", "emark"]),
  Find: (page) => sheetKey(page, ["math"]),
  Mode: (page) => page.keyboard.press("Alt+Shift+O"),
  Settings: (page) => sheetKey(page, ["help"]),
  "Settings › Numbers": async (page) => {
    await sheetKey(page, ["help"]);
    await expect(page.getByTestId("sheet-title")).toContainText("Settings");
    await sheetKey(page, ["d3"]);
    await expect(page.getByTestId("sheet-title")).toContainText("Numbers");
  },
  credits: async (page) => {
    await sheetKey(page, ["alpha", "paren", "d6", "d2", "enter"]);
    await expect(page.getByTestId("credits")).toBeVisible();
  },
};

/** The open sheet's box, the bar's (the status line, or the folded bar), the history's and the overlay's. */
async function boxes(page: Page) {
  const panel = page.locator('[role="menu"]').first();
  await expect(panel).toBeVisible();
  const bar = page.locator('[data-testid="bar"]:visible, [data-testid="folded-bar"]:visible').first();
  const [s, b, o] = await Promise.all([panel.boundingBox(), bar.boundingBox(), page.locator(".overlay").first().boundingBox()]);
  if (!s || !b || !o) throw new Error("no box");
  const h = (await page.locator("section.history").count()) ? await page.locator("section.history").first().boundingBox() : null;
  /** The sheet's content fits without a scroll: a sheet shorter than the viewport. */
  const fits = await panel.evaluate((el) => [el, ...el.querySelectorAll<HTMLElement>(".list, .grid, .credits")].every((e) => e.scrollHeight <= e.clientHeight + 1));
  return { sheetTop: s.y, sheetBottom: s.y + s.height, barTop: b.y, historyTop: h?.y ?? o.y, overlayTop: o.y, fits };
}

/** Its bottom on the bar; a short sheet keeps its height and a tap on the history above it closes it. */
async function onBar(page: Page, name: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" }); // no rise animation: the boxes are final at once
  const b = await boxes(page);
  expect(Math.abs(b.sheetBottom - b.barTop), `${name}: |sheet bottom ${b.sheetBottom} − bar top ${b.barTop}|`).toBeLessThanOrEqual(ON_BAR);
  if (!b.fits) return; // a sheet taller than the viewport fills it and scrolls (sheetfull.spec.ts, fit.spec.ts)
  if (b.sheetTop <= b.overlayTop + ON_BAR) return; // as tall as its room, to the pixel (R927: Mode at 372 × 767, 244 px of rows in 243)
  expect(b.sheetTop, `${name}: a short sheet keeps its height`).toBeGreaterThan(b.historyTop + ON_BAR);
  const p = await historyPoint(page);
  if (!p) return; // Plot and the unit view have no history section; nothing above to tap
  await page.mouse.click(p.x, p.y);
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
}

for (const [width, height] of SIZES)
  for (const folded of [false, true])
    test.describe(`R891 at ${width} × ${height}, keys ${folded ? "folded" : "open"}`, () => {
      test.use({ viewport: { width, height } });
      test.beforeEach(async ({ page }) => {
        await open(page);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await tap(page, ["d1", "add", "d1", "enter"]); // a history row to tap
        await expect(page.locator("[data-status]")).toHaveCount(1);
        if (folded) {
          const f = await touch(page, '[data-testid="entry"]');
          await f.move(0, 40, 4);
          await f.end();
          await expect(page.getByTestId("keys")).toHaveAttribute("data-folded", "true");
        }
      });
      for (const [name, openSheet] of Object.entries(SHEETS))
        test(`${name} sits on the bar, over the entry line`, async ({ page }) => {
          await openSheet(page);
          await onBar(page, name);
        });
      test("the unit view's ☰ sits on the bar", async ({ page }) => {
        if (folded) await sheetKey(page, ["shift", "tmpl"]);
        else await flick(page, "tmpl", "up");
        await page.waitForFunction(() => window.n62.unitView !== undefined);
        await page.keyboard.press("Alt+M");
        await expect(page.getByTestId("sheet-title")).toHaveText("Units");
        await onBar(page, "unit ☰");
      });
    });

/** M:=[[1,2],[3,4]] stored (the fake engine keeps a name as the line typed it, R189 needs the real one for its cells). */
test.describe("R891: the matrix list sits on the bar, its grid level keeps the line", () => {
  for (const [width, height] of SIZES)
    test(`${width} × ${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, "");
      await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
      await page.evaluate(() => window.n62.session.submit("M:=[[1,2],[3,4]]", "M:=[[1,2],[3,4]]"));
      await page.waitForFunction(() => window.n62.session.userNames.some((u) => u.name === "M"), undefined, { timeout: 20_000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await tap(page, ["shift", "d4"]); // the matrix list
      await expect(page.getByTestId("matrix-grid")).toHaveCount(0);
      const list = await boxes(page);
      expect(Math.abs(list.sheetBottom - list.barTop)).toBeLessThanOrEqual(ON_BAR);
      await sheetKey(page, ["d0"]); // M's grid
      await expect(page.getByTestId("matrix-grid").locator("td[data-cell]")).toHaveCount(4);
      const grid = await boxes(page);
      const line = await page.getByTestId("entry").boundingBox();
      if (!line) throw new Error("no line");
      expect(grid.sheetBottom).toBeLessThanOrEqual(line.y + 1); // the line stays in sight under the grid
    });
});

// Your units' fields are typed on the line: a field's tap closes the form first (views/ownUnitsSheet.svelte.ts, askName), so
// the line is in sight while it is typed, and Enter brings the form back on the bar.
test("R891: a Your units field closes the form, the line takes its value in sight, Enter brings the form back on the bar", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await tap(page, ["help", "d5"]);
  await page.getByTestId("menu").locator('[role="menuitem"][data-id="units"]').tap();
  await page.getByTestId("menu").locator('[role="menuitem"][data-id="new"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("New unit");
  await onBarOnly(page);
  await page.getByTestId("menu").locator('[role="menuitem"][data-id="name"]').tap();
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
  await expect(page.getByTestId("entry-label")).toHaveText("Unit name");
  const reach = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="entry"]')!.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return r.height > 0 && el !== null && el.closest('[data-testid="entry"]') !== null;
  });
  expect(reach).toBe(true);
  await page.keyboard.type("myrod");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("sheet-title")).toHaveText("New unit");
  await expect(page.getByTestId("menu").locator('[data-id="name"]').getByTestId("sheet-value")).toHaveText("myrod");
  await onBarOnly(page);
});

async function onBarOnly(page: Page): Promise<void> {
  const b = await boxes(page);
  expect(Math.abs(b.sheetBottom - b.barTop)).toBeLessThanOrEqual(ON_BAR);
}
