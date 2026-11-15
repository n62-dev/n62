// SPDX-License-Identifier: GPL-3.0-or-later
// R189 (docs/04 5.3): a cell of a stored matrix's grid is edited on the entry line and written back with `M:=[[…]]`
// through the normal store path (one history row, the definitions log keeps it over a relaunch). A key that types
// starts the cell's edit (the line that was there comes back after it); Enter writes the cell, Esc leaves the old value,
// a cell the parser refuses shows the refusal and leaves the matrix as it was. The real engine; expected values by hand.
// Fix round 2: the row is LaTeX the line reads back (a recall gives the same matrix), and a cell that would make the
// store something other than this matrix (M itself, a list, a store into another name) is refused, nothing sent.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, sheetKey, tap, tapTwice } from "./helpers.ts";

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
  expect(await page.evaluate(() => window.n62.session.home.at(-1)?.latex)).toBe("M:=\\begin{pmatrix}1&2\\\\9&4\\end{pmatrix}");
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

test("a CAS-stored float survives the write: the Home row is LaTeX with no evalf, and its recall gives the same T", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setView("cas"));
  await store(page, "T:=[[x,evalf(sin(1))],[3,4]]", "T"); // as approx(sin(1)) types it
  const was = await run(page, "T");
  expect(was).toBe("[[x,0.841470984808],[3,4]]"); // a float element, drawn at 12 digits
  await page.evaluate(() => window.n62.session.setView("home"));
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  await expect(grid(page).locator("td[data-cell]")).toHaveCount(4);
  await tap(page, ["down", "d9", "enter"]);
  await expect(cell(page, "2,1")).toHaveAttribute("data-text", "9");
  const grid1 = await texts(page);
  const row = await page.evaluate(() => window.n62.session.home.at(-1)?.latex ?? "");
  expect(row).not.toContain("evalf");
  // the float as a decimal in approx() (a typed decimal is read exactly), with every digit CAS keeps (40 here)
  expect(row).toMatch(/^T:=\\begin\{pmatrix\}x&\\operatorname\{approx\}\\left\(0\.84147098480789650665\d*\\right\)\\\\9&4\\end\{pmatrix\}$/);
  await tap(page, ["esc", "esc"]); // the grid, then the sheet
  await expect(page.getByTestId("menu")).toBeHidden();
  await page.evaluate(() => window.n62.session.setView("cas"));
  const after = await run(page, "T");
  expect(after).toBe("[[x,0.841470984808],[9,4]]");
  const exact = await run(page, "T[0][1]-sin(1)"); // the float kept its value, all 40 digits of it
  // the recall: a second tap on the Home row puts its LaTeX on the line, Enter stores it again; T is the same
  await run(page, "T:=0");
  await page.evaluate(() => window.n62.session.setView("home"));
  await tapTwice(page.locator('[data-status="done"] .in').last()); // Home's last row is the grid's store: a pick, then the recall
  expect(await entryValue(page)).toBe(row);
  const n = await rows(page);
  await tap(page, ["enter"]);
  await page.waitForFunction((n) => window.n62.session.home.length > n && window.n62.session.home.at(-1)?.status !== "pending", n, { timeout: 20_000 });
  expect(await page.evaluate(() => { const i = window.n62.session.home.at(-1); return `${i?.status} ${i?.text}`; })).toBe("done [[x,0.841470984808],[9,4]]");
  await page.evaluate(() => window.n62.session.setView("cas"));
  expect(await run(page, "T")).toBe(after);
  expect(await run(page, "T[0][1]-sin(1)")).toBe(exact);
  await page.evaluate(() => window.n62.session.setView("home"));
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  await expect(grid(page).locator("td[data-cell]")).toHaveCount(4);
  expect(await texts(page)).toEqual(grid1);
});

