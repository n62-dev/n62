// SPDX-License-Identifier: GPL-3.0-or-later
// R189 (docs/04 5.3): a cell of a stored matrix's grid is edited on the entry line and written back with `M:=[[…]]`
// through the normal store path (one history row, the definitions log keeps it over a relaunch). A key that types
// starts the cell's edit (the line that was there comes back after it); Enter writes the cell, Esc leaves the old value,
// a cell the parser refuses shows the refusal and leaves the matrix as it was. The real engine; expected values by hand.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheetKey, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** Runs `giac` in the current view as the line would and waits for its row; the row's text. */
async function run(page: Page, giac: string): Promise<string> {
  const n = await page.evaluate(() => window.n62.session.items.length);
  await page.evaluate((g) => window.n62.session.submit(g, g), giac);
  await page.waitForFunction((n) => window.n62.session.items.length > n && window.n62.session.items.at(-1)?.status !== "pending", n, { timeout: 20_000 });
  return page.evaluate(() => window.n62.session.items.at(-1)?.text ?? "");
}

async function store(page: Page, giac: string, name: string): Promise<void> {
  await run(page, giac);
  await page.waitForFunction((n) => window.n62.session.userNames.some((u) => u.name === n), name, { timeout: 20_000 });
}

const grid = (page: Page) => page.getByTestId("matrix-grid");
const cell = (page: Page, rc: string) => grid(page).locator(`td[data-cell="${rc}"]`);
const texts = (page: Page): Promise<(string | null)[]> => grid(page).locator("td[data-cell]").evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
const rows = (page: Page): Promise<number> => page.evaluate(() => window.n62.session.home.length);

/** The entry line is drawn and a tap at its centre reaches it (no sheet or dimming layer over it). */
const lineInSight = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const r = document.querySelector('[data-testid="entry"]')!.getBoundingClientRect();
    const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return r.height > 0 && el !== null && el.closest('[data-testid="entry"]') !== null;
  });

/** M:=[[1,2],[3,4]] stored, `7` on the line, and M's grid open at (2,1). */
async function openAt21(page: Page): Promise<void> {
  await store(page, "M:=[[1,2],[3,4]]", "M");
  await tap(page, ["d7"]);
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  await expect(grid(page).locator("td[data-cell]")).toHaveCount(4);
  await tap(page, ["down"]);
  await expect(cell(page, "2,1")).toHaveAttribute("data-active", "true");
}

test("a typed 9 and Enter write cell (2,1): the grid shows 9, M in Home is [[1,2],[9,4]], after a relaunch too", async ({ page }) => {
  await openAt21(page);
  const before = await rows(page);
  await tap(page, ["d9"]);
  await expect(cell(page, "2,1")).toHaveAttribute("data-editing", "true");
  expect(await entryValue(page)).toBe("9"); // the cell is typed on the entry line
  expect(await lineInSight(page)).toBe(true); // and that line is in sight, not under the grid or its dimming
  await tap(page, ["enter"]);
  await expect(cell(page, "2,1")).toHaveAttribute("data-text", "9");
  expect(await texts(page)).toEqual(["1", "2", "9", "4"]);
  await expect(cell(page, "2,1")).not.toHaveAttribute("data-editing", "true");
  expect(await entryValue(page)).toBe("7"); // the line that was there comes back
  // one row for the store, through the normal path
  expect(await rows(page)).toBe(before + 1);
  expect(await page.evaluate(() => window.n62.session.home.at(-1)?.latex)).toBe("M:=[[1,2],[9,4]]");
  await tap(page, ["esc"]);
  await expect(grid(page)).toBeHidden();
  expect(await run(page, "M")).toBe("[[1,2],[9,4]]");

  await page.waitForTimeout(900); // the definitions log is written asynchronously
  await page.reload();
  await page.waitForFunction(() => window.n62?.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.n62.entry.ready);
  expect(await run(page, "M")).toBe("[[1,2],[9,4]]");
});

test("an expression in a cell (1/3) is kept exact", async ({ page }) => {
  await openAt21(page);
  await tap(page, ["up", "d1", "div", "d3"]);
  await tap(page, ["enter"]);
  await expect(cell(page, "1,1")).toHaveAttribute("data-text", "0.333333333333");
  await expect(cell(page, "1,1").getByTestId("mark")).toHaveText("≈"); // exact, shown rounded (a float would be ⚠ or have no 1/3)
  await tap(page, ["esc"]);
  await page.evaluate(() => window.n62.session.setView("cas"));
  expect(await run(page, "M")).toBe("[[1/3,2],[3,4]]");
});

test("a cell the parser refuses shows the refusal and leaves the matrix as it was", async ({ page }) => {
  await openAt21(page);
  const before = await rows(page);
  await tap(page, ["d1", "add"]);
  await tap(page, ["enter"]);
  await expect(page.getByTestId("matrix-refusal")).toBeVisible();
  await expect(page.getByTestId("matrix-refusal")).not.toBeEmpty();
  expect(await texts(page)).toEqual(["1", "2", "3", "4"]);
  expect(await rows(page)).toBe(before); // nothing was sent
  await tap(page, ["esc"]); // the edit ends, the old value stays
  await expect(page.getByTestId("matrix-refusal")).toHaveCount(0);
  await expect(grid(page)).toBeVisible();
  expect(await entryValue(page)).toBe("7");
  await tap(page, ["esc"]);
  expect(await run(page, "M")).toBe("[[1,2],[3,4]]");
});

test("Esc in a cell leaves the old value and the line as it was; a second Esc closes the grid", async ({ page }) => {
  await openAt21(page);
  const before = await rows(page);
  await tap(page, ["d9"]);
  expect(await entryValue(page)).toBe("9");
  await tap(page, ["esc"]);
  await expect(cell(page, "2,1")).not.toHaveAttribute("data-editing", "true");
  expect(await texts(page)).toEqual(["1", "2", "3", "4"]);
  expect(await entryValue(page)).toBe("7");
  expect(await rows(page)).toBe(before);
  await expect(grid(page)).toBeVisible();
  await tap(page, ["esc"]);
  await expect(grid(page)).toBeHidden();
  expect(await run(page, "M")).toBe("[[1,2],[3,4]]");
});

test("a tall matrix keeps the line in sight: its grid scrolls, and the edited cell in row 10 is written", async ({ page }) => {
  const rows10 = Array.from({ length: 10 }, (_, r) => `[${2 * r + 1},${2 * r + 2}]`).join(",");
  await store(page, `T:=[${rows10}]`, "T");
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  await expect(grid(page).locator("td[data-cell]")).toHaveCount(20);
  for (let i = 0; i < 9; i++) await tap(page, ["down"]);
  await expect(cell(page, "10,1")).toHaveAttribute("data-active", "true");
  await expect(cell(page, "10,1")).toBeInViewport();
  await tap(page, ["d5"]);
  expect(await lineInSight(page)).toBe(true);
  await tap(page, ["enter"]);
  await expect(cell(page, "10,1")).toHaveAttribute("data-text", "5");
  await tap(page, ["esc"]);
  expect(await run(page, "T[9]")).toBe("[5,20]");
});
