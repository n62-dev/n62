// SPDX-License-Identifier: GPL-3.0-or-later
// R946: under Find a hardware `/`, `*` or `^` types itself into the query (kj/kg is no kjtkg), in the unit view's slot and
// over the line alike; a touch tap on ÷ still types its Alpha letter t (docs/04 3.7). Real keydowns (page.keyboard).
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

type Tok = { prefix?: string; unit: string; power?: string };
const find = (page: Page) => page.getByTestId("find");
const rows = (page: Page) => find(page).getByRole("menuitem");
const query = (page: Page): Promise<string | undefined> => page.evaluate(() => window.n62.shell.sheet?.level.filter);
const slot = (page: Page): Promise<{ tokens: Tok[]; per?: number } | undefined> => page.evaluate(() => window.n62.unitView?.view.model("u1")?.slot);
const tokens = async (page: Page): Promise<Tok[]> => (await slot(page))?.tokens ?? [];
const named = (t: Tok[]): string => t.map((x) => `${x.prefix ?? ""}${x.unit}${x.power ? `^${x.power}` : ""}`).join(" ");
const unitsUp = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
};
const openFind = async (page: Page): Promise<void> => {
  await tap(page, ["math"]);
  await expect(find(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "engine=fake");
});

test.describe("in the unit view's slot", () => {
  test.beforeEach(async ({ page }) => {
    await unitsUp(page);
    await openFind(page);
  });

  test("kj/kg: the query reads kj/kg, the first row is kilojoule per kilogram, Enter puts kJ ÷ kg in the slot", async ({ page }) => {
    await page.keyboard.type("kj/kg");
    expect(await query(page)).toBe("kj/kg");
    await expect(rows(page).first()).toContainText("kilojoule per kilogram");
    const id = await rows(page).first().getAttribute("data-id");
    await page.keyboard.press("Enter");
    await expect(find(page)).toBeHidden();
    expect(id).toBe("uprod:kJ/kg");
    const got = await slot(page); // the ÷: kJ above the bar, kg below (per = where the denominator starts)
    expect(named(got?.tokens ?? [])).toBe("kJ kg");
    expect(got?.per).toBe(1);
  });

  test("n*m and m^2 type themselves", async ({ page }) => {
    await page.keyboard.type("n*m");
    expect(await query(page)).toBe("n*m");
    for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");
    await page.keyboard.type("m^2");
    expect(await query(page)).toBe("m^2");
  });

  test("controls: a letter types lower case, a digit after a letter types itself, a touch tap on ÷ still types t", async ({ page }) => {
    await page.keyboard.type("M3");
    expect(await query(page)).toBe("m3");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await tap(page, ["div"]);
    expect(await query(page)).toBe("t");
  });

  test("control: an empty query's digit picks its row", async ({ page }) => {
    await page.keyboard.press("2");
    await expect(page.getByTestId("sheet-title")).toHaveText("Find › Length");
  });
});

test("over the line (Home): kj/kg, n*m and m^2 type themselves into the query", async ({ page }) => {
  await openFind(page);
  await page.keyboard.type("kj/kg");
  expect(await query(page)).toBe("kj/kg");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("n*m");
  expect(await query(page)).toBe("n*m");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("m^2");
  expect(await query(page)).toBe("m^2");
});

test("control: Vars keeps typing a name's letters", async ({ page }) => {
  await tap(page, ["vars"]);
  await expect(page.getByTestId("sheet-title")).toBeVisible();
  await page.keyboard.type("ab");
  expect(await query(page)).toBe("ab");
});

test("control: Memory keeps its keys as before (a hardware / * ^ is no typed character there)", async ({ page }) => {
  await flick(page, "math", "up");
  await expect(page.getByTestId("sheet-title")).toHaveText("Memory");
  await page.keyboard.type("a/b");
  expect(await query(page)).toBe("atb");
});