// R308: an element whose float Giac prints with an exponent (a complex float, tiny imaginary parts are common) was written
// back as Giac's latex() wrote it, 1.5e-20, which the parser read as the letter e minus 20: every edit was refused as
// changing that element. It goes back with the mark ᴇ (1.5ᴇ-20), so the edit of the other cell is written. By hand: T
// holds the same 1.5·10⁻²⁰+2i and the typed 2.
test("a complex element with an exponent survives the write: CAS T:=[[approx(1.5e-20+2.0*i),1]], cell (1,2) edited to 2", async ({ page }) => {
  await page.evaluate(() => window.n62.session.setView("cas"));
  await store(page, "T:=[[approx(1.5e-20+2.0*i),1]]", "T"); // a float, as the ≈ key types it (a typed decimal alone is exact)
  expect(await run(page, "T")).toBe("[[1.5E-20+2*i,1]]");
  // the element's value to far past the 40 digits CAS keeps (its last bits differ after the write: it is read back from
  // its 40-digit decimal), to compare after the write
  const near = "abs(T[0][0]-approx(1.5e-20+2.0*i))<10^-55";
  const was = await run(page, near);
  await page.evaluate(() => window.n62.session.setView("home"));
  await tap(page, ["shift", "d4"]);
  await sheetKey(page, ["d0"]);
  await expect(grid(page).locator("td[data-cell]")).toHaveCount(2);
  await tap(page, ["right", "d2", "enter"]);
  await expect(cell(page, "1,2")).toHaveAttribute("data-text", "2");
  await expect(page.getByTestId("matrix-refusal")).toBeHidden();
  // the element in approx() with the mark, at every digit CAS keeps (40; Giac prints 1.5·10⁻²⁰ at them as 0.15e-19)
  expect(await page.evaluate(() => window.n62.session.home.at(-1)?.latex ?? "")).toMatch(/^T:=\\begin\{pmatrix\}\\operatorname\{approx\}\\left\(0\.150*\\emark-19\+2\.0*\\mathrm\{i\}\\right\)&2\\end\{pmatrix\}$/);
  await tap(page, ["esc", "esc"]);
  await page.evaluate(() => window.n62.session.setView("cas"));
  expect(await run(page, "T")).toBe("[[1.5E-20+2*i,2]]");
  expect(was).toBe("true");
  expect(await run(page, near)).toBe(was);
});

/** Starts the edit of (2,1) with a digit, puts `latex` on the line, Enter: the refusal shows, nothing is sent, M is as it was. */
async function refused(page: Page, latex: string | null, keys: string[] = ["d1"]): Promise<void> {
  await openAt21(page);
  const before = await rows(page);
  await tap(page, keys);
  if (latex !== null) await page.evaluate((l) => window.n62.entry.set(l, {}), latex);
  await tap(page, ["enter"]);
  await expect(page.getByTestId("matrix-refusal")).toBeVisible();
  await expect(page.getByTestId("matrix-refusal")).not.toBeEmpty();
  expect(await texts(page)).toEqual(["1", "2", "3", "4"]);
  expect(await rows(page)).toBe(before);
  await tap(page, ["esc", "esc"]);
  await expect(grid(page)).toBeHidden();
  await page.evaluate(() => window.n62.session.setView("cas"));
  expect(await run(page, "M")).toBe("[[1,2],[3,4]]");
}

test("M itself in a cell (Alpha M) is refused: M stays its matrix", async ({ page }) => {
  await refused(page, null, ["alpha", "neg"]);
});

test("a list [1,2] in a cell is refused: M stays its matrix", async ({ page }) => {
  await refused(page, "\\begin{pmatrix}1&2\\end{pmatrix}"); // the matrix template's one row, as [1,2] is typed
});

test("a store in a cell (a:=5) is refused and stores nothing", async ({ page }) => {
  await refused(page, "a:=5");
  expect(await page.evaluate(() => window.n62.session.userNames.some((u) => u.name === "a"))).toBe(false);
  expect(await run(page, "a")).toBe("a");
});

