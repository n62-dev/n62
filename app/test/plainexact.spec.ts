// SPDX-License-Identifier: GPL-3.0-or-later
// R746 (owner, 2026-11-18, on the Fairphone 6): a fraction tapped from history was one unit on the line (a chip): the
// caret could not enter it and ◀ jumped over it. An exact result drawn as a fraction, root, power or matrix now goes on
// the line as its maths, editable, and stays one term: a × between it and a number or a bracket beside the cursor, its
// leading minus bracketed. Expected values are derived: 5/67, 2·5/6 = 5/3, 2·(−5/6) = −5/3, (−5/6)² = 25/36, √2² = 2,
// [[1,2],[3,4]]² = [[7,10],[15,22]]; checked by the item's exact text (`full`).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, tap, tapTwice } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** The line, with MathLive's short fraction of two digits (`\\frac56`) written out. */
const line = async (page: Page): Promise<string> => (await entryValue(page)).replace(/\\frac(\d)(\d)/g, "\\frac{$1}{$2}");
const done = (page: Page) => page.locator('[data-status="done"]');
/** The exact text of the last row (Giac's, `full`), once `n` rows are done. */
async function full(page: Page, n: number): Promise<string | undefined> {
  await expect(done(page)).toHaveCount(n);
  return page.evaluate(() => window.n62.session.items.at(-1)?.full);
}
/** `latex` as the n-th row, in CAS or (`home`) in Home drawn as a fraction: a b/c on the empty line (R10). */
async function result(page: Page, latex: string, n: number, home: boolean): Promise<void> {
  await page.evaluate((v) => window.n62.session.setView(v), home ? ("home" as const) : ("cas" as const));
  await page.evaluate((l) => window.n62.session.submit(l), latex);
  await expect(done(page)).toHaveCount(n);
  if (home) await tap(page, ["frac"]);
  if (home) await expect(lastResult(page)).toHaveAttribute("data-text", latex.startsWith("-") ? /^-\d+\/\d+$/ : /^\d+\/\d+$/);
}
/** Two taps on the n-th row's result: it goes on the line at the cursor. */
const insert = (page: Page, n: number): Promise<void> => tapTwice(page.locator('[data-testid="result"] .result').nth(n - 1));

for (const home of [false, true]) {
  const where = home ? "Home, drawn as a fraction" : "CAS";
  test(`(a) ${where}: 5/6 goes on the line as its fraction; ◀ enters the denominator, 7 edits it`, async ({ page }) => {
    await result(page, "\\frac{5}{6}", 1, home);
    await insert(page, 1);
    expect(await line(page)).toBe("\\frac{5}{6}");
    await tap(page, ["left", "d7"]);
    expect(await line(page)).toBe("\\frac{5}{67}");
    await tap(page, ["enter"]);
    expect(await full(page, 2)).toBe("5/67");
  });

  test(`(b) ${where}: 2 then 5/6 is 2×5/6 = 5/3, never 2⅚ or a refusal`, async ({ page }) => {
    await result(page, "\\frac{5}{6}", 1, home);
    await tap(page, ["d2"]);
    await insert(page, 1);
    expect(await line(page)).toBe("2\\times\\frac{5}{6}");
    await tap(page, ["enter"]);
    expect(await full(page, 2)).toBe("5/3");
  });

  test(`(c) ${where}: −5/6 is one term: 2 then it is −5/3, it then x² is 25/36`, async ({ page }) => {
    await result(page, "-\\frac{5}{6}", 1, home);
    await tap(page, ["d2"]);
    await insert(page, 1);
    expect(await line(page)).toMatch(/^2\\times(?:\\left\(-\\frac\{5\}\{6\}\\right\)|\\frac\{-5\}\{6\})$/);
    await tap(page, ["enter"]);
    expect(await full(page, 2)).toBe("-5/3");
    await tap(page, ["esc"]);
    await insert(page, 1);
    await tap(page, ["sq", "enter"]);
    expect(await full(page, 3)).toBe("25/36");
  });
}

test("(b) CAS: 5/6 put before a 3 on the line gets its × after it: 5/6×3 = 5/2", async ({ page }) => {
  await result(page, "\\frac{5}{6}", 1, false);
  await tap(page, ["d3", "left"]);
  await insert(page, 1);
  expect(await line(page)).toBe("\\frac{5}{6}\\times3");
  await tap(page, ["enter"]);
  expect(await full(page, 2)).toBe("5/2");
});

test("(d) CAS: √2 inserted: ◀ enters the root; x² then Enter gives 2", async ({ page }) => {
  await result(page, "\\sqrt{2}", 1, false);
  await insert(page, 1);
  expect(await entryValue(page)).toBe("\\sqrt{2}");
  await tap(page, ["left", "d3"]);
  expect(await entryValue(page)).toBe("\\sqrt{23}");
  await tap(page, ["esc"]);
  await insert(page, 1);
  await tap(page, ["sq", "enter"]);
  expect(await full(page, 2)).toBe("2");
});

test("(d) CAS: a 2×2 matrix inserted: ◀ enters a cell; x² then Enter gives its square", async ({ page }) => {
  await result(page, "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}", 1, false);
  await insert(page, 1);
  expect(await entryValue(page)).not.toMatch(/\\res/);
  await tap(page, ["left", "d5"]);
  expect((await entryValue(page)).replace(/\s/g, "")).toBe("\\begin{pmatrix}1&2\\\\3&45\\end{pmatrix}");
  await tap(page, ["esc"]);
  await insert(page, 1);
  await tap(page, ["sq", "enter"]);
  expect(await full(page, 2)).toBe("[[7,10],[15,22]]");
});

test("controls: an integer, a rounded decimal and π stay chips", async ({ page }) => {
  await result(page, "\\frac{10}{5}", 1, false); // 2
  await insert(page, 1);
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{2\}$/);
  await tap(page, ["esc"]);
  await result(page, "\\pi", 2, false);
  await insert(page, 2);
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{\\pi\}$/);
  await tap(page, ["esc"]);
  // Home draws the exact 1/3·10⁻²⁰ rounded (≈ 3.33333333333×10⁻²¹): its power is no exact maths, the chip keeps the value
  await page.evaluate(() => window.n62.session.setView("home"));
  await page.evaluate(() => window.n62.session.submit("\\frac{1}{3}\\times10^{-20}"));
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await insert(page, 1);
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{3\.33333333333\\times10\^\{-21\}\}$/);
  await tap(page, ["mul", "d3", "enter"]);
  expect(await full(page, 2)).toBe("1/100000000000000000000");
});
