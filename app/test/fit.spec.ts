// SPDX-License-Identifier: GPL-3.0-or-later
// R770 (decisions.md "R21", docs/05 3.1): every sheet is in the viewport, the keys never move under it, and a sheet taller than the
// viewport scrolls inside its box with its last row reachable. Where each sheet sits is sheetsview.spec.ts. The fake engine,
// except for the Tmpl flow.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheetKey, tap } from "./helpers.ts";

// Not helpers.sheet: this one is every element with role menu, not the `menu` test id.
const sheet = (page: Page) => page.locator('[role="menu"]');

type Box = { x: number; y: number; width: number; height: number };
async function boxOf(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} is not visible`);
  return b;
}
/** The box of every key, by id. */
const keyBoxes = (page: Page): Promise<Record<string, [number, number, number, number]>> =>
  page.evaluate(() => {
    const out: Record<string, [number, number, number, number]> = {};
    for (const el of document.querySelectorAll<HTMLElement>("[data-key]")) {
      const r = el.getBoundingClientRect();
      out[el.dataset["key"] ?? ""] = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10) as [number, number, number, number];
    }
    return out;
  });

/** Every pick sheet and the keys that open it from a fresh Home (each ends with the sheet open). */
const OPENERS: Record<string, (page: Page) => Promise<void>> = {
  apps: (page) => tap(page, ["@place"]),
  "home menu": (page) => tap(page, ["@menu"]),
  "function plot menu": async (page) => {
    await tap(page, ["@symb"]);
    await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
    await tap(page, ["@plot", "@menu"]); // no function defined: every row but one disabled, with its reason
  },
  "solve menu": async (page) => {
    await tap(page, ["@place"]);
    await sheet(page).getByRole("menuitem", { name: "4 Solve" }).click();
    await expect(page.locator('[data-app="solve"]')).toBeVisible();
    await tap(page, ["@num", "@menu"]); // no equation: every row disabled
  },
  mode: (page) => tap(page, ["@mode"]),
  "mode digits": async (page) => {
    await tap(page, ["@mode"]);
    await sheet(page).getByRole("menuitem", { name: "3 Significant digits" }).tap(); // the 3 key is under the sheet: its row is where it was
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Significant digits");
  },
  "mode settings": async (page) => {
    await tap(page, ["@mode", "d6"]);
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
  },
  "mode settings appearance": async (page) => {
    await tap(page, ["@mode", "d6", "d1"]);
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Appearance");
  },
  "mode settings numbers": async (page) => {
    await tap(page, ["@mode", "d6", "d2"]);
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Numbers");
  },
  tmpl: (page) => tap(page, ["tmpl"]),
  "shift 6": (page) => tap(page, ["shift", "d6"]),
  "shift 9": (page) => tap(page, ["shift", "d9"]),
};

async function openSheet(page: Page, name: string): Promise<void> {
  await (OPENERS[name] as (page: Page) => Promise<void>)(page);
  await expect(sheet(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // no rise animation: the boxes are final at once
});

/** The sheet's last row can be scrolled into the box of its list or grid and lies inside it then. */
async function lastRowReachable(page: Page): Promise<void> {
  const box = sheet(page).locator(".list, .grid");
  const last = sheet(page).getByRole("menuitem").last();
  await last.scrollIntoViewIfNeeded();
  const [list, row] = await Promise.all([box.boundingBox(), last.boundingBox()]);
  expect(row && list && row.y + row.height <= list.y + list.height + 0.5 && row.y >= list.y - 0.5).toBe(true);
}

// R770: at 360 × 740 the viewport leaves a sheet about 250 px; these three are taller than that, so each scrolls inside its box
// (scroll height above client height: a sheet that does not scroll fails here) and its last row is reached
test.describe("at 360 × 740", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
  });
  for (const name of ["function plot menu", "mode settings numbers", "mode settings appearance"])
    test(`scroll: ${name} is taller than its box, scrolls inside it to its last row`, async ({ page }) => {
      await openSheet(page, name);
      const m = await sheet(page).locator(".list, .grid").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(m.scroll).toBeGreaterThan(m.client);
      await lastRowReachable(page);
    });
});

test.describe("at 412 × 915", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page);
  });

  test("keys never move: Settings (a level of the sheet, R49) open and closed again", async ({ page }) => {
    const before = await keyBoxes(page);
    await openSheet(page, "mode settings numbers");
    expect(await keyBoxes(page)).toEqual(before);
    await tap(page, ["esc", "esc", "esc"]);
    await expect(sheet(page)).toHaveCount(0);
    expect(await keyBoxes(page)).toEqual(before);
  });

  for (const name of ["apps", "home menu", "mode", "tmpl", "shift 6", "shift 9"])
    test(`keys never move: ${name} open and closed again`, async ({ page }) => {
      const before = await keyBoxes(page);
      await openSheet(page, name);
      expect(await keyBoxes(page)).toEqual(before);
      await tap(page, ["esc"]);
      await expect(sheet(page)).toHaveCount(0);
      expect(await keyBoxes(page)).toEqual(before);
    });

  // R770: a sheet taller than its room scrolls inside its box, and its last row scrolls into view; "mode digits" has the
  // room at 412 × 915 and is only checked for its last row, the three of the 360 × 740 block below are taller than the box
  test("scroll: mode digits scrolls inside its box to its last row", async ({ page }) => {
    await openSheet(page, "mode digits");
    await lastRowReachable(page);
  });

  // R720: seven rows, Export › last as 7: key 7 opens Export › at both phone sizes (R770: the rows scroll in the viewport, none below the floor)
  for (const [width, height] of [[412, 915], [360, 740]] as const)
    test(`the Home menu's seven rows keep their floor at ${width} × ${height}, key 7 opens Export › (R720)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page);
      await tap(page, ["d1", "add", "d2", "enter"]); // a result, so Export › is on
      await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
      await openSheet(page, "home menu");
      const rows = await sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
      expect(rows).toHaveLength(7);
      for (const r of rows) expect(r.height).toBeGreaterThanOrEqual(36);
      await tap(page, ["d7"]);
      await expect(page.getByTestId("sheet-title")).toHaveText(/› Export$/);
    });

  test("a list row never goes below the floor of 36 px, and a value row's ◀ ▶ buttons are at least 44 × 44 px (R86: only Digits, Preset (R89) and Settings' rows have them)", async ({ page }) => {
    await openSheet(page, "mode digits");
    for (const b of await sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height)))
      expect(b).toBeGreaterThanOrEqual(36);
    await tap(page, ["esc"]);
    const buttons = sheet(page).locator('[data-testid="step-down"], [data-testid="step-up"]');
    await expect(buttons).toHaveCount(4); // Digits and Preset (R89): angle, format and entry have a button per value (R86)
    for (const b of await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
      expect(b.width >= 44 && b.height >= 44).toBe(true);
  });

  test("a grid has no title row: the title, the highlighted cell's name and × share the hint line", async ({ page }) => {
    await openSheet(page, "tmpl");
    const [title, hint, close] = await Promise.all([
      boxOf(page, '[data-testid="sheet-title"]'),
      boxOf(page, '[data-testid="sheet-hint"]'),
      boxOf(page, '[role="menu"] [aria-label="Close"]'),
    ]);
    await expect(page.getByTestId("sheet-hint")).toHaveText("Fraction");
    const mid = (b: Box): number => b.y + b.height / 2;
    expect(Math.abs(mid(title) - mid(hint))).toBeLessThanOrEqual(3);
    expect(Math.abs(mid(title) - mid(close))).toBeLessThanOrEqual(3);
  });

  test("Shift + 6: each cell shows the key that picks it in its corner, and a tap on that key picks it (R770: the keys stay live)", async ({ page }) => {
    await openSheet(page, "shift 6");
    await expect(sheet(page).locator('[data-testid="cell-key"]')).toHaveCount(11);
    await expect(sheet(page).locator('[data-id="le"] [data-testid="cell-key"]')).toBeVisible();
    await page.locator('[data-key="d8"]').tap(); // ≤
    await expect(sheet(page)).toHaveCount(0);
    expect(await entryValue(page)).toContain("le");
  });

  test("a key the sheet does not use is dead: the Apps sheet stays and nothing types into the line (R770)", async ({ page }) => {
    await openSheet(page, "apps");
    await tap(page, ["sq", "sin"]); // neither has a job in a short list
    await expect(sheet(page)).toBeVisible();
    expect(await entryValue(page)).toBe("");
    await tap(page, ["tmpl"]); // Tmpl keeps its job: it opens its palette in place of Apps
    await expect(page.getByTestId("sheet-hint")).toHaveText("Fraction");
    await tap(page, ["tmpl"]); // and toggles it shut
    await expect(sheet(page)).toHaveCount(0);
    expect(await entryValue(page)).toBe("");
  });

  test("a digit key under the sheet still picks its row (by a hardware key)", async ({ page }) => {
    await openSheet(page, "apps");
    await page.keyboard.press("4");
    await expect(page.locator('[data-app="solve"]')).toBeVisible();
  });

  test("a tap in the viewport closes the sheet; nothing is picked", async ({ page }) => {
    await openSheet(page, "home menu");
    await page.locator(".screen").click({ position: { x: 2, y: 2 } });
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator('[data-app="function"]')).toHaveCount(0);
  });

  test("a list stays above the keypad, whatever it takes", async ({ page }) => {
    await page.evaluate(() => {
      const items = Array.from({ length: 14 }, (_, i) => ({ id: `u${i}`, label: `unit ${i}` }));
      window.n62.shell.showMenu("Units", items);
    });
    const [s, pad] = await Promise.all([boxOf(page, '[role="menu"]'), boxOf(page, ".pad")]);
    expect(s.y + s.height).toBeLessThanOrEqual(pad.y + 1);
  });
});