// R300 (night review 2026-11-14, bu-1, bu-3, bu-5, S3): the grid takes a key by what it does in the layer pressed.
const names = (page: Page): Promise<string[]> => page.evaluate(() => window.n62.session.userNames.map((u) => u.name).sort());
const editing = (page: Page) => grid(page).locator('td[data-editing="true"]');

test("Store ▶ (Shift + ᴇ) in the grid, with and without an edit, does nothing: the grid stays, the line, history and names too", async ({ page }) => {
  await openAt21(page);
  const before = [await rows(page), await names(page)];
  await tap(page, ["shift", "emark"]);
  await expect(grid(page)).toBeVisible();
  await expect(editing(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("7");
  await tap(page, ["d2", "shift", "emark"]);
  await expect(grid(page)).toBeVisible();
  await expect(cell(page, "2,1")).toHaveAttribute("data-editing", "true");
  expect(await entryValue(page)).toBe("2");
  await tap(page, ["esc"]);
  expect(await entryValue(page)).toBe("7");
  expect([await rows(page), await names(page)]).toEqual(before);
  expect(await texts(page)).toEqual(["1", "2", "3", "4"]);
});

test("a hardware letter starts the cell's edit and types in it: 2, a, Enter writes 2a's value", async ({ page }) => {
  await store(page, "a:=3", "a");
  await openAt21(page);
  await page.evaluate(() => window.n62.entry.focus());
  await page.keyboard.press("x");
  await expect(cell(page, "2,1")).toHaveAttribute("data-editing", "true");
  expect(await entryValue(page)).toBe("x");
  await tap(page, ["esc"]);
  expect(await entryValue(page)).toBe("7");
  await page.evaluate(() => window.n62.entry.focus());
  await page.keyboard.type("2a");
  expect(await entryValue(page)).toBe("2a");
  await page.keyboard.press("Enter");
  await expect(cell(page, "2,1")).toHaveAttribute("data-text", "6");
  await tap(page, ["esc"]);
  expect(await run(page, "M")).toBe("[[1,2],[6,4]]");
});

test("with no edit Undo, Redo, ⇤ and ⇥ change nothing; during an edit ≈ types approx, Clear clears the cell's line, Esc ends it", async ({ page }) => {
  await openAt21(page);
  const before = await rows(page);
  await tap(page, ["undo", "redo", "shift", "undo", "shift", "redo"]);
  await expect(editing(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("7");
  expect(await rows(page)).toBe(before);
  await tap(page, ["d2", "shift", "enter"]);
  await expect(cell(page, "2,1")).toHaveAttribute("data-editing", "true");
  expect(await entryValue(page)).toContain("approx");
  expect(await texts(page)).toEqual(["1", "2", "3", "4"]);
  await tap(page, ["shift", "esc"]);
  await expect(cell(page, "2,1")).toHaveAttribute("data-editing", "true");
  expect(await entryValue(page)).toBe("");
  await tap(page, ["shift", "esc"]); // an empty cell line: the history stays (the one-shot Shift was used up)
  await expect(cell(page, "2,1")).toHaveAttribute("data-editing", "true");
  expect(await rows(page)).toBe(before);
  await tap(page, ["d2", "undo"]); // during an edit Undo acts on the cell's line
  expect(await entryValue(page)).toBe("");
  await tap(page, ["esc"]);
  await expect(editing(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("7");
  expect(await rows(page)).toBe(before);
});

test("a cell's first − types itself: −, 5, Enter writes −5 (no Ans first in a cell)", async ({ page }) => {
  await openAt21(page);
  await tap(page, ["sub"]);
  expect(await entryValue(page)).toBe("-");
  await tap(page, ["d5", "enter"]);
  await expect(page.getByTestId("matrix-refusal")).toHaveCount(0);
  await expect(cell(page, "2,1")).toHaveAttribute("data-text", /^[-−]5$/);
  await tap(page, ["esc"]);
  expect(await run(page, "M")).toBe("[[1,2],[-5,4]]");
});