// R194f1: Numbers has seven rows (the Word row is the last), two of them with a button per value; at 360 × 740 they need
// 308 px of the 288 the room gives, so the list scrolls (decisions.md "A sheet that cannot fit at its floor scrolls", as
// Appearance does) and its last row is still reached. With the full rows (1000 px tall and more since R722) it fits whole.
test("R194f1: Numbers at 360 × 740 scrolls to its Word row", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page);
  await openSheet(page, "mode settings numbers");
  const m = await sheet(page).locator(".list").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(m.scroll).toBeGreaterThan(m.client); // it scrolls: no floor gives way
  await sheet(page).locator('[data-id="word"]').scrollIntoViewIfNeeded();
  await expect(sheet(page).locator('[data-id="word"]')).toBeInViewport();
});

// R281: the store sheet takes letters, so it stays above the keypad (Alpha and a letter key type a name as on the G2). At
// 360 × 740 its title, the whole A–Z grid and the line under it fit there, inside the viewport (the names below the grid
// scroll with it); at 412 × 915 two names fit too, without a scroll.
for (const [width, height, all] of [[360, 740, false], [412, 915, true]] as const)
  test(`R281: the store sheet fits above the keypad at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    await page.evaluate(() => {
      const n = (name: string, preview: string, time: number) => ({ name, kind: "var" as const, preview, view: "home" as const, time, mark: "=" as const });
      window.n62.session.userNames = [n("A", "5", 1), n("rate", "0.0425", 2), n("R2", "10000", 3)];
    });
    await tap(page, ["d7", "shift", "emark"]);
    const store = page.getByTestId("store");
    await expect(store.locator('[data-id="name:Z"]')).toBeVisible();
    const [s, pad, cells, list, note] = await Promise.all([boxOf(page, '[data-testid="store"] [role="menu"]'), boxOf(page, ".pad"), boxOf(page, '[data-testid="sheet-cells"]'), boxOf(page, '[data-testid="store"] .list'), boxOf(page, '[data-testid="store"] [data-testid="find-preview"]')]);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.y + s.height).toBeLessThanOrEqual(pad.y + 1); // above the keypad: no key is covered
    expect(cells.y + cells.height).toBeLessThanOrEqual(list.y + list.height + 1); // every letter on screen, none cut
    expect(note.y + note.height).toBeLessThanOrEqual(s.y + s.height);
    if (all) {
      const m = await store.locator(".list").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(m.scroll).toBeLessThanOrEqual(m.client);
    }
  });

// R146, R723: Shift + Help's legend ("Settings", on r0c4) fits its cluster key at the legend size at 360 and 412 px wide; R143: with the
// menu mark ▾ after it (out of the flow, inside the key's width: a cluster key has no padding to spare) it shrinks by at most a pixel (10 px at 360, the legend's 11 px
// at 412) and the mark ends inside the key. With Shift on the face "Settings" is shrunk to fit (measured 11.5 px at 360,
// 13.9 px at 412, against 15 px for its neighbours; the report's decision item), never cut.
for (const width of [360, 412])
  test(`R146: the Settings legend on Help fits at the legend size at ${width} px; Shift on, the face is not cut`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const help = page.locator('[data-key="help"]');
    const fits = (sel: string) =>
      help.evaluate((key, s) => {
        const el = key.querySelector<HTMLElement>(s);
        const k = key.getBoundingClientRect();
        const r = el?.getBoundingClientRect();
        return {
          text: el?.textContent?.trim(), px: Math.round(parseFloat(el ? getComputedStyle(el).fontSize : "0")),
          cut: r ? r.right + 0.55 * parseFloat(getComputedStyle(el!).fontSize) > k.right + 0.5 : true, // (the mark hangs after the text, about 0.55 em)
        };
      }, sel);
    expect(await fits(".shiftlegend")).toMatchObject({ text: "Settings", cut: false });
    expect((await fits(".shiftlegend")).px).toBeGreaterThanOrEqual(10);
    await tap(page, ["shift"]);
    expect(await fits('[data-fit="face"]')).toMatchObject({ text: "Settings", cut: false });
  });

// R723: the faces of Help (with its ▾ mark), Select and Deselect, and Shift's "Settings", "Copy" and "Paste", fit their cluster keys at 360 and 412 px
for (const width of [360, 412])
  test(`R723: the faces of Help, Select and Deselect fit their keys at ${width} px, Shift on too`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const faces = (): Promise<{ id: string; text: string; cut: boolean }[]> =>
      page.evaluate(() =>
        ["help", "select", "deselect"].map((id) => {
          const key = document.querySelector(`[data-key="${id}"]`) as HTMLElement;
          const el = key.querySelector<HTMLElement>('[data-fit="face"]') as HTMLElement;
          const k = key.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          const mark = el.dataset["opens"] ? 0.55 * parseFloat(getComputedStyle(el).fontSize) : 0; // (the ▾ hangs after the text)
          return { id, text: el.textContent?.trim() ?? "", cut: r.right + mark > k.right + 0.5 || r.left < k.left - 0.5 };
        }),
      );
    expect(await faces()).toEqual([
      { id: "help", text: "Help", cut: false },
      { id: "select", text: "Select", cut: false },
      { id: "deselect", text: "Deselect", cut: false },
    ]);
    await tap(page, ["shift"]);
    expect(await faces()).toEqual([
      { id: "help", text: "Settings", cut: false },
      { id: "select", text: "Copy", cut: false },
      { id: "deselect", text: "Paste", cut: false },
    ]);
  });

test("flow: a tap on a Tmpl cell closes the sheet, the template goes on the line with the cursor in its first box, and the next digit types into it", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await tap(page, ["tmpl"]);
  await sheet(page).locator('[data-id="frac"]').tap();
  await expect(sheet(page)).toHaveCount(0);
  await tap(page, ["d5"]);
  expect(await entryValue(page)).toMatch(/^\\frac\{5\}\{/);
});

// R145: Settings is the ⚙ in the title row of every ☰ menu, in sight without a scroll; the list holds no Settings row
for (const [width, height] of [[360, 740], [412, 839]] as const)
  test(`R145: Home's ☰ at ${width} × ${height} has a 48 px ⚙ in its title row, inside the viewport; a tap opens Settings as the next level`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    await tap(page, ["@menu"]);
    const gear = page.getByTestId("sheet-gear");
    await expect(gear).toHaveAccessibleName("Settings");
    const [g, head] = await Promise.all([boxOf(page, '[data-testid="sheet-gear"]'), boxOf(page, '[role="menu"] .head')]);
    expect(g.width).toBeGreaterThanOrEqual(48);
    expect(g.height).toBeGreaterThanOrEqual(48);
    expect(g.y).toBeGreaterThanOrEqual(0);
    expect(g.y + g.height).toBeLessThanOrEqual(height);
    expect(g.x + g.width).toBeLessThanOrEqual(width);
    expect(Math.abs(g.y + g.height / 2 - (head.y + head.height / 2))).toBeLessThanOrEqual(3);
    expect(await sheet(page).getByRole("menuitem").count()).toBe(7); // R720: item 7 is Export ›
    await expect(sheet(page).locator('[data-id="settings"]')).toHaveCount(0);
    await gear.tap();
    await expect(page.getByTestId("sheet-title")).toHaveText("Home menu › Settings");
    await sheet(page).getByRole("button", { name: "Back" }).tap();
    await expect(page.getByTestId("sheet-title")).toHaveText("Home menu");
  });

test("R145: CAS's ☰ and the ☰ on a picked row have the ⚙ and no Settings row; a long press has none", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await tap(page, ["d1", "add", "d2", "enter"]);
  await expect(page.locator('[data-testid="result"]')).toHaveCount(1);
  await tap(page, ["up", "@menu"]); // a picked row: its menu, with the ⚙
  await expect(page.getByTestId("sheet-gear")).toBeVisible();
  await expect(sheet(page).locator('[data-id="settings"]')).toHaveCount(0);
  await expect(sheet(page).getByRole("menuitem")).toHaveCount(7); // R720: item 7 is Export ›
  await page.getByTestId("sheet-gear").tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Menu › Settings");
  await tap(page, ["esc", "esc"]);
  await page.evaluate(() => window.n62.shell.showMenu("Row", [{ id: "a", label: "A" }])); // as a long press does
  await expect(page.getByTestId("sheet-gear")).toHaveCount(0);
});
